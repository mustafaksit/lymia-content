#!/usr/bin/env node
/**
 * Kapilarin Node tarafi (tek hikaye). JSON'u stdout'a basar; gates.py toplar.
 *   1. Sema: UYGULAMANIN KENDI zod semasi (lymia-app src/services/schemas.ts, dogrudan import)
 *      + content repo semasi (pipeline/lib/schema.mjs)
 *   2. D1-D5: pipeline/lib/detectors.mjs (quality-diagnosis.mjs ile ayni kurallar)
 *   +  audit --strict (uyum, guvenlik tier1, baslik cakismasi, coverScene, uzunluk tavani)
 *   +  NGSL kapsam / cumle tavani (pipeline/lib/validate.mjs) -> seviye profiline rapor
 *
 * Kullanim: node gate-node.mjs <story.json> [--index content/v2/index.json]
 * APP_REPO env: lymia-app kok dizini (varsayilan: ../lymia-app kardes dizin).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { validateSchema } = await import(pathToFileURL(path.join(ROOT, 'pipeline/lib/schema.mjs')));
const { detectLevel } = await import(pathToFileURL(path.join(ROOT, 'pipeline/lib/detectors.mjs')));
const { validateStory } = await import(pathToFileURL(path.join(ROOT, 'pipeline/lib/validate.mjs')));
const { lemmaCandidates, tokenizeWords } = await import(pathToFileURL(path.join(ROOT, 'pipeline/lib/tokenize.mjs')));

const APP_REPO = process.env.APP_REPO || path.resolve(ROOT, '../lymia-app');
const appSchemas = path.join(APP_REPO, 'src/services/schemas.ts');
if (!existsSync(appSchemas)) {
  console.error(`app schemas.ts bulunamadi: ${appSchemas} (APP_REPO env ile ver)`);
  process.exit(2);
}
// schemas.ts yalniz zod import eder; Node 26 tip-silme ile dogrudan yuklenir.
process.removeAllListeners('warning');
const { safeParseStory, safeParseIndex } = await import(pathToFileURL(appSchemas));

const file = path.resolve(process.argv[2]);
const idxArg = process.argv.indexOf('--index');
const indexFile = idxArg !== -1 ? path.resolve(process.argv[idxArg + 1]) : path.join(ROOT, 'content/v2/index.json');
const story = JSON.parse(readFileSync(file, 'utf8'));

const out = { id: story.id, schema: {}, detectors: {}, audit: {}, ngsl: {} };

// 1. sema
const parsed = safeParseStory(story);
const appLevels = parsed ? Object.keys(parsed.levels) : [];
out.schema.appZod = parsed ? 'ok' : 'FAIL';
out.schema.appZodLevels = appLevels;
out.schema.repoSchema = validateSchema(story);
if (existsSync(indexFile)) {
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  const idxParsed = safeParseIndex(index);
  const entry = idxParsed?.stories.find((s) => s.id === story.id);
  out.schema.indexZod = idxParsed ? 'ok' : 'FAIL';
  out.schema.indexEntry = entry ? 'ok' : 'MISSING';
  if (entry) out.schema.indexLevels = entry.levels;
}

// 2. D1-D5
for (const [lvl, data] of Object.entries(story.levels)) {
  const sents = data.paragraphs.flatMap((p) => p.sentences.map((s) => s.text.trim()));
  const paras = data.paragraphs.map((p) => p.sentences.map((s) => s.text).join(' ').trim());
  out.detectors[lvl] = detectLevel(lvl, sents, paras);
}

// audit --strict --json (tek hikaye)
try {
  const raw = execFileSync('node', [path.join(ROOT, 'pipeline/audit.mjs'), '--story', file, '--strict', '--json'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  out.audit = extractAudit(raw);
} catch (e) {
  out.audit = extractAudit(e.stdout || '');
}

function extractAudit(raw) {
  try {
    const j = JSON.parse(raw);
    const r = (j.results || j.stories || [j]).find?.((x) => x.id === story.id) || j;
    return { errors: r.errors || [], warnings: r.warnings || [] };
  } catch {
    return { errors: ['audit json okunamadi'], raw: raw.slice(0, 2000) };
  }
}

// NGSL kapsam. coreCoverage: --exempt ile verilen hikayeye ozgu anahtar kelimeler
// (lemma eslesmesi) pay ve paydadan cikarilir; ozel isimler zaten sayilmaz.
const exArg = process.argv.indexOf('--exempt');
const exemptTerms = exArg !== -1
  ? process.argv[exArg + 1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  : [];
// Terim ve sozcuk ayni lemmaya iniyorsa muaf: "sisters" terimi "sister"i de kapsar.
const exempt = new Set(exemptTerms.flatMap((t) => lemmaCandidates(t)));
// --names: kaynak isimlerinin sozcukleri; buyuk harfle yazildiginda (cumle basinda da) isim sayilir.
const nmArg = process.argv.indexOf('--names');
const nameWords = new Set(nmArg !== -1 ? process.argv[nmArg + 1].split(',').filter(Boolean) : []);
const nameLower = new Set([...nameWords].map((n) => n.toLowerCase()));
// Ihlal listesi kucuk harfli gelir; tokenlar orijinal harfle. Ikisini de isimle eslestir.
const isName = (w) => {
  const b = w.replace(/'s$/, '');
  return nameWords.has(b) || (b === b.toLowerCase() && nameLower.has(b));
};
const isExempt = (w) => isName(w) || lemmaCandidates(w).some((c) => exempt.has(c));
for (const [lvl, r] of Object.entries(validateStory(story))) {
  let exemptCount = 0;
  if (exempt.size) {
    for (const p of story.levels[lvl].paragraphs) {
      for (const s of p.sentences) exemptCount += tokenizeWords(s.text).filter(isExempt).length;
    }
  }
  const exemptViol = r.violations.filter((v) => isExempt(v.word)).reduce((n, v) => n + v.count, 0);
  const coreTotal = r.wordCount - exemptCount;
  const coreViol = r.violations.reduce((n, v) => n + v.count, 0) - exemptViol;
  out.ngsl[lvl] = {
    coverage: Number(r.coverage.toFixed(4)),
    coreCoverage: coreTotal > 0 ? Number(((coreTotal - coreViol) / coreTotal).toFixed(4)) : 0,
    exempt: exemptTerms,
    wordCount: r.wordCount,
    longSentences: r.longSentences.map((s) => `${s.wordCount}>${s.max}: ${s.sentence}`),
    lengthIssue: r.lengthIssue,
    offPool: r.violations.filter((v) => !isExempt(v.word)).sort((a, b) => b.count - a.count).slice(0, 25).map((v) => `${v.word}(${v.count})`),
  };
}

console.log(JSON.stringify(out));
