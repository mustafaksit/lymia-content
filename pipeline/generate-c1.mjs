#!/usr/bin/env node
/**
 * C1 seviye üretimi (v2 Faz 1). Mevcut bir hikayenin B2 metnini alır ve aynı
 * olay örgüsünü koruyan, daha edebi ve daha uzun (1000-1700 kelime) bir C1
 * versiyonuna GENİŞLETİR. Kendi 3 soruluk quiz'ini üretir. Sonucu
 * story.levels.C1 olarak yazar (ses fazı ayrı; audio alanları null başlar).
 *
 * Üretim anında doğrular ve gerekirse tekrar dener:
 *   - schema (paragraphs dolu, 3x3 quiz, cevap 0-2)
 *   - kelime sayısı >= 1000
 *   - Tier 1 içerik güvenliği (4+ uygunluk) temiz
 * Seviye-kuralı sapmaları (kapsam/uzun cümle) audit'te uyarı olarak görülür.
 *
 * Kullanım:
 *   node pipeline/generate-c1.mjs --story content/stories/st-0001.json
 *   node pipeline/generate-c1.mjs --limit 10           # C1'i olmayan ilk 10
 *   node pipeline/generate-c1.mjs --ids st-0001,st-0002
 *   node pipeline/generate-c1.mjs --force --story ...  # C1 varsa da yeniden üret
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STORIES_DIR, loadEnv } from './lib/env.mjs';
import { callGemini, parseJsonResponse } from './lib/gemini.mjs';
import { ALL_LEVELS, LEVEL_RULES } from './lib/levels.mjs';
import { scanStory } from './lib/content-safety.mjs';
import { tokenizeWords } from './lib/tokenize.mjs';

loadEnv();

const RULE = LEVEL_RULES.C1;
const TARGET_WORDS = 1300;
const MAX_TRIES = 5;
const PROMPT_PATH = new URL('./prompts/story-c1.txt', import.meta.url);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Prompt şablonunda karşılıksız alan: ${key}`);
    return String(values[key]);
  });
}

/** Plain text of a level (paragraph sentences joined). */
function levelPlainText(levelData) {
  return levelData.paragraphs
    .map((p) => p.sentences.map((s) => s.text).join(' '))
    .join('\n\n');
}

function countWords(paragraphs) {
  let n = 0;
  for (const sentences of paragraphs) {
    for (const text of sentences) n += tokenizeWords(String(text)).length;
  }
  return n;
}

/** Shape check on the raw LLM object. Returns error string or null. */
function schemaError(data) {
  if (!Array.isArray(data.paragraphs) || data.paragraphs.length === 0) return 'paragraphs boş';
  for (const p of data.paragraphs) {
    if (!Array.isArray(p) || p.length === 0 || !p.every((s) => typeof s === 'string' && s.trim())) {
      return 'paragraph bir cümle dizisi olmalı';
    }
  }
  if (!Array.isArray(data.quiz) || data.quiz.length !== 3) return 'tam 3 quiz gerekli';
  for (const q of data.quiz) {
    if (typeof q.q !== 'string' || !q.q.trim()) return 'quiz sorusu boş';
    if (!Array.isArray(q.options) || q.options.length !== 3) return 'quiz 3 şık olmalı';
    if (!q.options.every((o) => typeof o === 'string' && o.trim())) return 'boş şık';
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 2) return 'cevap 0-2 olmalı';
  }
  return null;
}

/** Builds a C1 levelData object (audio filled in a later phase). */
function toC1LevelData(data) {
  return {
    paragraphs: data.paragraphs.map((sentences) => ({
      sentences: sentences.map((text) => ({ text: String(text).trim(), audioStart: 0, audioEnd: 0 })),
    })),
    audio: null,
    wordTimings: null,
    quiz: data.quiz,
  };
}

/** Reorders levels to the canonical ladder so C1 sits last. */
function reorderLevels(levels) {
  const ordered = {};
  for (const lvl of ALL_LEVELS) if (levels[lvl]) ordered[lvl] = levels[lvl];
  return ordered;
}

/** Generates one C1 level for a story object (mutates story.levels.C1). */
async function generateC1(story) {
  const template = readFileSync(PROMPT_PATH, 'utf8');
  const base = story.levels.B2 ?? story.levels.B1 ?? story.levels.A2 ?? story.levels.A1;
  if (!base) throw new Error('kaynak seviye (B2) yok');
  const b2Text = levelPlainText(base);

  // Fallback: if no attempt lands in [minWords, maxWords], accept the valid,
  // safe candidate closest to target as long as it is not absurdly long.
  const FALLBACK_MAX = Math.round(RULE.maxWords * 1.12); // ~1900

  let extra = '';
  let lastIssue = '';
  let best = null; // { data, words }
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const prompt =
      fillTemplate(template, {
        genre: story.genre,
        title: story.title,
        b2Text,
        minWords: RULE.minWords,
        maxWords: RULE.maxWords,
        targetWords: TARGET_WORDS,
        maxSentenceWords: RULE.maxSentenceWords,
      }) + extra;

    let data;
    try {
      data = parseJsonResponse(await callGemini(prompt, { json: true }));
    } catch (e) {
      lastIssue = `JSON parse: ${e.message.slice(0, 60)}`;
      extra = `\n\nÖNEMLİ: Yanıtın SADECE geçerli JSON olsun.`;
      continue;
    }

    const schemaIssue = schemaError(data);
    if (schemaIssue) {
      lastIssue = `schema: ${schemaIssue}`;
      extra = `\n\nÖNCEKI DENEME HATASI: ${schemaIssue}. Tam olarak istenen JSON şeklini döndür.`;
      continue;
    }

    // Tier 1 content safety — a candidate with unsafe content is unusable.
    const probe = { ...story, levels: { C1: toC1LevelData(data) } };
    const { tier1 } = scanStory(probe);
    if (tier1.length > 0) {
      const terms = [...new Set(tier1.map((h) => h.matched))].join(', ');
      lastIssue = `tier1 içerik: ${terms}`;
      extra = `\n\nÖNCEKI DENEMEDE 4+ İÇİN UYGUNSUZ KELİME(LER) VARDI: ${terms}. Bunları kaldır, hikayeyi temiz tut.`;
      continue;
    }

    const words = countWords(data.paragraphs);
    // Track the safe candidate closest to target for the fallback.
    if (!best || Math.abs(words - TARGET_WORDS) < Math.abs(best.words - TARGET_WORDS)) {
      best = { data, words };
    }

    if (words < RULE.minWords) {
      lastIssue = `çok kısa: ${words} < ${RULE.minWords}`;
      extra = `\n\nÖNCEKI DENEME ÇOK KISAYDI (${words} kelime). ${RULE.minWords}-${RULE.maxWords} arası, hedef ${TARGET_WORDS} kelime yaz; sahneleri daha derin işle.`;
      continue;
    }
    if (words > RULE.maxWords) {
      lastIssue = `çok uzun: ${words} > ${RULE.maxWords}`;
      extra = `\n\nÖNCEKI DENEME ÇOK UZUNDU (${words} kelime). ${RULE.maxWords} kelimeyi GEÇME; hedef ${TARGET_WORDS}. Nesri sıkılaştır, sahne ekleme, cümle/paragraf TEKRAR ETME.`;
      continue;
    }

    story.levels.C1 = toC1LevelData(data);
    story.levels = reorderLevels(story.levels);
    return { ok: true, words, attempts: attempt };
  }

  // No in-band attempt; use the closest safe candidate if it is reasonable.
  if (best && best.words >= RULE.minWords && best.words <= FALLBACK_MAX) {
    story.levels.C1 = toC1LevelData(best.data);
    story.levels = reorderLevels(story.levels);
    return { ok: true, words: best.words, attempts: MAX_TRIES, fallback: true };
  }
  return { ok: false, issue: lastIssue };
}

function selectStories(args) {
  let files = readdirSync(STORIES_DIR)
    .filter((f) => /^st-\d{4}\.json$/.test(f))
    .sort();

  if (typeof args.story === 'string') {
    files = [path.basename(args.story)];
  } else if (typeof args.ids === 'string') {
    const ids = new Set(args.ids.split(',').map((s) => s.trim()));
    files = files.filter((f) => ids.has(f.replace('.json', '')));
  }

  const out = [];
  for (const f of files) {
    const p = path.join(STORIES_DIR, f);
    const story = JSON.parse(readFileSync(p, 'utf8'));
    if (story.levels?.C1 && !args.force) continue; // idempotent skip
    out.push({ path: p, story });
  }
  const limit = args.limit ? Number(args.limit) : Infinity;
  return out.slice(0, limit);
}

async function main() {
  const args = parseArgs(process.argv);
  const targets = selectStories(args);
  if (targets.length === 0) {
    console.log('C1 üretilecek hikaye yok (hepsinde C1 var veya seçim boş).');
    return;
  }
  console.log(`C1 üretilecek: ${targets.length} hikaye\n`);

  const done = [];
  const failed = [];
  for (const { path: p, story } of targets) {
    process.stdout.write(`${story.id} — ${story.title} ... `);
    try {
      const res = await generateC1(story);
      if (res.ok) {
        writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
        console.log(`OK (${res.words} kelime, ${res.attempts}. denemede${res.fallback ? ', fallback' : ''})`);
        done.push({ id: story.id, words: res.words });
      } else {
        console.log(`BAŞARISIZ (${res.issue})`);
        failed.push({ id: story.id, issue: res.issue });
      }
    } catch (e) {
      console.log(`HATA (${e.message.slice(0, 80)})`);
      failed.push({ id: story.id, issue: e.message.slice(0, 80) });
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Üretilen C1: ${done.length}/${targets.length}`);
  if (done.length) {
    const avg = Math.round(done.reduce((s, d) => s + d.words, 0) / done.length);
    console.log(`Ortalama kelime: ${avg}`);
  }
  if (failed.length) {
    console.log(`Başarısız: ${failed.map((f) => `${f.id}(${f.issue})`).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
