#!/usr/bin/env node
/* D4 Grup-1 (kopya-paste) dedup: bir seviyede tekrarlanan cumleyi TEK ornege
 * indir (ilk gecis kalir). Grup-2 (nakarat) DOKUNULMAZ. Deterministik.
 * Log: fix-d4-log.md  + audio-regen-queue.md guncelle */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);
const D4 = 'st-0008,st-0012,st-0013,st-0014,st-0020,st-0084,st-0091,st-0120,st-0121,st-0122,st-0124,st-0125,st-0126,st-0128,st-0133,st-0141,st-0148,st-0150,st-0154,st-0165,st-0169,st-0173,st-0186,st-0187,st-0209,st-0212,st-0215,st-0220,st-0228,st-0232,st-0238,st-0244,st-0252,st-0255,st-0268,st-0270,st-0271'.split(',');
const norm = (x) => x.toLowerCase().replace(/\s+/g, ' ').trim();

// Grup-1 (id,lvl,normtext) kumesi — Asama2 d4-triage.mjs siniflamasi ile ayni
function group1Set() {
  const set = new Set();
  for (const id of D4) {
    const s = JSON.parse(readFileSync(S(id), 'utf8'));
    for (const [lvl, L] of Object.entries(s.levels)) {
      const sents = L.paragraphs.flatMap((p) => p.sentences.map((x) => x.text.trim()));
      const freq = new Map();
      for (const t of sents) if (t.length >= 25) { const k = norm(t); if (!freq.has(k)) freq.set(k, { c: 0, t }); freq.get(k).c++; }
      for (const { c, t } of freq.values()) {
        if (c < 2) continue;
        const many = c >= 3, longNarr = t.length > 60 && !/["“]/.test(t);
        if (many || longNarr) set.add(`${id}|${lvl}|${norm(t)}`);
      }
    }
  }
  return set;
}

const g1 = group1Set();
const log = ['# D4 Grup-1 Dedup Logu', ''];
const regen = [];
let storiesFixed = 0, removed = 0;
for (const id of D4) {
  const s = JSON.parse(readFileSync(S(id), 'utf8'));
  const diffs = []; const touchedLvls = new Set();
  for (const [lvl, L] of Object.entries(s.levels)) {
    const seen = new Set();
    for (const para of L.paragraphs) {
      const kept = [];
      for (const sent of para.sentences) {
        const k = norm(sent.text.trim());
        const key = `${id}|${lvl}|${k}`;
        if (g1.has(key)) {
          if (seen.has(k)) { removed++; diffs.push([lvl, sent.text.trim()]); touchedLvls.add(lvl); continue; } // sonraki tekrari sil
          seen.add(k);
        }
        kept.push(sent);
      }
      para.sentences = kept;
    }
    // bos paragraflari at
    L.paragraphs = L.paragraphs.filter((p) => p.sentences.length);
  }
  if (diffs.length) {
    storiesFixed++;
    writeFileSync(S(id), JSON.stringify(s, null, 2) + '\n');
    log.push(`## ${id} — ${diffs.length} tekrar silindi`);
    const byL = {}; for (const [l, t] of diffs) (byL[l] = byL[l] || []).push(t);
    for (const [l, arr] of Object.entries(byL)) { log.push(`- [${l}] silinen (ilk gecis korundu):`); for (const t of [...new Set(arr)]) log.push(`  - ~~${t}~~ ×${arr.filter((x) => x === t).length}`); }
    log.push('');
    for (const l of touchedLvls) regen.push(`${id}\t${l}\tD4-dedup`);
  }
}
writeFileSync(path.join(ROOT, 'pipeline', 'fix-d4-log.md'), log.join('\n') + '\n');
// audio-regen-queue guncelle
const q = path.join(ROOT, 'pipeline', 'audio-regen-queue.md');
if (regen.length) appendFileSync(q, regen.join('\n') + '\n');
console.log(`D4 Grup-1: ${storiesFixed} hikaye, ${removed} tekrar cumle silindi.`);
console.log('etkilenen seviye:', regen.length);
