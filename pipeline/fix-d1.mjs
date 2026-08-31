#!/usr/bin/env node
/* D1 uygula (6 onayli). Semantik ama kurala baglanabilir: hedefli replace.
 * st-0174 UYGULANMAZ (ayri gosterilir). st-0008 imperatif "Is like"->"Be like"
 * (round-1 bozulmasi) da geri alinir. Log: fix-d1-log.md */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);

// Hikaye basina, cumle-metnine uygulanacak ardil replace kurallari
const RULES = {
  'st-0008': [
    [/\bmade water\b/g, 'cried'],
    [/\bIs like the Happy Prince\b/g, 'Be like the Happy Prince'], // imperatif geri al
    [/\bIs like Prince\b/g, 'Be like Prince'],
  ],
  'st-0122': [[/\bhas a long head\b/g, 'has long hair']],
  'st-0123': [[/\bis a new woman\b/g, 'is a young woman']],
  'st-0126': [
    [/\bwith a red head\b/g, 'with red hair'],
    [/\bwith red head\b/g, 'with red hair'],
    [/\bred head man\b/g, 'red-haired man'],
    [/\bred head\b/g, 'red hair'],
  ],
  'st-0162': [[/\bhas a long head\b/g, 'has a long beak']],
  'st-0169': [
    [/\bThe woman move up her long head part\.?/g, 'The woman climbed up using her long hair.'],
    [/\bThe girl bring her head part down\.?/g, 'The girl let her long hair down.'],
  ],
};

const log = ['# D1 Duzeltme Logu', ''];
const regen = [];
let stories = 0, sents = 0;
for (const [id, rules] of Object.entries(RULES)) {
  const st = JSON.parse(readFileSync(S(id), 'utf8'));
  const diffs = []; const touched = new Set();
  for (const [lvl, L] of Object.entries(st.levels)) {
    for (const p of L.paragraphs) for (const se of p.sentences) {
      let t = se.text;
      for (const [re, rep] of rules) t = t.replace(re, rep);
      if (t !== se.text) { diffs.push([lvl, se.text, t]); se.text = t; touched.add(lvl); sents++; }
    }
  }
  if (diffs.length) {
    stories++;
    writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
    log.push(`## ${id} — ${diffs.length} cumle`);
    for (const [l, o, n] of diffs) log.push(`- [${l}]\n  - ~~${o}~~\n  - ✅ ${n}`);
    log.push('');
    for (const l of touched) regen.push(`${id}\t${l}\tD1`);
  }
}
writeFileSync(path.join(ROOT, 'pipeline', 'fix-d1-log.md'), log.join('\n') + '\n');
if (regen.length) appendFileSync(path.join(ROOT, 'pipeline', 'audio-regen-queue.md'), '\n# D1\n' + regen.join('\n') + '\n');
console.log(`D1: ${stories} hikaye, ${sents} cumle degisti.`);
for (const l of log.filter((x) => x.startsWith('## '))) console.log(' ', l.slice(3));
