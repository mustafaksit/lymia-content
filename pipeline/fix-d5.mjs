#!/usr/bin/env node
/* D5 duzeltme: yanlis-bolunmus cumleleri birlestir + markdown '*' sizmasini
 * temizle. st-0215 (kesik-diyalog, kasitli) DOKUNULMAZ. Log: fix-d5-log.md */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);
const log = [];
const norm = (t) => t.replace(/\s+/g, ' ').trim();

// birlestir: seviyede text===a olan cumleyi, hemen sonrasi (text===b) ile birlestir
function merge(id, lvl, a, b, joiner = ' ', stripInnerQuotes = false) {
  const st = JSON.parse(readFileSync(S(id), 'utf8'));
  for (const p of st.levels[lvl].paragraphs) {
    const ss = p.sentences;
    for (let i = 0; i < ss.length - 1; i++) {
      if (norm(ss[i].text) === norm(a) && norm(ss[i + 1].text) === norm(b)) {
        let left = ss[i].text.trim(), right = ss[i + 1].text.trim();
        if (stripInnerQuotes) { left = left.replace(/['"]$/, ''); right = right.replace(/^['"]/, ''); }
        const merged = left + joiner + right;
        const audioStart = ss[i].audioStart, audioEnd = ss[i + 1].audioEnd;
        ss.splice(i, 2, { text: merged, audioStart, audioEnd });
        writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
        log.push(`### ${id} / ${lvl} — BIRLESTIR\n- ~~${a}~~\n- ~~${b}~~\n- ✅ ${merged}\n`);
        return true;
      }
    }
  }
  log.push(`### ${id} / ${lvl} — ⚠️ BIRLESTIR HEDEF BULUNAMADI: "${a}" + "${b}"\n`);
  return false;
}

// '*' temizle: seviyede '*' iceren cumlelerden yildizlari sil
function stripStars(id, lvl) {
  const st = JSON.parse(readFileSync(S(id), 'utf8'));
  let n = 0;
  for (const p of st.levels[lvl].paragraphs) for (const s of p.sentences) {
    if (s.text.includes('*')) { const before = s.text; s.text = s.text.replace(/\*/g, '').replace(/\s{2,}/g, ' ').trim(); log.push(`### ${id} / ${lvl} — '*' TEMIZLE\n- ~~${before}~~\n- ✅ ${s.text}\n`); n++; }
  }
  if (n) writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
  return n;
}

// ---- st-0003 (yanlis bolme) ----
merge('st-0003', 'A1', 'But sometimes, at three in the morning,', 'the little door says: tik.');
merge('st-0003', 'A2', 'But sometimes, at exactly three in the morning,', 'one small "tik" comes from the little door.');
// ---- st-0125 ----
merge('st-0125', 'A2', 'If the man had not hidden the Blue Carbuncle,', 'Holmes would have no clue.');
merge('st-0125', 'A2', 'If the man had offered more money,', 'the shop man might ask more questions.');
// ---- st-0216 ----
merge('st-0216', 'A1', 'If Gillian uses the money well,', 'he gets more.');
merge('st-0216', 'A1', 'If he uses it badly,', 'he gets nothing.');
merge('st-0216', 'A1', 'The note says Gillian gets nothing', 'if he uses money badly.');
// ---- st-0222 (diyalog birlesimi) ----
merge('st-0222', 'A1', "He says, 'In the land of no eyes,'", "'the man with one eye can lead.'", ' ', true);
merge('st-0222', 'A2', "He said, 'In a place where people cannot see,'", "'a man who can see is the leader.'", ' ', true);
// ---- markdown '*' sizmasi ----
stripStars('st-0221', 'C1');
stripStars('st-0222', 'C1');
// ---- st-0215: kasitli kesik-diyalog, DEGISIKLIK YOK ----
log.push(`### st-0215 / C1 — DEGISIKLIK YOK\n- "I-I only thought-" kasitli kesik-diyalog (sonraki satir "interrupted" ile devam ediyor). Yanlis-pozitif, dokunulmadi.\n`);

writeFileSync(path.join(ROOT, 'pipeline', 'fix-d5-log.md'), '# D5 Duzeltme Logu\n\n' + log.join('\n') + '\n');
console.log(log.join('\n'));
