#!/usr/bin/env node
/**
 * v2 Faz 3 batch orkestratörü. Bir hikaye listesini (klasik retold veya özgün)
 * uçtan uca üretir ve HER ADIMI manifest'e kaydeder (kesintiye dayanıklı,
 * idempotent). Zincir:
 *   1 generate-story  (klasik: --retell+plot | özgün: --concept)  -> A1-B2
 *   2 validate-level --fix                                        (A1-B2 NGSL)
 *   3 generate-summaries                                          (summary)
 *   4 generate-c1                                                 (C1)
 *   5 normalize-c1                                                (ASCII)
 *   6 audit --story                                               (hard-fail geçidi)
 *   7 generate-audio A1-C1                                        (MP3 + timings)
 *
 * KAPAK (Faz 4) ve index/CDN (Faz 5) BİLEREK dışarıda. Bir hikaye herhangi bir
 * adımda kalıcı başarısız olursa atlanır ve raporlanır; yeniden çalıştırınca
 * tamamlanan adımlar atlanır.
 *
 * Kullanım:
 *   node pipeline/run-v2-batch.mjs --kind classics  --from 0 --count 10
 *   node pipeline/run-v2-batch.mjs --kind originals --spec pipeline/v2-originals.json --from 0 --count 10
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, STORIES_DIR } from './lib/env.mjs';

const NODE = process.execPath;
const PY = path.join(REPO_ROOT, '.venv', 'bin', 'python');
const MANIFEST = path.join(REPO_ROOT, 'pipeline', '.v2-batch-state.json');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n != null && !n.startsWith('--')) { a[k] = n; i++; } else a[k] = true;
  }
  return a;
}

function loadManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
}
function saveManifest(m) {
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

function nextIdNumber() {
  const nums = readdirSync(STORIES_DIR)
    .filter((f) => /^st-\d{4}\.json$/.test(f))
    .map((f) => Number(f.slice(3, 7)));
  return Math.max(0, ...nums) + 1;
}
const idOf = (n) => `st-${String(n).padStart(4, '0')}`;

function step(label, cmd, args) {
  process.stdout.write(`    ${label} ... `);
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(ok ? 'OK' : `HATA (exit ${r.status})`);
  if (!ok && r.stderr) console.log(`      ${String(r.stderr).trim().split('\n').slice(-2).join(' | ')}`);
  return ok;
}

function loadSpecs(args) {
  if (args.kind === 'classics') {
    const specPath = typeof args.spec === 'string'
      ? path.resolve(args.spec)
      : path.join(REPO_ROOT, 'pipeline', 'v2-classics.json');
    const all = JSON.parse(readFileSync(specPath, 'utf8'));
    return all.map((c) => ({ ...c, kind: 'classic' }));
  }
  if (args.kind === 'originals') {
    if (typeof args.spec !== 'string') throw new Error('--originals için --spec <konsept.json> gerekli');
    const all = JSON.parse(readFileSync(path.resolve(args.spec), 'utf8'));
    return all.map((c) => ({ ...c, kind: 'original' }));
  }
  throw new Error('--kind classics|originals gerekli');
}

async function main() {
  const args = parseArgs(process.argv);
  const from = args.from ? Number(args.from) : 0;
  const count = args.count ? Number(args.count) : Infinity;
  const specs = loadSpecs(args).slice(from, from === undefined ? undefined : from + count);

  const manifest = loadManifest();

  // Kimlikleri baştan rezerve et (çakışmasız, tekrar-çalıştırmada sabit).
  let nextNum = nextIdNumber();
  for (const s of specs) {
    const key = `${s.kind}:${s.title}`;
    if (!manifest[key]) manifest[key] = { id: idOf(nextNum++), steps: {} };
  }
  saveManifest(manifest);

  const done = [];
  const failed = [];

  for (const s of specs) {
    const key = `${s.kind}:${s.title}`;
    const entry = manifest[key];
    const id = entry.id;
    const storyPath = path.join(STORIES_DIR, `${id}.json`);
    console.log(`\n${id} — ${s.title} (${s.genre}, ${s.kind})`);

    const mark = (name, ok) => { entry.steps[name] = ok ? 'done' : 'fail'; saveManifest(manifest); };
    const storyHas = (fn) => (existsSync(storyPath) ? fn(JSON.parse(readFileSync(storyPath, 'utf8'))) : false);

    // 1 generate-story
    if (entry.steps.gen !== 'done' || !existsSync(storyPath)) {
      const ga = ['pipeline/generate-story.mjs', '--genre', s.genre, '--id', id];
      if (s.kind === 'classic') ga.push('--retell', '--title', s.title, '--plot', s.plot);
      else ga.push('--title', s.title, '--concept', s.concept);
      if (!step('1 generate-story', NODE, ga)) { mark('gen', false); failed.push(id); continue; }
      mark('gen', true);
    } else console.log('    1 generate-story ... atlandı (var)');

    // 2 validate-level --fix  (A1-B2)  — rejected olursa story dosyası taşınır
    if (entry.steps.validate !== 'done') {
      const ok = step('2 validate-level --fix --keep', NODE, ['pipeline/validate-level.mjs', '--story', storyPath, '--fix', '--keep']);
      if (!ok || !existsSync(storyPath)) { mark('validate', false); failed.push(id); continue; }
      mark('validate', true);
    } else console.log('    2 validate-level ... atlandı');

    // 3 summaries
    if (entry.steps.summary !== 'done' || !storyHas((st) => st.summary)) {
      if (!step('3 generate-summaries', NODE, ['pipeline/generate-summaries.mjs', id])) { mark('summary', false); }
      else mark('summary', true);
    } else console.log('    3 summaries ... atlandı');

    // 4 generate-c1
    if (entry.steps.c1 !== 'done' || !storyHas((st) => st.levels?.C1)) {
      if (!step('4 generate-c1', NODE, ['pipeline/generate-c1.mjs', '--ids', id])) { mark('c1', false); failed.push(id); continue; }
      mark('c1', true);
    } else console.log('    4 generate-c1 ... atlandı');

    // 5 normalize
    step('5 normalize-c1', NODE, ['pipeline/normalize-c1.mjs', '--story', storyPath]);
    mark('normalize', true);

    // 5b gramer duzeltme (DETERMINISTIK, LLM yok): uretilen metindeki
    //     ozne-yuklem/artikel uyum hatalarini kurala baglar (gramer dersi).
    step('5b grammar-fix (kural)', NODE, ['pipeline/fix-grammar-rules.mjs', '--ids', id]);

    // 6 audit STRICT (hard-fail gecidi): yeni uretim uyum/baslik/tavan
    //    kapilarindan gecmeden kataloga giremez.
    if (!step('6 audit --strict', NODE, ['pipeline/audit.mjs', '--story', storyPath, '--strict'])) {
      mark('audit', false); failed.push(id); continue;
    }
    mark('audit', true);

    // 7 audio A1-C1
    if (entry.steps.audio !== 'done' || storyHas((st) => st.levels?.C1?.audio == null)) {
      if (!step('7 generate-audio', PY, ['pipeline/generate-audio.py', '--story', storyPath, '--levels', 'A1,A2,B1,B2,C1'])) {
        mark('audio', false); failed.push(id); continue;
      }
      mark('audio', true);
    } else console.log('    7 audio ... atlandı');

    done.push(id);
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Tamamlanan: ${done.length}/${specs.length}  [${done.join(', ')}]`);
  if (failed.length) {
    console.log(`Başarısız/eksik: ${[...new Set(failed)].join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
