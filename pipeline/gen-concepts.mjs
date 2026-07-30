#!/usr/bin/env node
/**
 * v2 Faz 3 özgün hikaye KONSEPTLERİ üretir (üretim değil, sadece konsept).
 * Tür kotası: scifi 9, romance 5, horror 4, daily 3, mystery 2, adventure 1.
 * Kurallar: mevcut 50 hikaye ile tema tekrarı yok; sci-fi çocuk-dostu ve
 * umutlu (distopya/apokalips yok); her konsept tek cümlede net.
 * Çıktı: pipeline/v2-originals.draft.json  + ekranda tablo.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STORIES_DIR, REPO_ROOT } from './lib/env.mjs';
import { callGemini, parseJsonResponse } from './lib/gemini.mjs';

const QUOTA = { scifi: 9, romance: 5, horror: 4, daily: 3, mystery: 2, adventure: 1 };
const OUT = path.join(REPO_ROOT, 'pipeline', 'v2-originals.draft.json');

function existingByGenre() {
  const map = {};
  for (const f of readdirSync(STORIES_DIR).filter((f) => /^st-\d{4}\.json$/.test(f))) {
    const s = JSON.parse(readFileSync(path.join(STORIES_DIR, f), 'utf8'));
    (map[s.genre] ??= []).push(`${s.title}: ${s.summary ?? ''}`);
  }
  return map;
}

const GENRE_NOTE = {
  scifi:
    'Child-friendly and HOPEFUL science fiction: wonder, discovery, friendly robots, space gardens, ' +
    'helpful inventions, kind aliens. Absolutely NO dystopia, war, apocalypse, or scary AI. Bright and optimistic.',
  romance: 'Gentle, warm romance or friendship blossoming. Sweet and clean, no adult content.',
  horror: 'Spooky and suspenseful but 4+ safe: eerie houses, mysterious sounds, friendly ghosts. Creepy, never graphic or gory.',
  daily: 'Everyday slice-of-life: small human moments, kindness, little problems solved. Warm and relatable.',
  mystery: 'A puzzle to solve: a missing thing, a strange event, clues. Clever, non-violent.',
  adventure: 'Exciting journey or quest: exploration, discovery, mild challenge. Energetic and safe.',
};

async function genGenre(genre, n, existing) {
  const prompt = [
    `You are a story editor for a 4+ English graded-reader app. Propose ${n} NEW, ORIGINAL story concepts in the "${genre}" genre.`,
    `Genre guidance: ${GENRE_NOTE[genre]}`,
    '',
    'HARD RULES:',
    `- Each concept must be DISTINCT from every one of our EXISTING "${genre}" stories listed below (no repeated premise, setting, or twist).`,
    '- Also avoid the most common clichés so the set feels fresh and varied.',
    '- Each "concept" must be ONE clear sentence (about 15-30 words) that fully captures the premise.',
    '- Content safe for age 4+: no violence, death, romance beyond sweet, drugs, or scary themes.',
    '- Give each a short, appealing English "title" and a natural difficulty "center" (one of A1, A2, B1, B2, C1) — but note the story will still be written at all levels.',
    '',
    `EXISTING "${genre}" stories to avoid repeating:`,
    (existing[genre] ?? ['(none)']).map((x) => `- ${x}`).join('\n'),
    '',
    `Return JSON only: {"concepts":[{"title":"...","genre":"${genre}","center":"B1","concept":"one sentence."}]} with exactly ${n} items.`,
  ].join('\n');

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const data = parseJsonResponse(await callGemini(prompt, { json: true }));
      const list = Array.isArray(data.concepts) ? data.concepts : [];
      const good = list.filter(
        (c) => c && typeof c.title === 'string' && c.title.trim() && typeof c.concept === 'string' && c.concept.trim(),
      );
      if (good.length >= n) return good.slice(0, n).map((c) => ({
        title: c.title.trim(),
        genre,
        center: /^(A1|A2|B1|B2|C1)$/.test(c.center) ? c.center : 'B1',
        concept: c.concept.trim().replace(/\s+/g, ' '),
      }));
    } catch { /* retry */ }
  }
  throw new Error(`${genre}: ${n} konsept üretilemedi`);
}

async function main() {
  const existing = existingByGenre();
  const all = [];
  for (const [genre, n] of Object.entries(QUOTA)) {
    process.stdout.write(`${genre} (${n}) ... `);
    const items = await genGenre(genre, n, existing);
    all.push(...items);
    console.log('OK');
  }
  writeFileSync(OUT, JSON.stringify(all, null, 2) + '\n');
  console.log(`\nToplam ${all.length} konsept -> ${OUT}\n`);
  // tablo
  let i = 1;
  for (const c of all) {
    console.log(`${String(i++).padStart(2)} | ${c.genre.padEnd(9)} | ${c.center} | ${c.title}`);
    console.log(`     ${c.concept}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
