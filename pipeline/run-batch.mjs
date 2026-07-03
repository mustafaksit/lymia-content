#!/usr/bin/env node
/**
 * Katalog parti üreticisi (PHASE-15 İş Paketi B).
 *
 * Günlük ücretsiz Gemini kotasını gözeterek hedef dağılıma (docs/02-CONTENT-SPEC)
 * ulaşana kadar hikaye üretir: üret -> doğrula(+fix) -> ses -> kapak -> index.
 * Kota bitince (Gemini 429) state kaydedip TEMİZ çıkar; ertesi gün aynı komut
 * kaldığı yerden sürer.
 *
 * Kullanım:
 *   node pipeline/run-batch.mjs                 # hedefe kadar (kota bitene dek)
 *   node pipeline/run-batch.mjs --max 5         # bu çalıştırmada en çok 5 hikaye
 *   node pipeline/run-batch.mjs --skip-audio    # hızlı deneme (ses atla)
 *   node pipeline/run-batch.mjs --classic-url <gutenberg .txt linki>  # sıradaki classic bunu kullanır
 *
 * State: pipeline/.batch-state.json (rejected + rapor geçmişi)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REPO_ROOT, STORIES_DIR, REJECTED_DIR } from './lib/env.mjs';

// docs/02-CONTENT-SPEC.md hedef dağılımı (50 hikaye)
const TARGET = {
  horror: 8,
  mystery: 8,
  adventure: 8,
  romance: 6,
  scifi: 6,
  daily: 8,
  classic: 6,
};

const STATE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.batch-state.json');
const REPORT_EVERY = 10;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) {
      args[a.slice(2)] = next;
      i++;
    } else {
      args[a.slice(2)] = true;
    }
  }
  return args;
}

function loadState() {
  return existsSync(STATE_FILE)
    ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    : { produced: 0, rejected: [], reports: [] };
}
function saveState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
}

/** Mevcut kataloğun tür bazlı sayımı. */
function catalogCounts() {
  const counts = {};
  for (const g of Object.keys(TARGET)) counts[g] = 0;
  if (!existsSync(STORIES_DIR)) return counts;
  for (const f of readdirSync(STORIES_DIR).filter((x) => x.endsWith('.json'))) {
    const story = JSON.parse(readFileSync(path.join(STORIES_DIR, f), 'utf8'));
    if (counts[story.genre] != null) counts[story.genre] += 1;
  }
  return counts;
}

/** Sıradaki üretilecek türü seç (hedefe en uzak, sabit tür sırasıyla). */
function nextGenre(counts) {
  for (const g of Object.keys(TARGET)) {
    if (counts[g] < TARGET[g]) return g;
  }
  return null;
}

/** Tek hikaye zinciri: generate -> validate --fix -> audio -> cover -> index.
 *  Dönüş: 'done' | 'rejected' | 'quota'. */
function produceOne(genre, { skipAudio, classicUrl }) {
  const node = process.execPath;
  const before = new Set(readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json')));

  const genArgs = ['pipeline/generate-story.mjs', '--genre', genre];
  if (genre === 'classic' && classicUrl) {
    genArgs.push('--source', 'gutenberg', '--url', classicUrl);
  } else {
    genArgs.push('--auto');
  }
  const gen = spawnSync(node, genArgs, { cwd: REPO_ROOT, encoding: 'utf8' });
  const genOut = (gen.stdout ?? '') + (gen.stderr ?? '');
  if (/HTTP 429|kota|quota/i.test(genOut) && gen.status !== 0) return 'quota';
  if (gen.status !== 0) {
    process.stderr.write(genOut);
    return 'rejected';
  }
  const created = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json') && !before.has(f));
  if (created.length !== 1) return 'rejected';
  const storyPath = path.join(STORIES_DIR, created[0]);

  const val = spawnSync(node, ['pipeline/validate-level.mjs', '--story', storyPath, '--fix'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const valOut = (val.stdout ?? '') + (val.stderr ?? '');
  if (/HTTP 429/i.test(valOut) && val.status !== 0) return 'quota';
  if (val.status !== 0 || !existsSync(storyPath)) return 'rejected'; // rejected/ altına taşındı

  if (!skipAudio) {
    const venv = path.join(REPO_ROOT, 'pipeline', '.venv', 'bin', 'python');
    const aud = spawnSync(venv, ['pipeline/generate-audio.py', '--story', storyPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (aud.status !== 0) process.stderr.write(aud.stderr ?? '');
  }

  const cov = spawnSync(node, ['pipeline/generate-cover.mjs', '--story', storyPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (/kota|429/i.test((cov.stdout ?? '') + (cov.stderr ?? '')) && cov.status !== 0) return 'quota';

  spawnSync(node, ['pipeline/build-index.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return 'done';
}

/** rejected/ klasöründen kalite raporu. */
function report(state) {
  const rejectedCount = existsSync(REJECTED_DIR)
    ? readdirSync(REJECTED_DIR).filter((f) => f.endsWith('.json')).length
    : 0;
  const counts = catalogCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const line =
    `RAPOR | katalog: ${total} hikaye | ` +
    Object.entries(counts)
      .map(([g, c]) => `${g} ${c}/${TARGET[g]}`)
      .join(', ') +
    ` | bu oturum üretilen: ${state.produced} | toplam reddedilen: ${rejectedCount}`;
  console.log('\n' + line + '\n');
  state.reports.push(line);
  saveState(state);
}

function main() {
  const args = parseArgs(process.argv);
  const maxThisRun = typeof args.max === 'string' ? Number(args.max) : Infinity;
  const skipAudio = Boolean(args['skip-audio']);
  const classicUrl = typeof args['classic-url'] === 'string' ? args['classic-url'] : null;

  const state = loadState();
  state.produced = 0; // bu çalıştırma sayacı
  let doneThisRun = 0;
  let sinceReport = 0;

  const goalTotal = Object.values(TARGET).reduce((a, b) => a + b, 0);
  console.log(`Hedef: ${goalTotal} hikaye. Başlıyor...`);

  while (doneThisRun < maxThisRun) {
    const counts = catalogCounts();
    const genre = nextGenre(counts);
    if (!genre) {
      console.log('Hedef dağılıma ulaşıldı.');
      break;
    }
    console.log(`\n=== ${genre} üretiliyor (${counts[genre] + 1}/${TARGET[genre]}) ===`);
    const result = produceOne(genre, { skipAudio, classicUrl: genre === 'classic' ? classicUrl : null });

    if (result === 'quota') {
      console.log('\nGünlük kota doldu. State kaydedildi; yarın aynı komutla devam edin.');
      report(state);
      return; // temiz çıkış (exit 0)
    }
    if (result === 'rejected') {
      state.rejected.push({ genre, at: 'run' });
      console.log(`${genre}: reddedildi (rejected/ altında), sıradakine geçiliyor.`);
    } else {
      state.produced += 1;
      doneThisRun += 1;
      sinceReport += 1;
      console.log(`${genre}: tamam.`);
    }
    saveState(state);
    if (sinceReport >= REPORT_EVERY) {
      report(state);
      sinceReport = 0;
    }
  }

  report(state);
  console.log('Parti bitti. Push için: git add -A && git commit && git push');
}

main();
