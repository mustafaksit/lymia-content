#!/usr/bin/env node
/**
 * Dilbilgisi DUZELTME re-pass'i (v2, IS 1) - yeniden yazma DEGIL.
 * HIKAYE BASINA TEK CAGRI (tum hatali seviyeler birlikte) -> cagri sayisi
 * ~140'tan ~37'ye duser (ucretsiz rate-limit'e cok daha dayanikli).
 *
 * Seviye-tensi korunur (A1/A2/B1 present, B2/C1 past). Guvenlik kilitleri:
 *   - her seviyenin cikti dizisi girdiyle AYNI uzunlukta olmali
 *   - cumle basina max %50 kelime degisimi (asan cumle ORIJINAL kalir)
 *   - duzeltme sonrasi uyum hatasi ARTMAMALI (artarsa o seviye atlanir)
 * Ses YENILENMEZ; degisen seviyeler log sonunda listelenir (generate-audio.py).
 * Kullanim: node pipeline/fix-grammar.mjs [--dry] [--ids a,b] [--limit N] [--min-issues N]
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { STORIES_DIR, REPO_ROOT } from './lib/env.mjs';
import { callGemini, parseJsonResponse, poolStatus } from './lib/gemini.mjs';
import { agreementIssues } from './lib/agreement.mjs';

const LOG = path.join(REPO_ROOT, '.grammar-fixes.log');
const MAX_EDIT_RATIO = 0.5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const a = { dry: false, ids: null, limit: Infinity, minIssues: 1 };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--dry') a.dry = true;
    else if (v[i] === '--ids') a.ids = v[++i].split(',');
    else if (v[i] === '--limit') a.limit = Number(v[++i]);
    else if (v[i] === '--min-issues') a.minIssues = Number(v[++i]);
  }
  return a;
}

const words = (s) => (s.toLowerCase().match(/[a-z']+/g) || []);
function editRatio(a, b) {
  const A = words(a), B = new Set(words(b));
  let common = 0; for (const w of A) if (B.has(w)) common++;
  return 1 - common / (Math.max(A.length, words(b).length) || 1);
}
const levelSentences = (L) => L.paragraphs.flatMap((p) => p.sentences);
const levelIssues = (L) => levelSentences(L).reduce((n, s) => n + agreementIssues(s.text).length, 0);

async function callWithBackoff(prompt) {
  let wait = 8000;
  for (let i = 1; i <= 12; i++) {
    try { return await callGemini(prompt, { json: true }); }
    catch (e) {
      const t = /429|503|kota|rate/i.test(String(e.message));
      if (!t || i === 12) throw e;
      process.stdout.write(`    (rate/gecici; ${wait / 1000}sn; deneme ${i})\n`);
      await sleep(wait); wait = Math.min(wait + 8000, 40000);
    }
  }
}

/** Bir hikayenin hatali seviyelerini SEVIYE-BASINA tek cagrida duzeltir
 *  (kucuk prompt = hizli, ~4s; tum seviyeleri birlestirmek yaniti sisiriyordu). */
async function fixStory(story, tpl) {
  const touched = [];
  const diffs = [];
  for (const [lvl, L] of Object.entries(story.levels)) {
    if (levelIssues(L) === 0) continue;
    const orig = levelSentences(L).map((s) => s.text);
    const prompt = tpl.replace('{levels}', JSON.stringify({ [lvl]: orig }, null, 0));
    let data;
    try { data = parseJsonResponse(await callWithBackoff(prompt)); }
    catch (e) { process.stdout.write(`[${lvl} hata] `); continue; }
    const fixed = Array.isArray(data[lvl]) ? data[lvl] : data.sentences;
    if (!Array.isArray(fixed) || fixed.length !== orig.length) { process.stdout.write(`[${lvl} uzunluk] `); continue; }
    const applied = orig.map((o, k) => {
      const c = String(fixed[k] ?? '').trim();
      return (!c || editRatio(o, c) > MAX_EDIT_RATIO) ? o : c;
    });
    const before = orig.reduce((n, t) => n + agreementIssues(t).length, 0);
    const after = applied.reduce((n, t) => n + agreementIssues(t).length, 0);
    if (after > before) { process.stdout.write(`[${lvl} atlandi] `); continue; }
    const sents = levelSentences(L);
    let ch = 0;
    sents.forEach((s, k) => { if (s.text !== applied[k]) { diffs.push([lvl, s.text, applied[k]]); ch++; } s.text = applied[k]; });
    if (ch > 0) touched.push({ lvl, ch, before, after });
  }
  return { changed: touched.length > 0, touched, diffs };
}

async function main() {
  const args = parseArgs();
  const tpl = readFileSync(path.join(REPO_ROOT, 'pipeline/prompts/fix-grammar.txt'), 'utf8');
  let files = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json')).sort();
  if (args.ids) files = files.filter((f) => args.ids.includes(f.replace('.json', '')));

  const targets = [];
  for (const f of files) {
    const story = JSON.parse(readFileSync(path.join(STORIES_DIR, f), 'utf8'));
    const tot = Object.values(story.levels).reduce((n, L) => n + levelIssues(L), 0);
    if (tot >= args.minIssues) targets.push({ f, story, tot });
  }
  console.log(`Hedef: ${targets.length} hikaye (uyum hatasi olan). Batch: hikaye basina 1 cagri.\n`);

  const touchedLevels = [];
  let done = 0, idx = 0;
  for (const { f, story, tot } of targets) {
    if (done >= args.limit) break;
    idx++;
    process.stdout.write(`[${idx}/${targets.length}] ${story.id} (${tot} hata)... `);
    let res;
    try { res = await fixStory(story, tpl); }
    catch (e) { console.log(`HATA ${String(e.message).slice(0, 60)}`); continue; }
    if (res.changed) {
      done++;
      const p = path.join(STORIES_DIR, f);
      if (!args.dry) writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
      for (const t of res.touched) touchedLevels.push(`${story.id}:${t.lvl}`);
      console.log(res.touched.map((t) => `${t.lvl} ${t.ch}c ${t.before}->${t.after}`).join('  '));
      appendFileSync(LOG, `\n## ${story.id}\n` + res.diffs.map(([l, o, n]) => `[${l}] - ${o}\n[${l}] + ${n}`).join('\n') + '\n');
    } else {
      console.log('degisiklik yok');
    }
  }
  console.log(`\n${args.dry ? '[DRY] ' : ''}${done}/${targets.length} hikaye duzeltildi.`);
  console.log(`Sesi yenilenecek seviyeler (${touchedLevels.length}): ${touchedLevels.join(' ')}`);
  const used = poolStatus().filter((e) => e.calls > 0);
  if (used.length) console.log('Uc kullanimi: ' + used.map((e) => `${e.id}:${e.calls}${e.dead ? '[dead]' : ''}`).join(' '));
}
main();
