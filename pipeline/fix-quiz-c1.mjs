#!/usr/bin/env node
/**
 * C1 quiz cilası (v2 Faz 1 kapanış). C1 quizlerindeki edebiyat-analizi/meta
 * sorularını ("What does X symbolize", "How does the author convey...", tema/
 * mecaz/anlatı teknikleri) hikaye-anlama sorularıyla değiştirir. Quiz okuduğunu
 * anlamayı ölçer, edebiyat dersi değil.
 *
 * SADECE işaretlenen soruları yeniler; aynı hikayedeki iyi soruları korur ve
 * yeni sorunun onlarla çakışmamasını ister. Değişiklikten sonra şema doğrular.
 *
 * Kullanım:
 *   node pipeline/fix-quiz-c1.mjs            # tüm hikayeler
 *   node pipeline/fix-quiz-c1.mjs --story content/stories/st-0005.json
 *   node pipeline/fix-quiz-c1.mjs --dry      # sadece raporla, yazma
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STORIES_DIR, loadEnv } from './lib/env.mjs';
import { callGemini, parseJsonResponse } from './lib/gemini.mjs';

loadEnv();

const META = /\bauthor\b|\bnarrative\b|\bmetaphor|\bsymbol|\bimagery\b|\btone\b|\bmood\b|\btheme\b|\bpassage\b|\bconvey|\brepresent\b|\ballegor|\bmotif\b|literary|\bprose\b/i;
const MAX_TRIES = 4;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--story') args.story = argv[++i];
  }
  return args;
}

function c1Text(c1) {
  return c1.paragraphs.map((p) => p.sentences.map((s) => s.text).join(' ')).join('\n\n');
}

function validQuestion(q) {
  return (
    q &&
    typeof q.q === 'string' &&
    q.q.trim() &&
    !META.test(q.q) &&
    Array.isArray(q.options) &&
    q.options.length === 3 &&
    q.options.every((o) => typeof o === 'string' && o.trim()) &&
    Number.isInteger(q.answer) &&
    q.answer >= 0 &&
    q.answer <= 2
  );
}

function buildPrompt(story, count, kept) {
  return [
    'You write reading-COMPREHENSION quiz questions for an English graded reader.',
    `Below is a C1 story titled "${story.title}". Write exactly ${count} NEW comprehension`,
    'question(s) that test whether the reader UNDERSTOOD what happened: concrete facts,',
    'events, characters, cause and effect, sequence, or a character\'s stated feeling or decision.',
    '',
    'STRICT RULES:',
    '- Do NOT ask about the author, the "narrative", themes, symbols, metaphors, imagery,',
    '  tone, mood, or any literary device. No "What does X symbolize", no "How does the author...".',
    '- Ask plain who / what / where / when / why / how questions answerable directly from events.',
    '- Each question has exactly 3 options, exactly one correct, two plausible but wrong.',
    kept.length ? `- Do NOT duplicate these existing questions: ${JSON.stringify(kept)}` : '',
    '',
    'STORY:',
    c1Text(story.levels.C1),
    '',
    `Return JSON only: {"questions":[{"q":"...","options":["a","b","c"],"answer":0}]} with exactly ${count} item(s).`,
  ].join('\n');
}

async function fixStory(story) {
  const quiz = story.levels.C1.quiz;
  const flaggedIdx = quiz.map((q, i) => (META.test(q.q) ? i : -1)).filter((i) => i >= 0);
  if (flaggedIdx.length === 0) return { changed: false, replaced: 0 };

  const kept = quiz.filter((_, i) => !flaggedIdx.includes(i)).map((q) => q.q);

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    let data;
    try {
      data = parseJsonResponse(await callGemini(buildPrompt(story, flaggedIdx.length, kept), { json: true }));
    } catch {
      continue;
    }
    const fresh = Array.isArray(data.questions) ? data.questions : [];
    const good = fresh.filter(validQuestion);
    if (good.length < flaggedIdx.length) continue;

    flaggedIdx.forEach((qi, k) => {
      quiz[qi] = { q: good[k].q.trim(), options: good[k].options.map((o) => o.trim()), answer: good[k].answer };
    });
    return { changed: true, replaced: flaggedIdx.length };
  }
  return { changed: false, replaced: 0, failed: flaggedIdx.length };
}

function selectFiles(args) {
  if (args.story) return [path.resolve(args.story)];
  return readdirSync(STORIES_DIR)
    .filter((f) => /^st-\d{4}\.json$/.test(f))
    .sort()
    .map((f) => path.join(STORIES_DIR, f));
}

async function main() {
  const args = parseArgs(process.argv);
  const files = selectFiles(args);
  let totalReplaced = 0;
  const changedStories = [];
  const failed = [];

  for (const p of files) {
    const story = JSON.parse(readFileSync(p, 'utf8'));
    if (!story.levels?.C1?.quiz) continue;
    const res = await fixStory(story);
    if (res.failed) failed.push(story.id);
    if (res.changed) {
      totalReplaced += res.replaced;
      changedStories.push(`${story.id}(${res.replaced})`);
      if (!args.dry) writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
      console.log(`${story.id}: ${res.replaced} soru değiştirildi${args.dry ? ' [dry]' : ''}`);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Değiştirilen soru: ${totalReplaced} | etkilenen hikaye: ${changedStories.length}`);
  if (failed.length) {
    console.log(`Başarısız (elle bak): ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
