#!/usr/bin/env node
/* 200 hikayeyi harici AI denetimi icin markdown'a aktarir. Tek dosya >2MB ise
 * 50'serlik parcalara boler. Salt-okunur; ciktisi pipeline/audit-export*.md */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = path.join(ROOT, 'content', 'stories');
const OUT = path.join(ROOT, 'pipeline');

const normTitleMatch = (t) =>
  t.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// kaynak siniflama (uniqueness-check ile ayni mantik)
const load = (f) => JSON.parse(readFileSync(path.join(OUT, f), 'utf8'));
const originalSet = new Set(load('v2-originals.json').map((x) => normTitleMatch(x.title)));
const pdSet = new Set();
for (const f of ['v2-classics.json', 'v2-remaining-pd.json', 'v2-batch1-fables.json'])
  for (const x of load(f)) pdSet.add(normTitleMatch(x.title));
for (const line of readFileSync(path.join(ROOT, 'docs', 'faz2-aday-listesi.md'), 'utf8').split('\n')) {
  if (!line.startsWith('|')) continue;
  const inner = line.split('|').map((c) => c.trim()).slice(1, -1);
  if (inner.length < 7 || !/^\d+$/.test(inner[0])) continue;
  if (/bkz\.|ELENDI/i.test(inner[1])) continue;
  pdSet.add(normTitleMatch(inner[1]));
}
const V1_PD = new Set([
  'the happy prince and other tales', 'the adventures of sherlock holmes',
  'alice s adventures in wonderland', 'the adventures of tom sawyer complete',
  'a christmas carol in prose being a ghost story of christmas', 'the wonderful wizard of oz',
]);
const sourceLabel = (title) => {
  const k = normTitleMatch(title);
  if (originalSet.has(k)) return 'ozgun';
  if (pdSet.has(k) || V1_PD.has(k)) return 'PD-uyarlama';
  return 'ozgun';
};

const levelText = (lvl) =>
  (lvl?.paragraphs || []).map((p) => (p.sentences || []).map((x) => x.text).join(' ')).join('\n\n');

const files = readdirSync(STORIES).filter((f) => f.endsWith('.json')).sort();
const blocks = files.map((f) => {
  const s = JSON.parse(readFileSync(path.join(STORIES, f), 'utf8'));
  const L = [`## ${s.id} — ${s.title}`, `Kaynak: ${sourceLabel(s.title)}`, ''];
  for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1']) {
    L.push(`### ${lvl}`, s.levels?.[lvl] ? levelText(s.levels[lvl]) : '(seviye yok)', '');
  }
  L.push('---', '');
  return L.join('\n');
});

const full = blocks.join('\n');
const bytes = Buffer.byteLength(full, 'utf8');
const LIMIT = 2 * 1024 * 1024;

// eski ciktilari temizle
for (const f of ['audit-export.md', 'audit-export-1.md', 'audit-export-2.md', 'audit-export-3.md', 'audit-export-4.md'])
  if (existsSync(path.join(OUT, f))) unlinkSync(path.join(OUT, f));

const results = [];
if (bytes <= LIMIT) {
  const p = path.join(OUT, 'audit-export.md');
  writeFileSync(p, full);
  results.push(p);
} else {
  // 50'serlik parcalar
  for (let i = 0; i < blocks.length; i += 50) {
    const chunk = blocks.slice(i, i + 50);
    const idx = i / 50 + 1;
    const p = path.join(OUT, `audit-export-${idx}.md`);
    const header = `# Denetim Export — Parca ${idx} (hikaye ${i + 1}-${Math.min(i + 50, blocks.length)} / ${blocks.length})\n\n`;
    writeFileSync(p, header + chunk.join('\n'));
    results.push(p);
  }
}

console.log('Toplam hikaye:', blocks.length);
console.log('Tek dosya ham boyut:', (bytes / 1024 / 1024).toFixed(2), 'MB', bytes > LIMIT ? '(>2MB → bolundu)' : '(≤2MB → tek dosya)');
console.log('Uretilen dosyalar:');
for (const p of results) console.log('  ', path.basename(p), (statSync(p).size / 1024 / 1024).toFixed(2), 'MB');
