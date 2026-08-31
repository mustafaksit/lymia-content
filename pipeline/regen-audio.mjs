#!/usr/bin/env node
/* Ses yenileme: audio-regen-queue.md'deki (id,seviye) ciftleri icin generate-audio.py.
 * Her seviyede karaoke timing dogrulama (timing kelime == metin kelime).
 * Ilerleme: pipeline/.regen-progress.json ; log: pipeline/regen-audio-log.md */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PY = path.join(ROOT, '.venv', 'bin', 'python');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);

// kuyruktan (id -> seviye kumesi)
const q = readFileSync(path.join(ROOT, 'pipeline', 'audio-regen-queue.md'), 'utf8');
const map = new Map();
for (const line of q.split('\n')) {
  const m = line.match(/^(st-\d+)\t(A1|A2|B1|B2|C1)\b/);
  if (!m) continue;
  if (!map.has(m[1])) map.set(m[1], new Set());
  map.get(m[1]).add(m[2]);
}
let stories = [...map.entries()].map(([id, set]) => ({ id, levels: [...set].sort() }));
if (process.argv.includes('--ids')) {
  const only = new Set(process.argv[process.argv.indexOf('--ids') + 1].split(','));
  stories = stories.filter((s) => only.has(s.id));
}

const wc = (txt) => (txt.match(/\S+/g) || []).length;
function verifyLevel(id, lvl) {
  const s = JSON.parse(readFileSync(S(id), 'utf8'));
  const L = s.levels[lvl]; if (!L) return { ok: false, why: 'seviye yok' };
  const words = wc(L.paragraphs.flatMap((p) => p.sentences.map((x) => x.text)).join(' '));
  const tp = path.join(ROOT, 'content', 'audio', lvl.toLowerCase(), `${id}.timings.json`);
  if (!existsSync(tp)) return { ok: false, why: 'timings yok' };
  const t = JSON.parse(readFileSync(tp, 'utf8'));
  const tw = Array.isArray(t) ? t.length : (t.words ? t.words.length : -1);
  return { ok: words === tw, words, tw };
}

const prog = { total: stories.length, doneStories: 0, levels: 0, verified: 0, mismatch: [], errors: [], current: null };
const log = ['# Ses Yeniden Uretim Logu', ''];
const save = () => writeFileSync(path.join(ROOT, 'pipeline', '.regen-progress.json'), JSON.stringify(prog, null, 2));
save();

for (const { id, levels } of stories) {
  prog.current = id; save();
  const r = spawnSync(PY, [path.join(ROOT, 'pipeline', 'generate-audio.py'), '--story', S(id), '--levels', levels.join(',')], { cwd: ROOT, encoding: 'utf8', timeout: 300000, killSignal: 'SIGKILL' });
  if (r.status !== 0 || r.signal) {
    prog.errors.push(`${id}:${r.signal ? 'TIMEOUT/' + r.signal : ((r.stderr || '').trim().split('\n').pop() || 'exit ' + r.status)}`);
    log.push(`## ${id} — ⚠️ HATA (exit ${r.status})\n${(r.stderr || '').slice(-200)}`);
    process.stderr.write(`!${id.slice(-3)}`); continue;
  }
  const lv = [];
  for (const l of levels) {
    prog.levels++;
    const v = verifyLevel(id, l);
    if (v.ok) { prog.verified++; lv.push(`${l}:✅${v.words}`); }
    else { prog.mismatch.push(`${id}/${l}(${v.words}≠${v.tw}${v.why ? ' ' + v.why : ''})`); lv.push(`${l}:⚠️${v.words}≠${v.tw}`); }
  }
  prog.doneStories++;
  log.push(`## ${id} — ${levels.join(',')} → ${lv.join(' ')}`);
  save();
  process.stderr.write(`.${id.slice(-3)}`);
}
prog.current = null; save();
writeFileSync(path.join(ROOT, 'pipeline', 'regen-audio-log.md'), log.join('\n') + '\n');
console.log(`\nSes yenileme bitti: ${prog.doneStories}/${prog.total} hikaye | ${prog.levels} seviye | timing dogrulanan ${prog.verified} | uyumsuz ${prog.mismatch.length} | hata ${prog.errors.length}`);
if (prog.mismatch.length) console.log('uyumsuz:', prog.mismatch.join(', '));
if (prog.errors.length) console.log('hata:', prog.errors.join(', '));
