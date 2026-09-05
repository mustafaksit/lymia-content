#!/usr/bin/env node
/**
 * Vocab pipeline v2 - LEMMA BAZLI iki aşamalı anlam ayrımı (ücretsiz kotayla
 * ölçeklenir). Cümle-bazlı üretim BIRAKILDI (200 hikaye = 53k+ istek).
 *
 * Aşamalar (hepsi cache'li, kaldığı yerden devam eder):
 *   A Envanter  : spaCy annot -> her lemma|pos'un tüm geçişleri (deterministik, LLM yok).
 *   B Anlam env.: lemma|pos başına <=8 temsili cümle -> FARKLI anlamlar (LLM, 20 lemma/istek).
 *   C Sınıflandırma: tek anlamlı -> otomatik; çok anlamlı -> geçişler 40'lık paket, anlam no (LLM).
 *   D Çekim     : (senseId, tag) çiftleri; taban tag (VB/NN/JJ/RB) LLM'siz; diğerleri 50/istek.
 *   E Dosya     : content/v2/vocab/senses.json + {storyId}.json (token=[surface,index,tag]).
 *
 * content/ ve content/v2/stories'e DOKUNULMAZ. lib/gemini.mjs rotasyonu (Gemini öncelikli).
 *
 * Kullanım:
 *   node build-vocab.mjs inventory              # Aşama A: tüm annot, sayıları raporla
 *   node build-vocab.mjs build --stories a,b,c  # B..E, verilen hikayelerin lemma'ları için
 *   node build-vocab.mjs build --all            # B..E, 200 hikayenin tümü
 *   (--probe: başlangıçta anahtarları test et)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callGemini, parseJsonResponse, poolStatus, probeEndpoints } from '../lib/gemini.mjs';
import { inflect } from './tr-morph.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ANNOT_DIR = path.join(__dirname, 'cache', 'annot');
const CACHE_DIR = path.join(__dirname, 'cache');
const VOCAB_OUT_DIR = path.join(ROOT, 'content', 'v2', 'vocab');
const VOCAB_VERSION = 1;

const B_BATCH = 20;   // lemma / istek (anlam envanteri)
const C_BATCH = 40;   // cümle / istek (sınıflandırma)
const D_BATCH = 50;   // çift / istek (çekim)
const MAX_REPRESENTATIVE = 8;
const MAX_ATTEMPTS = 3;
const BASE_TAGS = new Set(['VB', 'NN', 'JJ', 'RB']); // gloss_tr aynen (çekimsiz)
// İşlev (function word) tag'leri: içerik kelimesi değil -> vocab hedefi DEĞİL
// (stopword filtresine takılmayanlar da buradan elenir; gloss undefined kalmasın).
const FUNCTION_TAGS = new Set([
  'IN', 'UH', 'RBR', 'RBS', 'CC', 'DT', 'TO', 'MD', 'PRP', 'PRP$',
  'WDT', 'WP', 'WP$', 'WRB', 'EX', 'PDT', 'RP', 'POS', 'LS', 'SYM', 'FW',
]);

fs.mkdirSync(VOCAB_OUT_DIR, { recursive: true });
for (const s of ['B', 'C', 'D']) fs.mkdirSync(path.join(CACHE_DIR, `stage-${s}`), { recursive: true });

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 20);

/**
 * SÜREÇ KURALI: senses.json DONDURULUR. Var olan lemma|pos için B yeniden
 * çağrılmaz (buradan yüklenir). Yeni lemma veya 0-dönen token için ek-tur B
 * çalışır ve MEVCUT listeye EKLER. Var olan senseId asla silinmez/yeniden
 * numaralanmaz. senses.json'un KENDİSİ referanstır (cache'ten bağımsız).
 */
function loadFrozenSenses() {
  const p = path.join(VOCAB_OUT_DIR, 'senses.json');
  if (!fs.existsSync(p)) return { byKey: new Map(), byId: new Map() };
  const arr = JSON.parse(fs.readFileSync(p, 'utf8')).senses || [];
  const byKey = new Map(); const byId = new Map();
  for (const s of arr) {
    byId.set(s.id, s);
    const key = `${s.lemma}\t${s.pos}`;
    const n = Number(s.id.split('|').pop());
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)[n - 1] = { def_en: s.def_en, gloss_tr: s.gloss_tr, example_en: s.example_en, forms: s.forms || {} };
  }
  return { byKey, byId };
}
const wc = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const lc = (s) => s.toLowerCase();

function cacheGet(stage, key) {
  const p = path.join(CACHE_DIR, `stage-${stage}`, `${sha1(key)}.json`);
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
  return null;
}
function cacheSet(stage, key, val) {
  fs.writeFileSync(path.join(CACHE_DIR, `stage-${stage}`, `${sha1(key)}.json`), JSON.stringify(val));
}

// ---- annot yükleme (memoize) + metin erişimi ----
const annotCache = new Map();
function loadAnnot(storyId) {
  if (annotCache.has(storyId)) return annotCache.get(storyId);
  const a = JSON.parse(fs.readFileSync(path.join(ANNOT_DIR, `${storyId}.json`), 'utf8'));
  // (level,p,s) -> text hızlı erişim
  a._text = {};
  for (const [lv, d] of Object.entries(a.levels)) for (const s of d.sentences) a._text[`${lv}:${s.p}:${s.s}`] = s.text;
  annotCache.set(storyId, a);
  return a;
}
const sentText = (o) => loadAnnot(o.storyId)._text[`${o.level}:${o.p}:${o.s}`] || '';

// ---- Aşama A: envanter ----
function buildInventory(storyIds) {
  const inv = new Map(); // "lemma\tpos" -> { lemma, pos, occ:[], tags:Set }
  let totalTarget = 0;
  for (const id of storyIds) {
    const a = loadAnnot(id);
    for (const [level, d] of Object.entries(a.levels)) {
      for (const sent of d.sentences) {
        sent.tokens.forEach((t, ti) => {
          if (t.is_stop || t.is_propn || t.is_num || FUNCTION_TAGS.has(t.tag)) return;
          totalTarget++;
          const key = `${t.lemma}\t${t.pos}`;
          let e = inv.get(key);
          if (!e) { e = { lemma: t.lemma, pos: t.pos, occ: [], tags: new Set() }; inv.set(key, e); }
          e.occ.push({ storyId: id, level, p: sent.p, s: sent.s, ti, surface: t.surface, tag: t.tag, dep: t.dep, aux: t.aux || [] });
          e.tags.add(t.tag);
        });
      }
    }
  }
  const pairCount = [...inv.values()].reduce((a, e) => a + e.tags.size, 0);
  return { inv, totalTarget, pairCount };
}

// ---- eşzamanlı çalıştırma (uç sayısına göre) ----
async function mapPool(items, worker, concurrency) {
  const out = new Array(items.length);
  let i = 0;
  const run = async () => { while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, run));
  return out;
}
const liveConcurrency = () => Math.max(2, poolStatus().filter((e) => !e.dead).length * 2);

// bir geçişin komşu kelime imzası (önceki|sonraki surface) - bağlam çeşitliliği için
function occNeighbor(o) {
  const a = loadAnnot(o.storyId);
  const sent = a.levels[o.level]?.sentences.find((x) => x.p === o.p && x.s === o.s);
  if (!sent) return '^|$';
  const prev = sent.tokens[o.ti - 1]?.surface || '^';
  const next = sent.tokens[o.ti + 1]?.surface || '$';
  return `${lc(prev)}|${lc(next)}`;
}

// ---- temsili cümle seçimi (<=MAX_REPRESENTATIVE) ----
// Öncelik sırası: farklı HİKAYE > farklı SEVİYE > cümle UZUNLUĞU kovası > komşu
// kelime çeşitliliği. Açgözlü: her turda en çok yeni boyut ekleyen geçiş seçilir.
// Lemma MAX'tan az farklı cümlede geçiyorsa hepsi döner.
function pickRepresentative(occ) {
  const seen = new Set(); const uniq = [];
  for (const o of occ) { const t = sentText(o).trim(); if (!t || seen.has(t)) continue; seen.add(t); uniq.push(o); }
  if (uniq.length <= MAX_REPRESENTATIVE) return uniq;
  const lenBucket = (o) => Math.min(6, Math.floor(wc(sentText(o)) / 5)); // 0..6
  const usedStory = new Set(), usedLevel = new Set(), usedLen = new Set(), usedNb = new Set();
  const picks = []; const pool = uniq.slice();
  while (picks.length < MAX_REPRESENTATIVE && pool.length) {
    let best = 0, bestScore = -1;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      const score =
        (usedStory.has(o.storyId) ? 0 : 8) +
        (usedLevel.has(o.level) ? 0 : 4) +
        (usedLen.has(lenBucket(o)) ? 0 : 2) +
        (usedNb.has(occNeighbor(o)) ? 0 : 1);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const o = pool.splice(best, 1)[0];
    usedStory.add(o.storyId); usedLevel.add(o.level); usedLen.add(lenBucket(o)); usedNb.add(occNeighbor(o));
    picks.push(o);
  }
  return picks;
}

const gateSense = (lemma, sn) => {
  if (!sn || typeof sn !== 'object') return 'yanıt yok';
  for (const f of ['def_en', 'gloss_tr', 'example_en']) if (typeof sn[f] !== 'string' || !sn[f].trim()) return `boş ${f}`;
  const gtr = lc(sn.gloss_tr.trim());
  if (gtr === lc(lemma)) return 'gloss_tr==EN';
  if (wc(sn.def_en) > 12) return 'def_en>12';
  if (wc(sn.example_en) > 15) return 'example_en>15';
  if (!lc(sn.example_en).includes(lc(lemma))) return 'example lemma yok';
  return null;
};

// ---- Aşama B: anlam envanteri ----
// bir lemma'nın katalogdaki farklı (benzersiz) cümle sayısı
function uniqSentCount(e) {
  const seen = new Set();
  for (const o of e.occ) { const t = sentText(o).trim(); if (t) seen.add(t); }
  return seen.size;
}
function bPrompt(batch) {
  const blocks = batch.map((e, i) => {
    const x = uniqSentCount(e);
    const ex = pickRepresentative(e.occ).map((o) => `   - "${sentText(o)}"`).join('\n');
    return `${i + 1}) ${e.lemma} (${e.pos}) — bu kelime katalogda ${x} farklı cümlede geçiyor, aşağıdakiler temsili örnek:\n${ex}`;
  }).join('\n');
  return `Aşağıdaki her İngilizce kelime için, SADECE verilen örnek cümlelerde GÖRÜNEN farklı anlamları listele (sözlükteki tüm anlamları DEĞİL). Örnekler arasında anlam farkı yoksa TEK anlam ver.
Her anlam için:
- def_en: bu anlamın İngilizce tanımı, EN FAZLA 12 kelime.
- gloss_tr: Türkçe karşılığın sözlük hali (fiil=mastar, isim=yalın).
- example_en: bu anlamı gösteren YENİ, kısa (A2), EN FAZLA 15 kelime, kelimeyi İÇEREN örnek cümle.
Kelime bir deyim/phrasal verb parçasıysa def_en'de belirt. gloss_tr İngilizce kelimeyle aynı OLAMAZ.

Kelimeler:
${blocks}

SADECE şu JSON'u döndür, sıra kelime sırasıyla aynı:
{"items":[{"lemma":"","pos":"","senses":[{"def_en":"","gloss_tr":"","example_en":""}]}]}`;
}

async function stageB(keys, invMap, stats, frozen) {
  // key -> [{def_en,gloss_tr,example_en}] (kapıdan geçmiş)
  const senseMap = new Map();
  const todo = [];
  for (const key of keys) {
    // DONDURULMUŞ lemma: senses.json'dan yükle, B'yi ÇAĞIRMA (süreç kuralı).
    if (frozen?.byKey.has(key)) { senseMap.set(key, frozen.byKey.get(key)); stats.bFrozen++; continue; }
    const e = invMap.get(key);
    const cacheKey = `B:${key}:${pickRepresentative(e.occ).map((o) => sentText(o)).join('|')}`;
    const cached = cacheGet('B', cacheKey);
    if (cached) { senseMap.set(key, cached); stats.bCache++; } else todo.push({ key, e, cacheKey });
  }
  const batches = [];
  for (let i = 0; i < todo.length; i += B_BATCH) batches.push(todo.slice(i, i + B_BATCH));

  await mapPool(batches, async (batch) => {
    let pending = batch.slice();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
      stats.bRequests++;
      let items = [];
      try {
        const raw = await callGemini(bPrompt(pending.map((x) => x.e)), { json: true });
        items = parseJsonResponse(raw)?.items || [];
      } catch { stats.bErrors++; if (attempt === MAX_ATTEMPTS) break; continue; }
      const next = [];
      pending.forEach((x, idx) => {
        const it = items[idx] || items.find((m) => lc(m?.lemma || '') === lc(x.e.lemma));
        const senses = Array.isArray(it?.senses) ? it.senses.filter((sn) => !gateSense(x.e.lemma, sn)) : [];
        if (senses.length === 0) { next.push(x); if (attempt === MAX_ATTEMPTS) { stats.bNull++; stats.bNullList.push(x.key.replace('\t', '|')); } }
        else { senseMap.set(x.key, senses); cacheSet('B', x.cacheKey, senses); }
      });
      pending = next;
    }
  }, liveConcurrency());
  return senseMap;
}

// ---- Aşama C: sınıflandırma ----
function cPrompt(lemma, pos, senses, sents) {
  const sl = senses.map((sn, i) => `${i + 1}) ${sn.gloss_tr} — ${sn.def_en}`).join('\n');
  const ql = sents.map((t, i) => `${i + 1}. "${t}"`).join('\n');
  return `Kelime: ${lemma} (${pos}). Olası anlamlar:
${sl}
Aşağıdaki her cümlede "${lemma}" hangi anlamda kullanılmış? Sadece anlam NUMARASINI ver; hiçbiri uymuyorsa 0.
Cümleler:
${ql}
SADECE JSON, cümle sırasına göre: {"answers":[1,2,0]}`;
}

async function stageC(keys, invMap, senseMap, stats, target) {
  // Yalnız HEDEF hikayelerin geçişleri sınıflandırılır (B temsili cümleleri tüm
  // katalogdan alır; ama vocab dosyası yalnız hedef hikayeler için üretilir).
  const occOf = (e) => e.occ.filter((o) => target.has(o.storyId));
  // her occ'a senseIndex (1..k) atanır; senseId sonra kurulur
  const multi = [];
  for (const key of keys) {
    const senses = senseMap.get(key);
    const e = invMap.get(key);
    const tocc = occOf(e);
    if (!senses) { for (const o of tocc) o.senseN = 0; continue; } // B başarısız -> yok
    if (senses.length === 1) { for (const o of tocc) o.senseN = 1; stats.cAuto += tocc.length; continue; }
    multi.push({ key, e, senses, tocc });
  }

  const classifyBatches = (list) => {
    const jobs = [];
    for (const m of list) for (let i = 0; i < m.tocc.length; i += C_BATCH) jobs.push({ m, slice: m.tocc.slice(i, i + C_BATCH) });
    return jobs;
  };

  const runJobs = async (jobs, isExtra) => {
    await mapPool(jobs, async (job) => {
      const { m, slice } = job;
      const cacheKey = `C:${m.key}:${m.senses.length}:${slice.map((o) => sentText(o)).join('|')}`;
      let answers = cacheGet('C', cacheKey);
      if (!answers) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          stats.cRequests++;
          try {
            const raw = await callGemini(cPrompt(m.e.lemma, m.e.pos, m.senses, slice.map((o) => sentText(o))), { json: true });
            const a = parseJsonResponse(raw)?.answers;
            if (Array.isArray(a) && a.length === slice.length) { answers = a; break; }
          } catch { stats.cErrors++; }
          if (attempt === MAX_ATTEMPTS) answers = slice.map(() => 0);
        }
        cacheSet('C', cacheKey, answers);
      }
      slice.forEach((o, i) => {
        let n = Number(answers[i]) || 0;
        if (n < 0 || n > m.senses.length) n = 0;
        o.senseN = n;
        if (n === 0 && !isExtra) stats.cZero++;
      });
    }, liveConcurrency());
  };

  await runJobs(classifyBatches(multi), false);

  // 0 dönen lemmalar için ek B turu (BATCH'li, Düzeltme 3), sonra sadece 0'ları yeniden sınıfla
  const needExtra = multi.filter((m) => m.tocc.some((o) => o.senseN === 0));
  if (needExtra.length) {
    stats.extraLemmas = needExtra.length;
    // her lemma için 0-dönen cümlelerden <=5 temsili + MEVCUT anlam listesi
    const items = needExtra.map((m) => ({
      m,
      lemma: m.e.lemma,
      pos: m.e.pos,
      existing: m.senses,
      sents: pickRepresentative(m.tocc.filter((o) => o.senseN === 0)).map((o) => sentText(o)),
    }));
    const exBatches = [];
    for (let i = 0; i < items.length; i += B_BATCH) exBatches.push(items.slice(i, i + B_BATCH));
    await mapPool(exBatches, async (batch) => {
      const cacheKey = `Bx2:${batch.map((x) => `${x.lemma}|${x.pos}|${x.sents.join('~')}`).join('||')}`;
      let out = cacheGet('B', cacheKey);
      if (!out) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          stats.bRequests++;
          try {
            const raw = await callGemini(bExtraPrompt(batch), { json: true });
            const arr = parseJsonResponse(raw)?.items;
            if (Array.isArray(arr)) { out = arr; break; }
          } catch { stats.bErrors++; }
          if (attempt === MAX_ATTEMPTS) out = [];
        }
        cacheSet('B', cacheKey, out || []);
      }
      batch.forEach((x, idx) => {
        const it = out[idx] || out.find((o) => lc(o?.lemma || '') === lc(x.lemma));
        const fresh = Array.isArray(it?.new_senses) ? it.new_senses.filter((sn) => !gateSense(x.lemma, sn)) : [];
        if (fresh.length) x.m.senses = x.m.senses.concat(fresh); // yeni anlamlar sona
      });
    }, liveConcurrency());

    // sadece 0'ları içeren yeni işler (genişlemiş anlam listesiyle 2. tur)
    const extraJobs = [];
    for (const m of needExtra) {
      const zeros = m.tocc.filter((o) => o.senseN === 0);
      for (let i = 0; i < zeros.length; i += C_BATCH) extraJobs.push({ m, slice: zeros.slice(i, i + C_BATCH) });
    }
    await runJobs(extraJobs, true);
  }

  // Düzeltme 2: SESSİZ fallback YOK. Hâlâ 0 kalan -> birincil anlam (1) AMA DÜŞÜK
  // GÜVEN işaretlenir (o.lowConf=true -> token 4. eleman=1). App ML Kit'e düşebilir.
  for (const m of multi) for (const o of m.tocc) if (o.senseN === 0) { o.senseN = 1; o.lowConf = true; stats.cLowConf++; }

  // senseId ata (yalnız hedef geçişlere)
  const idFor = (key, n) => { const [lemma, pos] = key.split('\t'); return `${lemma}|${pos}|${n}`; };
  for (const key of keys) {
    const senses = senseMap.get(key); const e = invMap.get(key);
    if (!senses) continue;
    const m = multi.find((x) => x.key === key);
    if (m) senseMap.set(key, m.senses); // çok anlamlıysa ek-turlu güncel senses
    for (const o of occOf(e)) o.senseId = o.senseN > 0 ? idFor(key, o.senseN) : null;
  }
}

// ek-tur B: mevcut anlamları göster, SADECE eksik anlamı ekle (Düzeltme 3)
function bExtraPrompt(batch) {
  const blocks = batch.map((x, i) => {
    const ex = x.existing.map((s, j) => `   ${j + 1}) ${s.gloss_tr} — ${s.def_en}`).join('\n');
    const ss = x.sents.map((t) => `   - "${t}"`).join('\n');
    return `${i + 1}) ${x.lemma} (${x.pos})\n  MEVCUT ANLAMLAR:\n${ex}\n  YENİ CÜMLELER:\n${ss}`;
  }).join('\n\n');
  return `Her İngilizce kelime için MEVCUT anlam listesi verildi. Aşağıdaki YENİ cümlelerde mevcut listede OLMAYAN bir anlam kullanılıyorsa SADECE o eksik anlam(lar)ı ekle. Mevcut anlamları TEKRARLAMA; yeni anlam yoksa boş dizi döndür.
Her yeni anlam için: def_en (max 12 kelime), gloss_tr (Türkçe sözlük hali), example_en (A2, max 15 kelime, kelimeyi içeren).

${blocks}

SADECE JSON, sıra kelime sırasıyla: {"items":[{"lemma":"","pos":"","new_senses":[{"def_en":"","gloss_tr":"","example_en":""}]}]}`;
}

// ---- Aşama D: çekimli karşılık - KURAL TABANLI (LLM YOK, tr-morph.mjs) ----
function stageD(keys, invMap, senseMap, senseObj, stats) {
  // (senseId, tag) -> temsili bağlam. Aynı çift farklı bağlamlarda geçebilir;
  // forms tag başına tek değer tutar -> aux'lu (be/have) bağlamı yeğle (kanonik).
  const pairs = new Map();
  for (const key of keys) {
    const e = invMap.get(key); const senses = senseMap.get(key); if (!senses) continue;
    const [, pos] = key.split('\t');
    for (const o of occOf(e)) {
      if (!o.senseId) continue;
      const n = Number(o.senseId.split('|').pop());
      const sn = senses[n - 1]; if (!sn) continue;
      const pk = `${o.senseId}|${o.tag}`;
      if (!pairs.has(pk)) pairs.set(pk, { senseId: o.senseId, tag: o.tag, pos, gloss_tr: sn.gloss_tr, dep: o.dep, aux: o.aux || [] });
      else { const ex = pairs.get(pk); if ((ex.aux?.length ?? 0) === 0 && (o.aux?.length ?? 0) > 0) { ex.dep = o.dep; ex.aux = o.aux; } }
    }
  }
  stats.dPairs = pairs.size;
  for (const pr of pairs.values()) {
    if (BASE_TAGS.has(pr.tag)) { setForm(senseObj, pr.senseId, pr.tag, pr.gloss_tr); stats.dBase++; continue; }
    const form = inflect(pr.gloss_tr, pr.pos, pr.tag, { dep: pr.dep, aux: pr.aux });
    if (!form || lc(form) === lc(pr.gloss_tr)) {
      // Kural çekim üretemedi (gloss düzgün mastar değil vb.) -> forms'a yazma, raporla.
      stats.dFails.push({ pos: pr.pos, tag: pr.tag, gloss_tr: pr.gloss_tr });
    } else { setForm(senseObj, pr.senseId, pr.tag, form); stats.dWritten++; }
  }
}
function occOf(e, target) { return target ? e.occ.filter((o) => target.has(o.storyId)) : e.occ; }
function setForm(senseObj, senseId, tag, val) {
  const sn = senseObj.get(senseId); if (!sn) return;
  sn.forms = sn.forms || {}; sn.forms[tag] = val;
}

// ---- Aşama E: dosya üretimi ----
function stageE(storyIds, keys, invMap, senseMap, senseObj, stats, frozen) {
  // Yayınlanacak senseId'ler = bu koşuda referans edilenler ∪ DONDURULMUŞ tümü
  // (süreç kuralı: var olan senseId asla düşmez). Her id senseObj'den, yoksa
  // dondurulmuş senses.json'dan çözülür.
  const usedIds = new Set();
  for (const key of keys) { const e = invMap.get(key); for (const o of e.occ) if (o.senseId) usedIds.add(o.senseId); }
  for (const id of frozen?.byId.keys() ?? []) usedIds.add(id);
  let dropped = 0;
  const senseArr = [...usedIds].sort().map((id) => {
    const sn = senseObj.get(id);
    if (sn) return { id, lemma: sn.lemma, pos: sn.pos, def_en: sn.def_en, gloss_tr: sn.gloss_tr, example_en: sn.example_en, forms: sn.forms || {} };
    const fz = frozen?.byId.get(id);
    if (fz) return fz; // bu koşuda dokunulmayan dondurulmuş anlam aynen korunur
    dropped++; return null; // çözülemeyen id (nadir): token -1'e düşer, çökme yok
  }).filter(Boolean);
  stats.droppedIds = dropped;
  const idIndex = new Map(senseArr.map((s, i) => [s.id, i]));

  fs.writeFileSync(path.join(VOCAB_OUT_DIR, 'senses.json'),
    JSON.stringify({ vocabVersion: VOCAB_VERSION, senses: senseArr }));
  stats.sensesFileBytes = fs.statSync(path.join(VOCAB_OUT_DIR, 'senses.json')).size;
  stats.senseCount = senseArr.length;

  // occ -> {senseId, lowConf} hızlı erişim: storyId:level:p:s:ti
  const occId = new Map();
  for (const key of keys) { const e = invMap.get(key); for (const o of e.occ) if (o.senseId) occId.set(`${o.storyId}:${o.level}:${o.p}:${o.s}:${o.ti}`, { sid: o.senseId, low: !!o.lowConf }); }

  const READY_MAX_LOWCONF = 0.02; // Düzeltme 2: hikaye başına düşük güven oranı bu üstündeyse yayına GİRMEZ
  stats.ready = []; stats.notReady = [];
  for (const storyId of storyIds) {
    const a = loadAnnot(storyId);
    const outLevels = {};
    let target = 0, low = 0;
    for (const [level, d] of Object.entries(a.levels)) {
      const sentences = d.sentences.map((sent) => ({
        p: sent.p, s: sent.s,
        tokens: sent.tokens.map((t, ti) => {
          if (t.is_stop || t.is_propn || t.is_num || FUNCTION_TAGS.has(t.tag)) return [t.surface, -1, t.tag];
          target++;
          const rec = occId.get(`${storyId}:${level}:${sent.p}:${sent.s}:${ti}`);
          const idx = rec && idIndex.has(rec.sid) ? idIndex.get(rec.sid) : -1;
          // Düşük güven -> 4. eleman = 1 (opsiyonel); app ML Kit'e düşmek için kullanır.
          if (rec && rec.low && idx !== -1) { low++; return [t.surface, idx, t.tag, 1]; }
          return [t.surface, idx, t.tag];
        }),
      }));
      outLevels[level] = { sentences };
    }
    const outPath = path.join(VOCAB_OUT_DIR, `${storyId}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ storyId, vocabVersion: VOCAB_VERSION, levels: outLevels }));
    const ratio = target ? low / target : 0;
    const rec = { storyId, bytes: fs.statSync(outPath).size, target, lowConf: low, lowConfPct: +(ratio * 100).toFixed(2) };
    stats.storyFiles.push(rec);
    (ratio > READY_MAX_LOWCONF ? stats.notReady : stats.ready).push(storyId);
  }
}

// ---- orkestrasyon ----
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const doProbe = rest.includes('--probe');

  if (cmd === 'inventory') {
    const ids = fs.readdirSync(ANNOT_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
    const { inv, totalTarget, pairCount } = buildInventory(ids);
    const polys = [...inv.values()].filter((e) => e.occ.length > 1).length;
    console.log('=== AŞAMA A ENVANTER (200 hikaye) ===');
    console.log('hikaye:', ids.length);
    console.log('benzersiz lemma|pos:', inv.size);
    console.log('benzersiz (lemma|pos, tag) çifti:', pairCount);
    console.log('toplam hedef token:', totalTarget);
    const rep = { stories: ids.length, uniqueLemmaPos: inv.size, uniquePairs: pairCount, totalTarget };
    fs.writeFileSync(path.join(CACHE_DIR, 'inventory-stats.json'), JSON.stringify(rep, null, 2));
    return;
  }

  if (cmd === 'diagnose') {
    // C ÖNCESİ TEŞHİS: yeni B anlam dağılımı + eski koşuda sınıflandırılamayan
    // (lowConf/0-dönen) token'lar, yeni B anlam listeleriyle yan yana. C BAŞLATMAZ.
    const allIds = fs.readdirSync(ANNOT_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
    const { inv } = buildInventory(allIds);
    const senseFromCache = (key) => {
      const e = inv.get(key); if (!e) return null;
      const ck = `B:${key}:${pickRepresentative(e.occ).map((o) => sentText(o)).join('|')}`;
      return cacheGet('B', ck);
    };
    // yeni B anlam sayısı dağılımı (cache'i olan lemma|pos üzerinden)
    const dist = { 1: 0, 2: 0, 3: 0, '4+': 0, none: 0 };
    let totalSenses = 0, withCache = 0;
    for (const key of inv.keys()) {
      const s = senseFromCache(key);
      if (s === null) continue;
      withCache++;
      if (!s.length) { dist.none++; continue; }
      totalSenses += s.length;
      dist[s.length >= 4 ? '4+' : s.length]++;
    }
    // eski koşuda sınıflandırılamayan token'lar = pilot dosyalarında lowConf (4. eleman=1)
    const pilotIds = ['st-0001', 'st-0004', 'st-0150'];
    const zeros = [];
    for (const sid of pilotIds) {
      const vpath = path.join(VOCAB_OUT_DIR, `${sid}.json`);
      if (!fs.existsSync(vpath)) continue;
      const v = JSON.parse(fs.readFileSync(vpath, 'utf8'));
      const a = loadAnnot(sid);
      for (const [level, d] of Object.entries(v.levels)) {
        for (const sent of d.sentences) {
          sent.tokens.forEach((tok, ti) => {
            if (!Array.isArray(tok) || tok.length < 4 || tok[3] !== 1) return;
            const asent = a.levels[level]?.sentences.find((x) => x.p === sent.p && x.s === sent.s);
            const at = asent?.tokens[ti]; if (!at) return;
            const key = `${at.lemma}\t${at.pos}`;
            zeros.push({
              storyId: sid, level, surface: tok[0], lemma: at.lemma, pos: at.pos, tag: at.tag,
              sentence: sentText({ storyId: sid, level, p: sent.p, s: sent.s }),
              newSenses: (senseFromCache(key) || []).map((s) => `${s.gloss_tr} — ${s.def_en}`),
            });
          });
        }
      }
    }
    for (let i = zeros.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [zeros[i], zeros[j]] = [zeros[j], zeros[i]]; }
    const sample = zeros.slice(0, 30);
    const out = { senseDist: dist, totalSenses, keysWithCache: withCache, zeroTotal: zeros.length, sampleCount: sample.length, sample };
    fs.writeFileSync(path.join(CACHE_DIR, 'diagnose.json'), JSON.stringify(out, null, 2));
    console.log('=== C ÖNCESİ TEŞHİS ===');
    console.log('yeni B anlam dağılımı:', JSON.stringify(dist), '| toplam anlam:', totalSenses, '| cache lemma|pos:', withCache);
    console.log('eski sınıflandırılamayan token:', zeros.length, '-> örnek', sample.length, 'yazıldı ->', path.join(CACHE_DIR, 'diagnose.json'));
    return;
  }

  if (cmd !== 'build') { console.error('kullanım: build-vocab.mjs inventory | build [--all|--stories a,b,c] [--only-b] | diagnose'); process.exit(1); }

  if (doProbe) {
    console.log('anahtarlar test ediliyor (preflight)...');
    const res = await probeEndpoints();
    for (const r of res) console.log(`  ${r.ok ? 'OK ' : 'X  '} ${r.id}${r.reason ? ' (' + r.reason + ')' : ''}`);
  }

  const allIds = fs.readdirSync(ANNOT_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
  let storyIds;
  const sIdx = rest.indexOf('--stories');
  if (rest.includes('--all')) storyIds = allIds;
  else if (sIdx >= 0 && rest[sIdx + 1]) storyIds = rest[sIdx + 1].split(',').map((s) => s.trim());
  else { console.error('--stories a,b,c ya da --all gerekli'); process.exit(1); }

  const onlyB = rest.includes('--only-b');
  const started = Date.now();
  // DONDURMA yalnız yayından SONRA: senses.json CDN'e çıkınca PUBLISHED_VERSION
  // tanımlanır ve var olan anlamlar korunur. Tanımlı değilse tam yeniden kurulum
  // serbest (yayın öncesi). Bkz. README "Dondurma".
  const frozen = process.env.PUBLISHED_VERSION
    ? loadFrozenSenses()
    : { byKey: new Map(), byId: new Map() };
  const stats = {
    bRequests: 0, bErrors: 0, bCache: 0, bNull: 0, bNullList: [], bFrozen: 0,
    cRequests: 0, cErrors: 0, cAuto: 0, cZero: 0, cLowConf: 0, extraLemmas: 0,
    dRequests: 0, dErrors: 0, dBase: 0, dPairs: 0, dNeedLLM: 0, dWritten: 0, dFails: [],
    storyFiles: [], senseCount: 0, sensesFileBytes: 0, ready: [], notReady: [],
  };

  // A: envanter TÜM katalogdan (temsili cümleler her yerden gelebilsin)
  const { inv } = buildInventory(allIds);
  // işlenecek lemma anahtarları: pilot hikayelerde geçen lemma|pos
  const pilotSet = new Set(storyIds);
  const keys = [...inv.keys()].filter((k) => inv.get(k).occ.some((o) => pilotSet.has(o.storyId)));
  console.log(`işlenecek lemma|pos: ${keys.length} (hedef hikayeler: ${storyIds.join(', ')})`);

  console.log(`Aşama B (anlam envanteri)... dondurulmuş senses.json: ${frozen.byId.size} anlam`);
  const senseMap = await stageB(keys, inv, stats, frozen);
  console.log(`  B bitti: ${stats.bRequests} istek, ${stats.bCache} cache, ${stats.bFrozen} dondurulmuş, ${stats.bNull} lemma anlamsız`);

  if (onlyB) {
    // Anlam sayısı dağılımı (kaç lemma 1/2/3/4+ anlam)
    const dist = { 1: 0, 2: 0, 3: 0, '4+': 0, none: 0 };
    let totalSenses = 0;
    for (const key of keys) {
      const s = senseMap.get(key);
      if (!s || s.length === 0) { dist.none++; continue; }
      totalSenses += s.length;
      dist[s.length >= 4 ? '4+' : s.length]++;
    }
    stats.senseDist = dist;
    stats.totalSenses = totalSenses;
    stats.keysProcessed = keys.length;
    stats.durationSec = ((Date.now() - started) / 1000).toFixed(1);
    stats.poolUsed = poolStatus().filter((e) => e.calls > 0);
    fs.writeFileSync(path.join(CACHE_DIR, 'b-stats.json'), JSON.stringify(stats, null, 2));
    console.log('\n=== AŞAMA B (yalnız) ÖZET ===');
    console.log('lemma|pos:', keys.length, '| toplam anlam:', totalSenses, '| null (anlamsız):', stats.bNull);
    console.log('anlam dağılımı:', JSON.stringify(dist));
    console.log('B istek:', stats.bRequests, '| hata:', stats.bErrors, '| cache:', stats.bCache, '| süre:', stats.durationSec, 'sn');
    console.log('uçlar:', stats.poolUsed.map((e) => `${e.id}(${e.calls}${e.dead ? ',ölü' : ''})`).join(', '));
    console.log('istatistik ->', path.join(CACHE_DIR, 'b-stats.json'));
    return;
  }

  console.log('Aşama C (sınıflandırma)...');
  await stageC(keys, inv, senseMap, stats, pilotSet);
  console.log(`  C bitti: ${stats.cRequests} istek, otomatik(tek anlam) token: ${stats.cAuto}, 0-dönen: ${stats.cZero}, ek-tur lemma: ${stats.extraLemmas}, düşük-güven: ${stats.cLowConf}`);

  // senseObj: senseId -> {lemma,pos,def_en,gloss_tr,example_en,forms}
  const senseObj = new Map();
  for (const key of keys) {
    const senses = senseMap.get(key); if (!senses) continue;
    const [lemma, pos] = key.split('\t');
    // for-döngü (forEach seyrek dizi DELİKLERİNİ atlar; frozen dizide delik olabilir)
    for (let i = 0; i < senses.length; i++) {
      const sn = senses[i]; if (!sn) continue;
      senseObj.set(`${lemma}|${pos}|${i + 1}`, { lemma, pos, def_en: (sn.def_en || '').trim(), gloss_tr: (sn.gloss_tr || '').trim(), example_en: (sn.example_en || '').trim() });
    }
  }

  console.log('Aşama D (çekimli karşılık - KURAL tabanlı, LLM yok)...');
  stageD(keys, inv, senseMap, senseObj, stats);
  console.log(`  D bitti (KURAL): çift ${stats.dPairs}, taban-tag ${stats.dBase}, çekilen ${stats.dWritten}, üretilemeyen ${stats.dFails.length}`);

  console.log('Aşama E (dosya üretimi)...');
  stageE(storyIds, keys, inv, senseMap, senseObj, stats, frozen);

  stats.durationSec = ((Date.now() - started) / 1000).toFixed(1);
  stats.totalRequests = stats.bRequests + stats.cRequests + stats.dRequests;
  stats.poolUsed = poolStatus().filter((e) => e.calls > 0);
  fs.writeFileSync(path.join(CACHE_DIR, 'build-stats.json'), JSON.stringify(stats, null, 2));

  console.log('\n=== ÖZET (yeni pipeline) ===');
  console.log('lemma|pos işlendi:', keys.length, '| üretilen sense:', stats.senseCount);
  console.log('LLM isteği TOPLAM:', stats.totalRequests, `(B=${stats.bRequests} C=${stats.cRequests}; D=KURAL, LLM yok)`);
  console.log('senses.json:', (stats.sensesFileBytes / 1024).toFixed(1), 'KB | hikaye dosyaları:', stats.storyFiles.map((f) => `${f.storyId}=${(f.bytes / 1024).toFixed(1)}KB(düşük-güven %${f.lowConfPct})`).join(', '));
  console.log('D FAIL (forms yazılmadı):', stats.dFails.length, stats.dFails.length ? '(ör. ' + stats.dFails.slice(0, 5).map((x) => `${x.lemma}/${x.tag}`).join(', ') + ')' : '');
  console.log('yayına hazır:', stats.ready.join(', ') || '-', '| hazır DEĞİL (>%2 düşük güven):', stats.notReady.join(', ') || '-');
  console.log('süre:', stats.durationSec, 'sn');
  console.log('kullanılan uçlar:', stats.poolUsed.map((e) => `${e.id}(${e.calls})`).join(', '));
  console.log('istatistik ->', path.join(CACHE_DIR, 'build-stats.json'));
}

main().catch((e) => { console.error(e); process.exit(1); });
