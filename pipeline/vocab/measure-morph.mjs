#!/usr/bin/env node
/**
 * İŞ 2: Kural motorunu ESKİ cümle-bazlı pilotun LLM çekimleriyle karşılaştır.
 * Eski LLM cache (cache/llm/{sha1(text).16}.json) her cümle için surface -> {gloss_tr,
 * gloss_tr_inflected} tutar. annot (dep/aux'lı) aynı token'ların tag/dep/aux'ını verir.
 * Her token için inflect(gloss_tr, pos, tag, {dep,aux}) çalıştırılıp LLM çıktısıyla
 * BİREBİR karşılaştırılır; tag bazında eşleşme oranı + 30 uyuşmazlık raporlanır.
 *
 * Kullanım: node pipeline/vocab/measure-morph.mjs st-0001 st-0004 st-0150
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inflect } from './tr-morph.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANNOT_DIR = path.join(__dirname, 'cache', 'annot');
const LLM_DIR = path.join(__dirname, 'cache', 'llm');
const sha16 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

const TAGS = ['NNS', 'VBD', 'VBN', 'VBG', 'VBZ', 'VBP', 'JJR', 'JJS', 'RBR', 'RBS'];
const ids = process.argv.slice(2);
if (!ids.length) { console.error('kullanım: measure-morph.mjs st-0001 ...'); process.exit(1); }

const stat = {}; // tag -> {n, match}
const mismatches = [];
const norm = (s) => (s || '').trim().toLowerCase();

for (const id of ids) {
  const annot = JSON.parse(fs.readFileSync(path.join(ANNOT_DIR, `${id}.json`), 'utf8'));
  for (const [level, d] of Object.entries(annot.levels)) {
    for (const sent of d.sentences) {
      const cf = path.join(LLM_DIR, `${sha16(sent.text)}.json`);
      if (!fs.existsSync(cf)) continue;
      let llm;
      try { llm = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch { continue; }
      for (const t of sent.tokens) {
        if (t.is_stop || t.is_propn || t.is_num) continue;
        if (!TAGS.includes(t.tag)) continue; // yalnız çekimli tag'ler
        const w = llm[t.surface.toLowerCase()] || llm[t.surface];
        if (!w || !w.gloss_tr || !w.gloss_tr_inflected) continue;
        const rule = inflect(w.gloss_tr, t.pos, t.tag, { dep: t.dep, aux: t.aux });
        const ref = w.gloss_tr_inflected;
        stat[t.tag] = stat[t.tag] || { n: 0, match: 0 };
        stat[t.tag].n++;
        if (norm(rule) === norm(ref)) stat[t.tag].match++;
        else if (mismatches.length < 400) mismatches.push({ surface: t.surface, tag: t.tag, gloss: w.gloss_tr, llm: ref, rule, sent: sent.text });
      }
    }
  }
}

console.log('=== TAG BAZINDA EŞLEŞME (kural vs LLM referansı) ===');
let tot = 0, totMatch = 0;
for (const tag of TAGS) {
  const s = stat[tag]; if (!s || !s.n) continue;
  tot += s.n; totMatch += s.match;
  console.log(`  ${tag.padEnd(4)}: ${s.match}/${s.n} = %${((s.match / s.n) * 100).toFixed(1)}`);
}
console.log(`  TOPLAM: ${totMatch}/${tot} = %${tot ? ((totMatch / tot) * 100).toFixed(1) : 0}`);

console.log('\n=== 30 UYUŞMAZLIK (hangisi doğru: SEN değerlendir) ===');
// tag çeşitliliği için karıştır
const pick = [];
const byTag = {};
for (const m of mismatches) { (byTag[m.tag] = byTag[m.tag] || []).push(m); }
let gi = 0; const tagKeys = Object.keys(byTag);
while (pick.length < 30 && tagKeys.some((k) => byTag[k].length)) {
  const k = tagKeys[gi % tagKeys.length]; if (byTag[k].length) pick.push(byTag[k].shift()); gi++;
}
console.log('surface | tag | gloss_tr | LLM | KURAL | cümle');
for (const m of pick) {
  const s = m.sent.length > 55 ? m.sent.slice(0, 52) + '...' : m.sent;
  console.log(`${m.surface} | ${m.tag} | ${m.gloss} | ${m.llm} | ${m.rule} | ${s}`);
}
fs.writeFileSync(path.join(__dirname, 'cache', 'morph-measure.json'), JSON.stringify({ stat, mismatches: mismatches.slice(0, 100) }, null, 2));
