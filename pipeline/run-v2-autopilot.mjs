#!/usr/bin/env node
/**
 * G3 otopilotu: 200 hikayeye ulasana kadar KESINTISIZ uretir.
 *
 * Sira: [st-0129 retry] -> [v2-classics.json kalan 21] -> [v2-remaining-pd.json
 * ~126 PD retold] -> [v2-originals.json 24 ozgun]. Her hikaye run-v2-batch.mjs
 * alt-surecine devredilir (tek kaynaklik: uretim mantigi orada). Basarisiz
 * hikaye MAX_RETRY kadar yeniden denenir, sonra rejected/'e tasinir ve
 * kuyruktaki sonraki adaya gecilir (durmadan).
 *
 * TEK DURMA KOSULU: ayni siniflandirilmis hata turu 3+ FARKLI hikayede
 * tekrar ederse (sistematik sorun) -> otopilot durur, net mesaj basar.
 * Tekil red durdurmaz.
 *
 * Her CHECKPOINT_EVERY basarili hikayede docs/okuma-N.md yazilir (baslik+
 * ozet + rastgele 3 tam B1 metni), kesmeden devam eder.
 *
 * Kullanim: node pipeline/run-v2-autopilot.mjs [--target 200] [--resume]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, unlinkSync, renameSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, STORIES_DIR } from './lib/env.mjs';

const NODE = process.execPath;
const TARGET = Number((process.argv.find((a) => a.startsWith('--target')) && process.argv[process.argv.indexOf('--target') + 1]) || 200);
const CHECKPOINT_EVERY = 8;
const MAX_RETRY_PER_STORY = 2;
const SYSTEMIC_THRESHOLD = 3;
const LOG = path.join(REPO_ROOT, '.autopilot.log');
const STATE = path.join(REPO_ROOT, 'pipeline', '.autopilot-state.json');

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
}

function loadState() {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { doneTitles: [], failureCounts: {}, checkpointSeq: 0, sinceCheckpoint: [] };
}
function saveState(s) {
  writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function publishedPlusNewCount() {
  const idx = JSON.parse(readFileSync(path.join(REPO_ROOT, 'content', 'index.json'), 'utf8'));
  const files = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json'));
  // yayindaki 50 (index.json'da) + katalogda dosya olarak var olan HER SEY
  // (yeni uretilenler index'e girmiyor ama dosya olarak sayiliyor)
  return Math.max(idx.stories.length, files.length);
}


const MANIFEST = path.join(REPO_ROOT, 'pipeline', '.v2-batch-state.json');
function clearManifestEntry(kind, title) {
  if (!existsSync(MANIFEST)) return;
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const key = `${kind}:${title}`;
  if (m[key]) { delete m[key]; writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n'); }
}

/** run-v2-batch.mjs'i tek hikaye icin cagirir; { ok, output, id } doner. */
function produceOne(item) {
  let args;
  if (item.kind === 'classic-spec') {
    // ozel spec dosyasi (tek girisli gecici json) ile
    const tmp = path.join(REPO_ROOT, 'pipeline', `.tmp-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify([item.entry]));
    args = ['pipeline/run-v2-batch.mjs', '--kind', 'classics', '--spec', tmp, '--from', '0', '--count', '1'];
    const r = spawnSync(NODE, args, { cwd: REPO_ROOT, encoding: 'utf8' });
    try { unlinkSync(tmp); } catch {}
    return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
  }
  if (item.kind === 'classics-default') {
    args = ['pipeline/run-v2-batch.mjs', '--kind', 'classics', '--from', String(item.index), '--count', '1'];
  } else {
    args = ['pipeline/run-v2-batch.mjs', '--kind', 'originals', '--spec', 'pipeline/v2-originals.json', '--from', String(item.index), '--count', '1'];
  }
  const r = spawnSync(NODE, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
}

function classifyFailure(output) {
  if (/UZUNLUK TAVANI/.test(output)) return 'ceiling-exceeded';
  if (/baslik cakismasi/.test(output)) return 'title-collision';
  if (/uyum hatasi/.test(output)) return 'agreement-fail';
  if (/HTTP 429/.test(output)) return 'llm-quota';
  if (/HTTP 413/.test(output)) return 'llm-too-large';
  if (/HTTP 503/.test(output)) return 'llm-server-busy';
  if (/generate-audio.*HATA/.test(output)) return 'audio-error';
  if (/KALDI/.test(output)) return 'level-rule-fail';
  return 'unknown';
}

function writeCheckpoint(seq, newIds) {
  const stories = newIds.map((id) => JSON.parse(readFileSync(path.join(STORIES_DIR, `${id}.json`), 'utf8')));
  const out = [`# Okuma Raporu ${seq}`, '', `Bu partide ${stories.length} hikaye tamamlandi.`, '', '## Basliklar + ozetler', ''];
  for (const s of stories) out.push(`- **${s.title}** (${s.genre}): ${s.summary || '(ozet yok)'}`);
  out.push('', '## Rastgele 3 tam B1 (veya B2) metni', '');
  const sample = [...stories].sort(() => Math.random() - 0.5).slice(0, Math.min(3, stories.length));
  for (const s of sample) {
    const L = s.levels.B1 || s.levels.B2;
    const lvlName = s.levels.B1 ? 'B1' : 'B2';
    const text = L.paragraphs.map((p) => p.sentences.map((x) => x.text).join(' ')).join('\n\n');
    out.push(`### ${s.title} (${lvlName})`, '', text, '');
  }
  writeFileSync(path.join(REPO_ROOT, 'docs', `okuma-${seq}.md`), out.join('\n') + '\n');
  log(`Checkpoint yazildi: docs/okuma-${seq}.md (${stories.length} hikaye)`);
}

async function main() {
  const state = loadState();
  const doneTitles = new Set(state.doneTitles);

  // Kuyruk: [st-0129 retry] + [classics kalan 21] + [PD kalan] + [originals 24]
  const batch1Entry = JSON.parse(readFileSync('pipeline/v2-batch1-fables.json', 'utf8')).find((x) => x.title === 'The Crow and the Pitcher');
  const classics = JSON.parse(readFileSync('pipeline/v2-classics.json', 'utf8'));
  const pd = JSON.parse(readFileSync('pipeline/v2-remaining-pd.json', 'utf8'));
  const originals = JSON.parse(readFileSync('pipeline/v2-originals.json', 'utf8'));

  const queue = [];
  if (batch1Entry && !doneTitles.has(batch1Entry.title)) queue.push({ kind: 'classic-spec', title: batch1Entry.title, entry: batch1Entry });
  classics.slice(5).forEach((_, i) => {
    const c = classics[5 + i];
    if (!doneTitles.has(c.title)) queue.push({ kind: 'classics-default', title: c.title, index: 5 + i });
  });
  pd.forEach((c) => {
    if (!doneTitles.has(c.title)) queue.push({ kind: 'classic-spec', title: c.title, entry: { title: c.title, genre: c.genre, plot: c.plot } });
  });
  originals.forEach((c, i) => {
    if (!doneTitles.has(c.title)) queue.push({ kind: 'originals-default', title: c.title, index: i });
  });

  log(`Otopilot basladi. Kuyruk: ${queue.length} aday. Hedef: ${TARGET}. Su an: ${publishedPlusNewCount()}`);

  const sinceCheckpoint = state.sinceCheckpoint || [];
  let checkpointSeq = state.checkpointSeq || 0;

  for (const item of queue) {
    if (publishedPlusNewCount() >= TARGET) { log('HEDEFE ULASILDI.'); break; }

    let success = false;
    let lastReason = null;
    for (let attempt = 1; attempt <= MAX_RETRY_PER_STORY; attempt++) {
      // Stale manifest "done" bayraklari yeniden uretimin adimlarini atlamasin.
      clearManifestEntry(item.kind === 'classic-spec' ? 'classic' : (item.kind === 'classics-default' ? 'classic' : 'original'), item.title);
      const beforeFiles = new Set(readdirSync(STORIES_DIR));
      const res = produceOne(item);
      const afterFiles = readdirSync(STORIES_DIR).filter((f) => !beforeFiles.has(f));

      if (res.ok && afterFiles.length > 0) {
        success = true;
        const newId = afterFiles[0].replace('.json', '');
        sinceCheckpoint.push(newId);
        doneTitles.add(item.title);
        log(`OK  ${item.title} -> ${newId} (deneme ${attempt})`);
        break;
      }

      const reason = classifyFailure(res.output);
      // Icerik gecerli (audit --strict OK gecti) ama SADECE ses adimi
      // patladiysa: iceriği CÖPE ATMA, sesi bagimsiz yeniden dene. Toplu
      // paralel ses uretimi bazen gecici kesiliyor (bkz. batch-1), ama tek
      // hikaye + sirali generate-audio.py cagrisi guvenilir calisiyor.
      if (reason === 'audio-error' && afterFiles.length > 0) {
        // edge-tts (resmi olmayan API) aninda gecici kesinti yasayabilir;
        // manuel tekrar hemen calisiyor. Birkac deneme + kisa bekleme bu
        // kesintiyi bekler (tek anlik retry yetersiz kaldi - bkz. log).
        const newId = afterFiles[0].replace('.json', '');
        const storyPath = path.join(STORIES_DIR, `${newId}.json`);
        let audioOk = false;
        for (let aTry = 1; aTry <= 3; aTry++) {
          if (aTry > 1) await new Promise((r) => setTimeout(r, 8000));
          log(`AUDIO-RETRY ${item.title} (${newId}) - icerik gecerli, ses deneme ${aTry}/3`);
          const ar = spawnSync(path.join(REPO_ROOT, '.venv', 'bin', 'python'),
            ['pipeline/generate-audio.py', '--story', storyPath, '--levels', 'A1,A2,B1,B2,C1'],
            { cwd: REPO_ROOT, encoding: 'utf8' });
          if (ar.status === 0) { audioOk = true; break; }
          log(`AUDIO-RETRY-FAIL ${item.title} (${newId}) - deneme ${aTry}/3 basarisiz`);
        }
        if (audioOk) {
          success = true;
          sinceCheckpoint.push(newId);
          doneTitles.add(item.title);
          log(`OK  ${item.title} -> ${newId} (ses tekrar denemesinde basarili)`);
          break;
        }
      }

      lastReason = reason;
      log(`FAIL ${item.title} (deneme ${attempt}/${MAX_RETRY_PER_STORY}, sebep: ${reason})`);
      // yarim/bozuk dosya kaldiysa temizle (bir sonraki denemede cakismasin)
      const stray = readdirSync(STORIES_DIR).filter((f) => !beforeFiles.has(f));
      for (const f of stray) {
        try { renameSync(path.join(STORIES_DIR, f), path.join(REPO_ROOT, 'rejected', f)); } catch {}
      }
    }

    if (!success) {
      state.failureCounts[lastReason] = (state.failureCounts[lastReason] || 0) + 1;
      log(`RED ${item.title} - ${MAX_RETRY_PER_STORY} denemede basarisiz (${lastReason}). Sirada devam.`);
      // llm-quota / llm-server-busy: KOTA/SUNUCU YUKU tekrarlamasi kullanicinin
      // kendi kurali geregi durma sebebi DEGIL ("kota icin durup sorma, gece
      // boyu isle") - sadece GERCEK kod/icerik hatalari (uyum, baslik,
      // tavan, ses, unknown) sistematik durmayi tetikler.
      const EXEMPT_FROM_SYSTEMIC = new Set(['llm-quota', 'llm-server-busy', 'llm-too-large']);
      if (!EXEMPT_FROM_SYSTEMIC.has(lastReason) && state.failureCounts[lastReason] >= SYSTEMIC_THRESHOLD) {
        log(`\n!!! SISTEMATIK HATA: "${lastReason}" ${state.failureCounts[lastReason]} FARKLI hikayede tekrar etti. OTOPILOT DURDU. !!!\n`);
        saveState({ ...state, doneTitles: [...doneTitles], sinceCheckpoint, checkpointSeq });
        process.exit(3);
      }
    }

    if (sinceCheckpoint.length >= CHECKPOINT_EVERY) {
      checkpointSeq++;
      writeCheckpoint(checkpointSeq, sinceCheckpoint.splice(0, sinceCheckpoint.length));
    }
    saveState({ ...state, doneTitles: [...doneTitles], sinceCheckpoint, checkpointSeq });
  }

  if (sinceCheckpoint.length > 0) {
    checkpointSeq++;
    writeCheckpoint(checkpointSeq, sinceCheckpoint.splice(0, sinceCheckpoint.length));
  }
  saveState({ ...state, doneTitles: [...doneTitles], sinceCheckpoint, checkpointSeq });
  log(`Otopilot bitti. Toplam: ${publishedPlusNewCount()}/${TARGET}`);
}

main();
