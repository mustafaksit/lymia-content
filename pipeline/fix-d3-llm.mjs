#!/usr/bin/env node
/* D3 LLM re-pass: B1'e enjekte "if...will" sart cumlesi. Varsayilan SIL; boşluk
 * kalirsa gecmis zamana cek. Cumle-duzeyinde (yapiyi korur). Ses ayri.
 * Log: fix-d3-log.md ; kuyruk: audio-regen-queue.md ; ozet: .fix-d3-llm.json */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.mjs';
import { agreementIssues } from './lib/agreement.mjs';
loadEnv();
const { callGemini, parseJsonResponse } = await import('./lib/gemini.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);
const D3_IDS = 'st-0001,st-0002,st-0004,st-0006,st-0007,st-0011,st-0012,st-0013,st-0014,st-0015,st-0016,st-0017,st-0018,st-0019,st-0020,st-0021,st-0023,st-0070,st-0084,st-0102,st-0104,st-0106,st-0109,st-0113,st-0115,st-0119,st-0120,st-0121,st-0122,st-0123,st-0124,st-0125,st-0126,st-0127,st-0132,st-0133,st-0134,st-0135,st-0136,st-0137,st-0138,st-0140,st-0141,st-0142,st-0143,st-0144,st-0147,st-0148,st-0153,st-0155,st-0158,st-0159,st-0165,st-0168,st-0169,st-0170,st-0173,st-0175,st-0180,st-0181,st-0182,st-0183,st-0186,st-0188,st-0190,st-0191,st-0193,st-0194,st-0196,st-0200,st-0202,st-0205,st-0207,st-0208,st-0210,st-0212,st-0214,st-0217,st-0218,st-0224,st-0225,st-0226,st-0227,st-0228,st-0229,st-0230,st-0232,st-0234,st-0235,st-0236,st-0237,st-0240,st-0241,st-0244,st-0248,st-0249,st-0250,st-0251,st-0252,st-0253,st-0257,st-0259,st-0260,st-0261,st-0262,st-0264,st-0265,st-0268,st-0271,st-0272'.split(',');

const isInj = (s) => /\bif\b/i.test(s) && /\bwill\b/i.test(s);
const INSTR = `This is a past-tense children's story. Each target sentence is an injected present/future conditional ("if ... will ...") that breaks the past-tense narrative. For each: DEFAULT action is "remove" (delete it entirely). ONLY if removing leaves a logical gap, use "rewrite" with a natural PAST-tense version (e.g. "If he was careful, he covered..." or "He thought that if he was careful, he would..."). Do NOT add new content. Do NOT change other sentences.`;

const argIds = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : D3_IDS;
const logLines = [];
const summary = { stories: 0, removed: 0, rewritten: 0, flagged: [], errors: [] };
const regen = [];

for (const id of argIds) {
  let st; try { st = JSON.parse(readFileSync(S(id), 'utf8')); } catch { summary.errors.push(id); continue; }
  const B1 = st.levels?.B1; if (!B1) continue;
  const flat = B1.paragraphs.flatMap((p) => p.sentences);
  const items = []; const idxs = [];
  flat.forEach((sent, i) => { if (isInj(sent.text)) { items.push({ i: items.length, prev: flat[i - 1]?.text || '', target: sent.text, next: flat[i + 1]?.text || '' }); idxs.push(sent); } });
  if (!items.length) continue;

  let decisions;
  try {
    const prompt = `${INSTR}\n\nReturn STRICT JSON only, an OBJECT: {"decisions":[{"i":<number>,"action":"remove"|"rewrite","text":"<past-tense rewrite, only if action=rewrite>"}]}. Items:\n${JSON.stringify(items)}`;
    decisions = parseJsonResponse(await callGemini(prompt, { json: true })).decisions;
    if (!Array.isArray(decisions)) throw new Error('non-array');
  } catch (e) { summary.errors.push(`${id}:${(e.message || '').slice(0, 40)}`); logLines.push(`## ${id} — ⚠️ LLM hata: ${(e.message || '').slice(0, 60)}`); continue; }

  const byI = new Map(decisions.map((d) => [d.i, d]));
  const toRemove = new Set(); const diffs = [];
  for (let k = 0; k < items.length; k++) {
    const d = byI.get(k); if (!d) continue;
    const sent = idxs[k];
    if (d.action === 'rewrite' && d.text && d.text.trim() && !isInj(d.text)) {
      diffs.push(['rewrite', sent.text, d.text.trim()]); sent.text = d.text.trim(); summary.rewritten++;
    } else { // remove (varsayilan)
      toRemove.add(sent); diffs.push(['remove', sent.text, '']); summary.removed++;
    }
  }
  // sil
  for (const p of B1.paragraphs) p.sentences = p.sentences.filter((s) => !toRemove.has(s));
  B1.paragraphs = B1.paragraphs.filter((p) => p.sentences.length);

  writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
  summary.stories++;
  logLines.push(`## ${id} — ${diffs.length} (sil: ${diffs.filter((d) => d[0] === 'remove').length}, gecmis: ${diffs.filter((d) => d[0] === 'rewrite').length})`);
  for (const [act, o, n] of diffs) logLines.push(act === 'remove' ? `- [SIL] ~~${o}~~` : `- [GECMIS]\n  - ~~${o}~~\n  - ✅ ${n}`);
  // gate: kalan if+will?
  const resid = B1.paragraphs.flatMap((p) => p.sentences).filter((s) => isInj(s.text)).length;
  logLines.push(`  → kalan if+will: ${resid}${resid ? ' ⚠️ ISARETLENDI' : ' ✅'}`);
  if (resid) summary.flagged.push(`${id}(${resid})`);
  regen.push(`${id}\tB1\tD3-llm`);
  logLines.push('');
  process.stderr.write(`.${id.slice(-3)}`);
}

appendFileSync(path.join(ROOT, 'pipeline', 'fix-d3-log.md'), logLines.join('\n') + '\n');
if (regen.length) appendFileSync(path.join(ROOT, 'pipeline', 'audio-regen-queue.md'), '\n# D3-llm\n' + regen.join('\n') + '\n');
writeFileSync(path.join(ROOT, 'pipeline', '.fix-d3-llm.json'), JSON.stringify(summary, null, 2));
console.log(`\nD3 LLM bitti: ${summary.stories} hikaye | sil: ${summary.removed}, gecmis: ${summary.rewritten} | flagged: ${summary.flagged.length}, errors: ${summary.errors.length}`);
