#!/usr/bin/env node
/**
 * .grammar-fixes.log'dan N hikayenin oncesi/sonrasi diff ornegini MD olarak
 * cikarir (kalite okumasi + ikinci gorus icin). Salt-okunur.
 * Kullanim: node pipeline/grammar-samples.mjs [N]  (varsayilan 5)
 * Cikti: docs/grammar-repass-ornekleri.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/env.mjs';

const N = Number(process.argv[2]) || 5;
const LOG = path.join(REPO_ROOT, '.grammar-fixes.log');
const OUT = path.join(REPO_ROOT, 'docs/grammar-repass-ornekleri.md');

if (!existsSync(LOG)) {
  console.log('.grammar-fixes.log yok; once fix-grammar.mjs calistir.');
  process.exit(0);
}

// log'u '## <id> <level>' bloklarina ayir
const blocks = [];
let cur = null;
for (const line of readFileSync(LOG, 'utf8').split('\n')) {
  const m = line.match(/^## (\S+)\s+(\S+)/);
  if (m) { cur = { id: m[1], level: m[2], lines: [] }; blocks.push(cur); }
  else if (cur && (line.startsWith('- ') || line.startsWith('+ '))) cur.lines.push(line);
}
// hikaye basina grupla, N benzersiz hikaye sec (deterministik: ilk N)
const byStory = new Map();
for (const b of blocks) {
  if (!byStory.has(b.id)) byStory.set(b.id, []);
  byStory.get(b.id).push(b);
}
const stories = [...byStory.keys()].slice(0, N);

const out = ['# Gramer Re-pass Kalite Ornekleri', '',
  `Toplam ${byStory.size} hikaye duzeltildi; asagida ${stories.length} ornek (oncesi \`-\`, sonrasi \`+\`).`,
  'Kural: SADECE gramer duzeltilir (ozne-yuklem/artikel), cumle yapisi + kelime secimi korunur.',
  'Ikinci gorus icin: bu diff\'leri Claude/Gemini chat\'e yapistirip "sadece gramer mi duzelmis, anlam degismis mi" diye sorabilirsin.', ''];
for (const id of stories) {
  out.push(`## ${id}`, '');
  for (const b of byStory.get(id)) {
    out.push(`### ${b.level}`, '```diff', ...b.lines.slice(0, 12), '```', '');
  }
}
writeFileSync(OUT, out.join('\n') + '\n');
console.log(`${OUT} yazildi (${stories.length} hikaye ornegi).`);
