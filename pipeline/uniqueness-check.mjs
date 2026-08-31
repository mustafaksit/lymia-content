#!/usr/bin/env node
/* Benzersizlik analizi: baslik cakismasi + baslik benzerligi (Levenshtein) +
 * B1 icerik benzerligi (TF-IDF cosine) + kaynak dagilimi. Salt-okunur; ciktisi
 * pipeline/uniqueness-report.md ve stdout ozet. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = path.join(ROOT, 'content', 'stories');

// ---------- yukle ----------
const files = readdirSync(STORIES).filter((f) => f.endsWith('.json')).sort();
const stories = files.map((f) => {
  const s = JSON.parse(readFileSync(path.join(STORIES, f), 'utf8'));
  const lvl = s.levels?.B1 || s.levels?.B2 || Object.values(s.levels || {})[0];
  const b1 = (lvl?.paragraphs || []).map((p) => (p.sentences || []).map((x) => x.text).join(' ')).join('\n');
  return { id: s.id, title: s.title || '', b1 };
});

// ---------- normalize helpers ----------
const normTitleExact = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();
const normTitleMatch = (t) =>
  t.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- 1) baslik cakismasi (birebir, normalize case+bosluk) ----------
const byExact = new Map();
for (const s of stories) {
  const k = normTitleExact(s.title);
  if (!byExact.has(k)) byExact.set(k, []);
  byExact.get(k).push(s);
}
const exactDups = [...byExact.values()].filter((g) => g.length > 1);

// ---------- 2) baslik benzerligi (Levenshtein ratio >= 0.80) ----------
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
const titleNorm = stories.map((s) => normTitleMatch(s.title));
const titlePairs = [];
for (let i = 0; i < stories.length; i++) {
  for (let j = i + 1; j < stories.length; j++) {
    const a = titleNorm[i], b = titleNorm[j];
    if (!a.length || !b.length) continue;
    const d = lev(a, b);
    const ratio = 1 - d / Math.max(a.length, b.length);
    if (ratio >= 0.8) titlePairs.push({ a: stories[i], b: stories[j], ratio });
  }
}
titlePairs.sort((x, y) => y.ratio - x.ratio);

// ---------- 3) B1 icerik benzerligi (TF-IDF cosine >= 0.70) ----------
const STOP = new Set(('a an the and or but if then else of to in on at for with as by from up down out off over under is are was were be been being do does did has have had will would can could may might must shall should not no yes it its it\'s he she they them his her their we you your i me my this that these those there here so too very just about into than more most some any all one two').split(' '));
const tokenize = (txt) => (txt.toLowerCase().match(/[a-z']+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
const docTokens = stories.map((s) => tokenize(s.b1));
const df = new Map();
for (const toks of docTokens) for (const w of new Set(toks)) df.set(w, (df.get(w) || 0) + 1);
const N = stories.length;
const idf = new Map();
for (const [w, c] of df) idf.set(w, Math.log(N / c));
// tf-idf vektorleri (sparse) + norm
const vecs = docTokens.map((toks) => {
  const tf = new Map();
  for (const w of toks) tf.set(w, (tf.get(w) || 0) + 1);
  const v = new Map();
  let sq = 0;
  for (const [w, c] of tf) { const val = c * (idf.get(w) || 0); if (val) { v.set(w, val); sq += val * val; } }
  return { v, norm: Math.sqrt(sq) || 1 };
});
const contentPairs = [];
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    const A = vecs[i], B = vecs[j];
    // kucuk olan uzerinden don
    const [small, big] = A.v.size < B.v.size ? [A, B] : [B, A];
    let dot = 0;
    for (const [w, val] of small.v) { const o = big.v.get(w); if (o) dot += val * o; }
    const cos = dot / (A.norm * B.norm);
    if (cos >= 0.7) contentPairs.push({ a: stories[i], b: stories[j], cos });
  }
}
contentPairs.sort((x, y) => y.cos - x.cos);
// esik alti olsa da en yuksek 5 icerik cifti (seffaflik)
const allContent = [];
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  const A = vecs[i], B = vecs[j];
  const [small, big] = A.v.size < B.v.size ? [A, B] : [B, A];
  let dot = 0; for (const [w, val] of small.v) { const o = big.v.get(w); if (o) dot += val * o; }
  allContent.push({ a: stories[i], b: stories[j], cos: dot / (A.norm * B.norm) });
}
allContent.sort((x, y) => y.cos - x.cos);
const top5content = allContent.slice(0, 5);

// ---------- 4) kaynak dagilimi ----------
const load = (f) => JSON.parse(readFileSync(path.join(ROOT, 'pipeline', f), 'utf8'));
const originalSet = new Set(load('v2-originals.json').map((x) => normTitleMatch(x.title)));
const pdSet = new Set();
for (const f of ['v2-classics.json', 'v2-remaining-pd.json', 'v2-batch1-fables.json'])
  for (const x of load(f)) pdSet.add(normTitleMatch(x.title));
// faz2 md tablosundan da ekle
const faz2 = readFileSync(path.join(ROOT, 'docs', 'faz2-aday-listesi.md'), 'utf8');
for (const line of faz2.split('\n')) {
  if (!line.startsWith('|')) continue;
  const inner = line.split('|').map((c) => c.trim()).slice(1, -1);
  if (inner.length < 7 || !/^\d+$/.test(inner[0])) continue;
  if (/bkz\.|ELENDI/i.test(inner[1])) continue;
  pdSet.add(normTitleMatch(inner[1]));
}

// erken v1 katalogunda (v2 kaynaklarindan onceki ilk hikayeler) yer alan
// taninmis PD tam-eser basliklari (elle tespit; digerleri ozgun v1 konsept)
const V1_PD = new Set([
  'the happy prince and other tales', 'the adventures of sherlock holmes',
  'alice s adventures in wonderland', 'the adventures of tom sawyer complete',
  'a christmas carol in prose being a ghost story of christmas',
  'the wonderful wizard of oz',
].map((x) => x.replace(/\s+/g, ' ').trim()));

const dist = { ozgun: [], pd: [], belirsiz: [] };
for (const s of stories) {
  const k = normTitleMatch(s.title);
  if (originalSet.has(k)) dist.ozgun.push(s);       // v2-originals.json
  else if (pdSet.has(k)) dist.pd.push(s);           // v2 PD kaynaklari
  else if (V1_PD.has(k)) dist.pd.push(s);           // erken v1 PD tam-eser
  else dist.ozgun.push(s);                          // erken v1 ozgun konsept
}

// ---------- rapor ----------
const L = [];
L.push('# Benzersizlik Raporu — 200 Hikaye', '');
L.push(`Uretim tarihi taramasi: ${N} hikaye tarandi (content/stories/).`, '');
L.push('## 1) Baslik Cakismasi (birebir, normalize case+bosluk)', '');
if (!exactDups.length) L.push('Birebir ayni baslik **YOK**. ✅', '');
else { L.push('| Normalize Baslik | Hikayeler |', '|---|---|'); for (const g of exactDups) L.push(`| ${g[0].title} | ${g.map((x) => x.id).join(', ')} |`); L.push(''); }

L.push('## 2) Baslik Benzerligi (Levenshtein ratio ≥ %80)', '');
if (!titlePairs.length) L.push('Esik ustu benzer baslik cifti **YOK**. ✅', '');
else { L.push('| Skor | Hikaye A | Hikaye B |', '|---|---|---|'); for (const p of titlePairs) L.push(`| %${(p.ratio * 100).toFixed(0)} | ${p.a.id} — ${p.a.title} | ${p.b.id} — ${p.b.title} |`); L.push(''); }

L.push('## 3) Icerik/Kurgu Benzerligi (B1 TF-IDF cosine ≥ %70)', '');
if (!contentPairs.length) L.push('Esik ustu (≥%70) benzer icerik cifti **YOK**. ✅', '');
else { L.push('| Skor | Hikaye A | Hikaye B |', '|---|---|---|'); for (const p of contentPairs) L.push(`| %${(p.cos * 100).toFixed(0)} | ${p.a.id} — ${p.a.title} | ${p.b.id} — ${p.b.title} |`); L.push(''); }
L.push('En yuksek 5 icerik benzerligi (esik alti, referans icin):', '');
L.push('| Skor | Hikaye A | Hikaye B |', '|---|---|---|');
for (const p of top5content) L.push(`| %${(p.cos * 100).toFixed(0)} | ${p.a.id} — ${p.a.title} | ${p.b.id} — ${p.b.title} |`);
L.push('');

L.push('## 4) Kaynak Dagilimi', '');
L.push('| Kaynak | Adet |', '|---|---|');
L.push(`| Ozgun konsept | ${dist.ozgun.length} |`);
L.push(`| Public domain uyarlama | ${dist.pd.length} |`);
L.push(`| **Toplam** | **${N}** |`, '');
L.push('**Notlar:**', '');
L.push('- Story JSON\'larinda `source` alani yok; siniflama baslik eslesmesiyle yapildi.', '');
L.push('- Ozgun = erken v1 katalog ozgun konseptleri. `v2-originals.json` (24 ozgun aday) basliklarindan HICBIRI uretilmemis — kuyrugun sonundaydilar, hedefe onlardan once ulasildi.', '');
L.push('- PD uyarlama = v2-classics + v2-remaining-pd + v2-batch1-fables + faz2 listesi eslesenleri, ARTI erken v1 katalogundaki 6 taninmis PD tam-eser (Happy Prince, Sherlock Holmes, Alice, Tom Sawyer, A Christmas Carol, Wizard of Oz).', '');

writeFileSync(path.join(ROOT, 'pipeline', 'uniqueness-report.md'), L.join('\n') + '\n');

// stdout ozet
console.log('=== OZET ===');
console.log('Toplam hikaye:', N);
console.log('1) Birebir baslik cakismasi:', exactDups.length, 'grup');
console.log('2) Baslik benzerligi (>=80%):', titlePairs.length, 'cift');
console.log('3) Icerik benzerligi B1 (>=70%):', contentPairs.length, 'cift');
console.log('4) Kaynak: ozgun=', dist.ozgun.length, '| PD=', dist.pd.length);
console.log('\n-- en yuksek 5 icerik benzerligi (esik alti) --');
for (const p of top5content) console.log(`  %${(p.cos*100).toFixed(0)}  ${p.a.id} "${p.a.title}"  <>  ${p.b.id} "${p.b.title}"`);
if (titlePairs.length) { console.log('\n-- baslik benzer ciftleri --'); for (const p of titlePairs) console.log(`  %${(p.ratio*100).toFixed(0)}  ${p.a.id} "${p.a.title}"  <>  ${p.b.id} "${p.b.title}"`); }
if (contentPairs.length) { console.log('\n-- icerik benzer ciftleri --'); for (const p of contentPairs) console.log(`  %${(p.cos*100).toFixed(0)}  ${p.a.id} "${p.a.title}"  <>  ${p.b.id} "${p.b.title}"`); }
