#!/usr/bin/env node
/**
 * Dilbilgisi DUZELTME re-pass'i (v2, IS 1) — yeniden yazma DEGIL.
 *
 * LLM ile sadelestirilen metinlerde sistematik ozne-yuklem/artikel uyum
 * hatalari var (bkz. pipeline/lib/agreement.mjs). Bu script her seviyeyi
 * cumle-cumle modele gonderir, SADECE gramer duzeltir; seviye-tensini korur
 * (A1/A2 present-simple, B1 present/perfect, B2/C1 past narration).
 *
 * GUVENLIK KILITLERI (sessiz yeniden yazmaya karsi):
 *   - cikti cumle SAYISI girdiyle ayni olmali, yoksa seviye atlanir
 *   - cumle basina degisim orani sinirli (MAX_EDIT_RATIO); asan cumle
 *     ORIJINALINDE birakilir ve loglanir (model fazla degistirmis demektir)
 *   - duzeltme sonrasi agreementIssues DUSMELI; artiyorsa seviye atlanir
 * Etkilenen seviyeler .grammar-fixes.log'a diff olarak yazilir.
 * Ses YENILENMEZ; bu script metni + index'i gunceller, sesi ayrica
 * generate-audio.py --levels ile yenile (degisen seviyeler log'da).
 *
 * Kullanim:
 *   node pipeline/fix-grammar.mjs --dry --ids st-0113           # sadece diff, yazma yok
 *   node pipeline/fix-grammar.mjs --ids st-0113,st-0117         # belirli hikayeler
 *   node pipeline/fix-grammar.mjs --min-issues 1                # uyum hatasi olan tum hikayeler
 *   node pipeline/fix-grammar.mjs --limit 5                     # kota icin parcali (resumable)
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { STORIES_DIR, REPO_ROOT } from './lib/env.mjs';
import { callGemini, parseJsonResponse, poolStatus, geminiKeyCount } from './lib/gemini.mjs';
import { agreementIssues, levelAgreementCount } from './lib/agreement.mjs';

const TENSE = {
  A1: 'Present simple. Third-person singular takes -s. Do not use past tense.',
  A2: 'Mostly present simple (+ some past simple). Third-person singular takes -s.',
  B1: 'Present simple / present perfect narration. Third-person singular takes -s.',
  B2: 'Past-tense narration. Use past simple ("walked", "was"), NOT bare or -s forms.',
  C1: 'Past-tense literary narration. Use correct past/perfect forms.',
};
const MAX_EDIT_RATIO = 0.5; // bir cumlede kelimelerin en fazla yarisi degisebilir
const LOG = path.join(REPO_ROOT, '.grammar-fixes.log');

function args() {
  const a = { flags: new Set(), ids: null, limit: Infinity, minIssues: 1 };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--dry') a.flags.add('dry');
    else if (v[i] === '--ids') a.ids = v[++i].split(',');
    else if (v[i] === '--limit') a.limit = Number(v[++i]);
    else if (v[i] === '--min-issues') a.minIssues = Number(v[++i]);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 429/503 kota/gecici hatalarda bekleyip yeniden dener (kendini pace eder). */
async function callWithBackoff(prompt, tries = 10) {
  // Dakika-limiti penceresi ~60sn'de acilir; pes etmek yerine pencereyi bekle.
  let wait = 15000;
  for (let i = 1; i <= tries; i++) {
    try {
      return await callGemini(prompt, { json: true });
    } catch (e) {
      const msg = String(e.message);
      const transient = msg.includes('429') || msg.includes('503') || msg.includes('kota');
      if (!transient || i === tries) throw e;
      process.stdout.write(`    (dakika-limiti/gecici; ${wait / 1000}sn bekleniyor, deneme ${i}/${tries})\n`);
      await sleep(wait);
      wait = Math.min(wait + 15000, 60000); // 15->30->45->60->60... (dakika penceresi)
    }
  }
}

const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in o ? o[k] : `{${k}}`));
const words = (s) => s.toLowerCase().match(/[a-z']+/g) || [];
function editRatio(a, b) {
  const A = words(a), B = words(b);
  const setB = new Set(B);
  let common = 0;
  for (const w of A) if (setB.has(w)) common += 1;
  const maxLen = Math.max(A.length, B.length) || 1;
  return 1 - common / maxLen;
}

async function fixLevel(level, levelData, promptTpl) {
  const sents = levelData.paragraphs.flatMap((p) => p.sentences);
  const before = sents.map((s) => s.text);
  const beforeIssues = before.reduce((n, t) => n + agreementIssues(t).length, 0);
  if (beforeIssues === 0) return { changed: false, reason: 'zaten temiz' };

  const prompt = fill(promptTpl, {
    level,
    tenseRule: TENSE[level] ?? 'Preserve the original tense.',
    sentences: JSON.stringify(before, null, 0),
  });
  const data = parseJsonResponse(await callWithBackoff(prompt));
  const fixed = data.sentences;
  if (!Array.isArray(fixed) || fixed.length !== before.length) {
    return { changed: false, reason: `cumle sayisi uyumsuz ${fixed?.length}!=${before.length}` };
  }

  // Guard: fazla degisen cumleyi ORIJINALINDE birak
  const applied = before.map((orig, i) => {
    const cand = String(fixed[i] ?? '').trim();
    if (!cand) return orig;
    if (editRatio(orig, cand) > MAX_EDIT_RATIO) return orig; // yeniden yazma reddi
    return cand;
  });
  const afterIssues = applied.reduce((n, t) => n + agreementIssues(t).length, 0);
  if (afterIssues > beforeIssues) return { changed: false, reason: `uyum artti ${beforeIssues}->${afterIssues}` };

  // uygula
  let k = 0;
  const diffs = [];
  for (const p of levelData.paragraphs) {
    for (const s of p.sentences) {
      if (s.text !== applied[k]) diffs.push([s.text, applied[k]]);
      s.text = applied[k++];
    }
  }
  return { changed: diffs.length > 0, diffs, beforeIssues, afterIssues };
}

async function main() {
  const a = args();
  const tpl = readFileSync(path.join(REPO_ROOT, 'pipeline/prompts/fix-grammar.txt'), 'utf8');
  let files = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json')).sort();
  if (a.ids) files = files.filter((f) => a.ids.includes(f.replace('.json', '')));

  let done = 0;
  const touchedLevels = [];
  for (const f of files) {
    if (done >= a.limit) break;
    const p = path.join(STORIES_DIR, f);
    const story = JSON.parse(readFileSync(p, 'utf8'));
    const total = Object.values(story.levels).reduce((n, L) => n + levelAgreementCount(L), 0);
    if (total < a.minIssues) continue;

    console.log(`\n${story.id} — ${story.title} (${total} uyum hatasi)`);
    let anyChange = false;
    for (const level of Object.keys(story.levels)) {
      let res;
      try {
        res = await fixLevel(level, story.levels[level], tpl);
      } catch (e) {
        console.log(`  ${level}: HATA ${String(e.message).slice(0, 70)}`);
        continue;
      }
      if (res.changed) {
        anyChange = true;
        touchedLevels.push(`${story.id}:${level}`);
        console.log(`  ${level}: ${res.diffs.length} cumle duzeltildi (uyum ${res.beforeIssues}->${res.afterIssues})`);
        appendFileSync(LOG, `\n## ${story.id} ${level}\n` + res.diffs.map(([o, n]) => `- ${o}\n+ ${n}`).join('\n') + '\n');
      } else if (res.reason && res.reason !== 'zaten temiz') {
        console.log(`  ${level}: atlandi (${res.reason})`);
      }
    }
    if (anyChange && !a.flags.has('dry')) {
      writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
    }
    if (anyChange) done += 1;
  }
  console.log(`\n${a.flags.has('dry') ? '[DRY] ' : ''}${done} hikaye islendi. Sesi yenilenecek seviyeler (${touchedLevels.length}):`);
  console.log(touchedLevels.join(' '));
  if (touchedLevels.length) console.log(`\nDiff log: ${LOG}`);
  // Anahtar/uc kullanimi (kota takibi)
  const used = poolStatus().filter((e) => e.calls > 0 || e.dead);
  if (used.length) {
    console.log(`\nLLM uc kullanimi (${geminiKeyCount()} Gemini anahtari yuklu):`);
    for (const e of used) console.log(`  ${e.id}: ${e.calls} cagri${e.dead ? ' [kota doldu]' : ''}`);
  }
}

main();
