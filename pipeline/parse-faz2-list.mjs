#!/usr/bin/env node
/**
 * docs/faz2-aday-listesi.md'deki onayli PD aday tablosunu parse edip
 * pipeline/v2-remaining-pd.json'a yazar. "bkz. secili" / "ELENDI" isaretli
 * satirlar (cakisma/eleme) atlanir. Salt-okunur girdi, tek seferlik cikti.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const GENRE_MAP = {
  fable: 'classic', fairy: 'classic', folk: 'classic', animal: 'classic',
  mystery: 'mystery', scifi: 'scifi', daily: 'daily', adventure: 'adventure',
  romance: 'romance', horror: 'horror',
};

const md = readFileSync('docs/faz2-aday-listesi.md', 'utf8');
const out = [];
let skipped = 0;

for (const line of md.split('\n')) {
  if (!line.startsWith('|')) continue;
  const cells = line.split('|').map((c) => c.trim());
  const inner = cells.slice(1, -1);
  if (inner.length < 7) continue;
  if (!/^\d+$/.test(inner[0])) continue; // header/ayirac/nonveri satirlarini atla
  const [, title, src, ozet, tur, bant, note] = inner;
  if (/bkz\.|ELENDI/i.test(title) || /bkz\.|ELENDI/i.test(ozet)) { skipped++; continue; }
  const genre = GENRE_MAP[tur.toLowerCase()] || 'classic';
  out.push({ title, author: src, genre, plot: ozet, band: bant, note });
}

writeFileSync('pipeline/v2-remaining-pd.json', JSON.stringify(out, null, 1) + '\n');
console.log(`Parse edildi: ${out.length} aday | atlanan (cakisma/eleme): ${skipped}`);
