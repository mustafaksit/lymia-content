#!/usr/bin/env node
/**
 * Vocab pipeline - AŞAMA 2 (anlam): spaCy ara-çıktısını okur, her cümle için
 * hedef kelimelerin bu cümledeki anlamını LLM'den üretir (mevcut ÜCRETSİZ
 * rotasyon: lib/gemini.mjs, Gemini öncelikli). Deterministik iş (lemma/pos/tag)
 * spaCy'den GELİR; LLM yalnız anlam üretir. Sonuç: content/v2/vocab/{id}.json
 *
 * content/ ve content/v2/stories'e DOKUNULMAZ (yalnız annot cache + vocab yazılır).
 * Her cümle yanıtı cache'lenir (pipeline/vocab/cache/llm/{hash}.json).
 *
 * Kullanım: node pipeline/vocab/build-vocab.mjs st-0001 st-0004 st-0150
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callGemini, parseJsonResponse, poolStatus } from '../lib/gemini.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ANNOT_DIR = path.join(__dirname, 'cache', 'annot');
const LLM_CACHE_DIR = path.join(__dirname, 'cache', 'llm');
const VOCAB_OUT_DIR = path.join(ROOT, 'content', 'v2', 'vocab');
const VOCAB_VERSION = 1;
const MAX_ATTEMPTS = 3;

fs.mkdirSync(LLM_CACHE_DIR, { recursive: true });
fs.mkdirSync(VOCAB_OUT_DIR, { recursive: true });

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const normDef = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const lc = (s) => s.toLowerCase();

/** Bir hedef kelime için LLM çıktısının kalite kapısı. Geçerse null, aksi halde sebep. */
function gateFailure(surface, lemma, w) {
  if (!w || typeof w !== 'object') return 'yanıt yok';
  for (const f of ['def_en', 'gloss_tr', 'gloss_tr_inflected', 'example_en']) {
    if (typeof w[f] !== 'string' || w[f].trim() === '') return `boş alan: ${f}`;
  }
  const surf = lc(surface), lem = lc(lemma);
  const gtr = lc(w.gloss_tr.trim()), gtri = lc(w.gloss_tr_inflected.trim());
  if (gtr === surf || gtr === lem) return 'gloss_tr İngilizce kelimeyle aynı';
  if (gtri === surf || gtri === lem) return 'gloss_tr_inflected İngilizce kelimeyle aynı';
  if (wordCount(w.def_en) > 12) return 'def_en > 12 kelime';
  if (wordCount(w.example_en) > 15) return 'example_en > 15 kelime';
  const ex = lc(w.example_en);
  if (!ex.includes(surf) && !ex.includes(lem)) return 'example_en hedef kelimeyi içermiyor';
  return null;
}

function buildPrompt(text, targets) {
  const lines = targets.map((t) => `- ${t.surface} | ${t.lemma} | ${t.tag}`).join('\n');
  return `Sen bir İngilizce-Türkçe sözlük asistanısın. Aşağıdaki İNGİLİZCE cümlede geçen HEDEF kelimeler için, SADECE bu cümledeki anlamı verecek şekilde çıktı üret.

Cümle: "${text}"

Hedef kelimeler (surface | lemma | Penn tag):
${lines}

Kurallar:
- Bir kelimenin birden fazla anlamı varsa SADECE bu cümledeki anlamı ver.
- Kelime bir deyim/phrasal verb parçasıysa (give up, look after) bunu def_en içinde kısaca belirt.
- def_en: bu cümledeki anlamı, İngilizce, EN FAZLA 12 kelime.
- gloss_tr: Türkçe karşılığın sözlük hali (fiilse mastar, isimse yalın).
- gloss_tr_inflected: cümledeki çekime/eke uygun Türkçe karşılık (ör. "sardı", "evler").
- example_en: bu anlamı gösteren YENİ, kısa (A2 seviyesi), EN FAZLA 15 kelime, hedef kelimeyi İÇEREN örnek cümle.
- gloss_tr ve gloss_tr_inflected İngilizce kelimenin aynısı OLAMAZ ve boş olamaz.
- Her hedef kelime için tam bir kayıt döndür; surface'i verilen haliyle aynen yaz.

SADECE şu JSON'u döndür, başka hiçbir metin yok:
{"words":[{"surface":"","lemma":"","def_en":"","gloss_tr":"","gloss_tr_inflected":"","example_en":""}]}`;
}

/** Cümle için LLM sonucu (surface_lc -> word). Cache + 3 deneme kapısı. */
async function resolveSentence(text, targets, stats) {
  const cachePath = path.join(LLM_CACHE_DIR, `${sha1(text)}.json`);
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { cache = {}; }
  }

  // Cache'te geçerli (kapıdan geçmiş) olanları al; kalanları LLM'den iste.
  const result = {};
  let missing = [];
  for (const t of targets) {
    const key = lc(t.surface);
    if (cache[key] && !gateFailure(t.surface, t.lemma, cache[key])) result[key] = cache[key];
    else missing.push(t);
  }
  if (missing.length === 0) { stats.cacheHits += targets.length; return result; }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && missing.length > 0; attempt++) {
    stats.llmRequests += 1;
    let words = [];
    try {
      const raw = await callGemini(buildPrompt(text, missing), { json: true });
      const parsed = parseJsonResponse(raw);
      words = Array.isArray(parsed?.words) ? parsed.words : [];
    } catch (e) {
      stats.llmErrors += 1;
      if (attempt === MAX_ATTEMPTS) break;
      continue;
    }
    const bySurface = new Map();
    for (const w of words) if (w && typeof w.surface === 'string') bySurface.set(lc(w.surface), w);

    const stillMissing = [];
    for (const t of missing) {
      const key = lc(t.surface);
      const w = bySurface.get(key);
      const fail = gateFailure(t.surface, t.lemma, w);
      if (fail) {
        stillMissing.push(t);
        if (attempt === MAX_ATTEMPTS) stats.gateReasons[fail] = (stats.gateReasons[fail] || 0) + 1;
      } else {
        // lemma uyuşmazlığı: spaCy kazanır, LLM'inki loglanır.
        if (w.lemma && lc(w.lemma) !== lc(t.lemma)) {
          stats.lemmaMismatch.push({ surface: t.surface, spacy: t.lemma, llm: w.lemma });
        }
        result[key] = w;
        cache[key] = w;
      }
    }
    missing = stillMissing;
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache));
  return result;
}

/** senseId kayıt defteri (hikaye kapsamında). lemma|pos + normalize(def_en) tekilleştirir. */
function makeSenseRegistry() {
  const byKey = new Map(); // "lemma|pos" -> [{norm, id}]
  const senses = {};
  return {
    senses,
    assign(lemma, pos, w) {
      const key = `${lemma}|${pos}`;
      const nd = normDef(w.def_en);
      const list = byKey.get(key) || [];
      let found = list.find((e) => e.norm === nd);
      if (!found) {
        const id = `${lemma}|${pos}|${list.length + 1}`;
        found = { norm: nd, id };
        list.push(found);
        byKey.set(key, list);
        senses[id] = { lemma, pos, def_en: w.def_en.trim(), gloss_tr: w.gloss_tr.trim(), example_en: w.example_en.trim() };
      }
      return found.id;
    },
  };
}

async function buildStory(storyId, stats) {
  const annot = JSON.parse(fs.readFileSync(path.join(ANNOT_DIR, `${storyId}.json`), 'utf8'));
  const reg = makeSenseRegistry();
  const outLevels = {};

  for (const [level, data] of Object.entries(annot.levels)) {
    const sentences = [];
    for (const sent of data.sentences) {
      const targets = sent.tokens.filter((t) => !t.is_stop && !t.is_propn && !t.is_num);
      stats.totalTokens += sent.tokens.length;
      stats.stopword += sent.tokens.filter((t) => t.is_stop).length;
      stats.propn += sent.tokens.filter((t) => t.is_propn).length;
      stats.num += sent.tokens.filter((t) => t.is_num).length;
      stats.targetTokens += targets.length;

      let resolved = {};
      if (targets.length > 0) {
        stats.sentencesCalled += 1;
        resolved = await resolveSentence(sent.text, targets, stats);
      }

      const tokens = sent.tokens.map((t) => {
        if (t.is_stop || t.is_propn || t.is_num) return [t.surface, null, t.tag, null];
        const w = resolved[lc(t.surface)];
        if (!w) { stats.nullGateFail += 1; return [t.surface, null, t.tag, null]; }
        const senseId = reg.assign(t.lemma, t.pos, w);
        return [t.surface, senseId, t.tag, w.gloss_tr_inflected.trim()];
      });
      sentences.push({ p: sent.p, s: sent.s, tokens });
    }
    outLevels[level] = { sentences };
  }

  const out = { storyId, vocabVersion: VOCAB_VERSION, senses: reg.senses, levels: outLevels };
  const outPath = path.join(VOCAB_OUT_DIR, `${storyId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out)); // compact (girintisiz)
  const bytes = fs.statSync(outPath).size;
  stats.files.push({ storyId, bytes, senses: Object.keys(reg.senses).length });
  console.log(`  ${storyId}: ${Object.keys(reg.senses).length} sense, ${(bytes / 1024).toFixed(1)} KB -> ${outPath}`);
}

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error('kullanım: build-vocab.mjs <storyId> [storyId...]'); process.exit(1); }

  const stats = {
    totalTokens: 0, targetTokens: 0, stopword: 0, propn: 0, num: 0,
    sentencesCalled: 0, llmRequests: 0, llmErrors: 0, cacheHits: 0,
    nullGateFail: 0, gateReasons: {}, lemmaMismatch: [], files: [],
    startedAt: Date.now(),
  };

  for (const id of ids) await buildStory(id, stats);

  stats.durationSec = ((Date.now() - stats.startedAt) / 1000).toFixed(1);
  const used = poolStatus().filter((e) => e.calls > 0);
  const reportPath = path.join(__dirname, 'cache', 'pilot-stats.json');
  fs.writeFileSync(reportPath, JSON.stringify({ ...stats, poolUsed: used }, null, 2));

  console.log('\n=== ÖZET ===');
  console.log('toplam token:', stats.totalTokens, '| hedef(LLM adayı):', stats.targetTokens);
  console.log('stopword:', stats.stopword, '| propn:', stats.propn, '| num:', stats.num);
  console.log('LLM çağrısı yapılan cümle:', stats.sentencesCalled, '| gerçek LLM isteği:', stats.llmRequests, '| cache-hit token:', stats.cacheHits, '| LLM hata:', stats.llmErrors);
  console.log('senseId null (kapı-fail):', stats.nullGateFail, '| kapı sebepleri:', JSON.stringify(stats.gateReasons));
  console.log('lemma uyuşmazlığı (spaCy kazandı):', stats.lemmaMismatch.length);
  console.log('süre:', stats.durationSec, 'sn');
  console.log('kullanılan uçlar:', used.map((e) => `${e.id}(${e.calls})`).join(', '));
  console.log('dosyalar:', stats.files.map((f) => `${f.storyId}=${(f.bytes / 1024).toFixed(1)}KB`).join(', '));
  console.log('istatistik ->', reportPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
