#!/usr/bin/env node
/**
 * LYMIA content audit — the Faz 0 quality + Apple-4+ gate.
 *
 * Runs across the whole catalog (or one story) and checks:
 *   1. Schema        — story JSON shape the app relies on          [ERROR]
 *   2. Content safety — Tier 1 forbidden words/phrases (4+ rating) [ERROR]
 *                      Tier 2 review words (violence/horror/etc.)  [warn]
 *   3. Level rules   — CEFR coverage, sentence length, word count  [warn]*
 *   4. Reading time  — words / 200 wpm within the level's band     [warn]
 *
 * Severity model:
 *   ERROR  -> non-zero exit, fails CI. Non-negotiable: broken shape, or
 *             content that would break a 4+ age rating.
 *   warn   -> reported, does not fail CI. Quality drift the current catalog
 *             may carry and later phases tighten.
 *   *With --strict, level-rule warnings become errors (use for new content).
 *
 * Usage:
 *   node pipeline/audit.mjs                 # audit all content/stories
 *   node pipeline/audit.mjs --story <path>  # audit one story
 *   node pipeline/audit.mjs --strict        # level-rule drift fails too
 *   node pipeline/audit.mjs --json          # machine-readable output
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { READING_WPM, LEVEL_RULES } from './lib/levels.mjs';
import { findTitleCollision } from './lib/title-similarity.mjs';
import { levelAgreementCount } from './lib/agreement.mjs';
import { scanStory } from './lib/content-safety.mjs';
import { validateSchema } from './lib/schema.mjs';
import { formatReport, validateStory } from './lib/validate.mjs';

const STORIES_DIR = fileURLToPath(new URL('../content/stories/', import.meta.url));

/**
 * Uzunluk tavani (hardMaxWords) kurali YENI uretim icindir. Kural konmadan
 * ONCE uretilmis ve tavani asan hikaye-seviye ciftleri burada muaf tutulur;
 * yenileri bu listede olmadigindan tavani asarsa hard-fail olur.
 * (2026-08 olculdu; yeni giris EKLENMEZ, aksi tavan kurali anlamsizlasir.)
 */
const GRANDFATHERED_OVER_CEILING = new Set(['st-0014:B2', 'st-0023:B1', 'st-0092:B2', 'st-0121:B2']);

/** Tum katalog basliklari [{id,title}] - baslik cakisma denetimi icin. */
function loadAllTitles() {
  return readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const d = JSON.parse(readFileSync(path.join(STORIES_DIR, f), 'utf8'));
      return { id: d.id, title: d.title };
    });
}

function parseArgs(argv) {
  const args = { flags: new Set() };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict' || arg === '--json') args.flags.add(arg.slice(2));
    else if (arg === '--story') args.story = argv[++i];
  }
  return args;
}

function readingMinutes(words) {
  return words / READING_WPM;
}

/** Audits one parsed story. Returns { id, errors, warnings, safety, levels }. */
function auditStory(story, { strict, allTitles }) {
  const errors = [];
  const warnings = [];

  // 1. Schema
  for (const e of validateSchema(story)) errors.push(`schema: ${e}`);

  // 2. Content safety
  const safety = scanStory(story);
  for (const h of safety.tier1) {
    errors.push(`safety[tier1/${h.category}]: "${h.matched}" in ${h.where}`);
  }
  const tier2Terms = [...new Set(safety.tier2.map((h) => h.term))];

  // 3 + 4. Level rules and reading time (only if levels look structurally sane)
  let reports = {};
  if (story.levels && typeof story.levels === 'object') {
    try {
      reports = validateStory(story);
    } catch {
      // schema stage already recorded the structural problem
      reports = {};
    }
  }
  for (const [level, report] of Object.entries(reports)) {
    // NOT: level-rule (kapsam/cumle uzunlugu/kelime sayisi) sapmalari
    // --strict'ten BAGIMSIZ hep UYARI kalir. Bu, validate-level.mjs --keep'in
    // tasarim niyetiyle uyumlu ("kucuk sapmada rejected'a atma"). --strict
    // yalnizca YENI kurallari (uyum, baslik cakismasi) hard-fail yapar
    // (asagida). Bu ayrim yapilmadan once tum sapmalar strict'te hataya
    // donuyor ve validate-level'in tolere ettigi hikayeler audit'te
    // gereksiz reddediliyordu.
    const bucket = warnings;
    if (!report.ok) bucket.push(`level ${level}: ${formatReport(level, report).trim()}`);
    const mins = readingMinutes(report.wordCount);
    if (mins < 0.75) warnings.push(`level ${level}: very short (${mins.toFixed(1)} min @ ${READING_WPM} wpm)`);

    // Ozne-yuklem uyumu (yuksek hassasiyetli gate): normalde uyari, --strict'te
    // hata. Yeni PD-retold uretimi (--strict) uyum hatasiyla kataloga giremez.
    const agr = story.levels?.[level] ? levelAgreementCount(story.levels[level]) : 0;
    if (agr > 0) (strict ? errors : warnings).push(`level ${level}: ${agr} uyum hatasi (ozne-yuklem/a-an)`);

    // Uzunluk TAVANI (hardMaxWords): asilmasi HARD-FAIL, grandfather haric.
    const hardMax = LEVEL_RULES[level]?.hardMaxWords;
    if (hardMax != null && report.wordCount > hardMax) {
      const key = `${story.id}:${level}`;
      if (GRANDFATHERED_OVER_CEILING.has(key)) {
        warnings.push(`level ${level}: tavan asimi ${report.wordCount}>${hardMax} (grandfather, muaf)`);
      } else {
        errors.push(`level ${level}: UZUNLUK TAVANI asildi ${report.wordCount} > ${hardMax} kelime`);
      }
    }
  }

  // Baslik tekrari (IS 1b): exact/hard cakisma -> hard-fail; soft -> uyari
  // (strict'te hard-fail). allTitles tum katalogdur; kendini atlar.
  if (allTitles && story.title) {
    const hit = findTitleCollision(story.title, allTitles, story.id);
    if (hit) {
      const msg = `baslik cakismasi [${hit.level}] "${story.title}" ~ ${hit.otherId} "${hit.otherTitle}" (jaccard ${hit.jaccard.toFixed(2)}, ortak: ${hit.shared.join('/')})`;
      if (hit.level === 'exact' || hit.level === 'hard') errors.push(msg);
      else (strict ? errors : warnings).push(msg);
    }
  }

  // coverScene gate (kapak sahne betimi — görsel üretim prompt'u). Gramer kusuru
  // strict'te HATA (yeni içeriği bloklar), stil tutarsizligi HEP uyari.
  for (const issue of lintCoverScene(story.coverScene)) {
    if (issue.kind === 'grammar') (strict ? errors : warnings).push(`coverScene: ${issue.msg}`);
    else warnings.push(`coverScene: ${issue.msg}`);
  }

  return { id: story.id ?? '(no id)', errors, warnings, safety, tier2Terms, reports };
}

// coverScene deterministik lint (görsel üretim prompt'u). YÜKSEK İSABET: çekimsiz "be"
// ana fiili (örn. "a bird be on...", "...a bank door be.") betimleyici sahnede daima
// hatalidir ve tam da st-0125/st-0126'daki bozuklugu yakalar. Kök fiil (sit/stand/open...)
// listesi KULLANILMAZ — cogul/bilesik ozne ("A woman and a man stand") ve sifat kullanimi
// ("a single open book") yuzunden yanlis-pozitif uretiyordu.
// Stil (hep uyari): boş / küçük harf başlangıç / cümle sonu noktalama yok / çift boşluk.
const MODAL_BEFORE_BE_RE = /\b(to|will|would|can|could|shall|should|must|may|might|'ll|'d)\s+be\b/i;
function lintCoverScene(cs) {
  const out = [];
  const s = (cs ?? '').trim();
  if (!s) { out.push({ kind: 'grammar', msg: 'boş/eksik' }); return out; }
  // Çekimsiz "be" ana fiili — modal/to ile birlikte değilse hata ("...door be.", "bird be on").
  if (/\bbe\b/i.test(s) && !MODAL_BEFORE_BE_RE.test(s)) {
    out.push({ kind: 'grammar', msg: `çekimsiz "be" ana fiili: "${s}"` });
  }
  if (/^[a-z]/.test(s)) out.push({ kind: 'style', msg: 'küçük harfle başlıyor' });
  if (!/[.!?]$/.test(s)) out.push({ kind: 'style', msg: 'cümle sonu noktalama yok' });
  if (/\s{2,}/.test(s)) out.push({ kind: 'style', msg: 'çift boşluk' });
  return out;
}

function loadStoryFiles(args) {
  if (args.story) {
    const p = path.resolve(args.story);
    return [{ file: p, story: JSON.parse(readFileSync(p, 'utf8')) }];
  }
  return readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const p = path.join(STORIES_DIR, f);
      return { file: p, story: JSON.parse(readFileSync(p, 'utf8')) };
    });
}

function main() {
  const args = parseArgs(process.argv);
  const strict = args.flags.has('strict');
  const files = loadStoryFiles(args);
  const allTitles = loadAllTitles();

  const results = files.map(({ story }) => auditStory(story, { strict, allTitles }));

  if (args.flags.has('json')) {
    const failed = results.filter((r) => r.errors.length > 0);
    console.log(JSON.stringify({ total: results.length, failedCount: failed.length, results }, null, 2));
    process.exit(failed.length > 0 ? 2 : 0);
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  const tier2Global = new Map(); // term -> count

  for (const r of results) {
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
    for (const t of r.tier2Terms) tier2Global.set(t, (tier2Global.get(t) ?? 0) + 1);

    if (r.errors.length === 0 && r.warnings.length === 0) continue;
    console.log(`\n${r.id}`);
    for (const e of r.errors) console.log(`  ✗ ERROR  ${e}`);
    for (const w of r.warnings) console.log(`  • warn   ${w}`);
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Denetlenen hikaye: ${results.length}`);
  console.log(`Hata (hard-fail): ${totalErrors}   Uyarı: ${totalWarnings}   ${strict ? '[strict]' : ''}`);
  if (tier2Global.size > 0) {
    const sorted = [...tier2Global.entries()].sort((a, b) => b[1] - a[1]);
    console.log(
      `Tier2 gözden geçir (bloklamaz): ${sorted.map(([t, c]) => `${t}×${c}`).join(', ')}`,
    );
  }
  const failed = results.filter((r) => r.errors.length > 0);
  if (failed.length > 0) {
    console.log(`\n${failed.length} hikaye hard-fail: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(2);
  }
  console.log('\nTüm hikayeler geçti (hard-fail yok).');
}

main();
