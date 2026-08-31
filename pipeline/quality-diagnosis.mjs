#!/usr/bin/env node
/* Kalite teshisi: 5 deseni tarar, etkilenen hikaye/seviye/ornek cikarir.
 * Salt-okunur. Cikti: pipeline/quality-diagnosis.md + stdout ozet. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agreementIssues } from './lib/agreement.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = path.join(ROOT, 'content', 'stories');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const files = readdirSync(STORIES).filter((f) => f.endsWith('.json')).sort();
const stories = files.map((f) => JSON.parse(readFileSync(path.join(STORIES, f), 'utf8')));

const sentencesOf = (story, lvl) =>
  (story.levels?.[lvl]?.paragraphs || []).flatMap((p) => (p.sentences || []).map((s) => (s.text || '').trim()));
const paragraphsOf = (story, lvl) =>
  (story.levels?.[lvl]?.paragraphs || []).map((p) => (p.sentences || []).map((s) => s.text).join(' ').trim());

// ---------- DESEN 1: birebir ceviri / anlamsal hata (heuristik kalip) ----------
const CALQUE = [
  { re: /\bmade?\s+water\b/i, note: '"make/made water" (cry olmali?)' },
  { re: /\b(a|the|one)\s+new\s+(woman|man|girl|boy)\b/i, note: '"new woman/man" (young olmali?)' },
  { re: /\b(red|yellow|golden|gold|black|brown|white|gray|grey|long|short|curly|dark|fair)\s+head\b/i, note: 'renk/sifat + "head" (hair olmali?)' },
  { re: /\bhead\s+(was|is|are|were)\s+(long|short|red|yellow|golden|gold|black|brown|white|gray|grey|curly|fair|dark)\b/i, note: '"head was <sac-sifati>" (hair olmali?)' },
  { re: /\b(open|close)\s+the\s+(light|radio|television|tv)\b/i, note: 'open/close the light/tv (turn on/off olmali?)' },
  { re: /\bdrink\s+(a\s+)?cigarette/i, note: '"drink cigarette" (smoke olmali?)' },
  { re: /\bmake\s+(a\s+)?(sport|photo|picture)\b/i, note: '"make sport/photo" (do/take olmali?)' },
];

// ---------- DESEN 2: eksik fiil cekimi ----------
const BARE = 'say|go|see|make|take|have|want|need|like|feel|live|work|look|walk|talk|find|tell|ask|help|keep|hold|turn|call|run|come|give|know|think|become|leave|meet|write|play|show|sell|buy|move|open|close|grow|stay|reach|lead|point|carry|follow|build|sit|stand|eat|drink|sleep|speak|send|bring|wear|learn|teach|plan|hope|wish|visit|enter|climb|own|read|watch|love|hear';
const RE_REL_BARE = new RegExp(`\\b(who|that|which)\\s+(${BARE})\\b`, 'gi');
const RE_INDEF_BARE = new RegExp(`\\b(everyone|everybody|someone|somebody|nobody|nothing|something|no one)\\s+(${BARE})\\b`, 'gi');
// modal/yardimci/mastar-isareti: bunlardan biri "be"nin oncesindeki 2 token
// icinde varsa "be" mesru mastar/subjunctive'dir (ornek: "would simply be").
const BE_ALLOW = new Set(('to,not,will,would,wo,ll,d,can,could,shall,should,may,might,must,let,' +
  'help,helps,helped,make,makes,made,see,sees,saw,hear,hears,heard,watch,watches,' +
  'and,or,be,been,being,cannot,cant,dont,doesnt,didnt,never,always,also,still,rather,' +
  'only,just,simply,really,truly,soon,then,now,once,again,all,ever,otherwise,somehow,' +
  'certainly,surely,probably,perhaps,maybe,finally,suddenly,quickly').split(','));
const PLURAL_ANTE = new Set('people,they,we,friends,children,men,women,others,ones,kids,students,they,those,two,three,four,five,many,some,both'.split(','));
function bareBeHits(text) {
  const hits = [];
  const toks = text.split(/\s+/);
  for (let i = 1; i < toks.length; i++) {
    const w = toks[i].replace(/[^a-z]/gi, '').toLowerCase();
    if (w !== 'be') continue;
    const prev = toks[i - 1].replace(/[^a-z']/gi, '').toLowerCase();
    const prev2 = (toks[i - 2] || '').replace(/[^a-z']/gi, '').toLowerCase();
    if (!prev) continue;
    if (BE_ALLOW.has(prev) || BE_ALLOW.has(prev2)) continue; // modal/mastar/zarf zinciri
    hits.push(`${toks[i - 1]} ${toks[i]}`);
  }
  return hits;
}
function desen2(text) {
  const hits = [];
  for (const h of agreementIssues(text)) if (/tekil|be/.test(h.label)) hits.push(h.match);
  let m;
  // rel-clause + ciplak fiil: cogul oncul (people/they/two...) ise atla
  RE_REL_BARE.lastIndex = 0;
  while ((m = RE_REL_BARE.exec(text))) {
    const before = text.slice(0, m.index).trim().split(/\s+/).pop() || '';
    if (PLURAL_ANTE.has(before.replace(/[^a-z]/gi, '').toLowerCase())) continue;
    hits.push(m[0]);
  }
  RE_INDEF_BARE.lastIndex = 0; while ((m = RE_INDEF_BARE.exec(text))) hits.push(m[0]);
  hits.push(...bareBeHits(text));
  return hits;
}

// ---------- DESEN 3: B1 zorla sart cumlesi (if + will) ----------
const isCondInjection = (s) => /\bif\b/i.test(s) && /\bwill\b/i.test(s);

// ---------- DESEN 5: kesik/eksik metin ----------
const endsOK = (s) => /[.!?…][»"'”’)\]]*$/.test(s);

// ---------- tara ----------
const D = { d1: [], d2: [], d3: [], d4: [], d5: [] };
for (const st of stories) {
  const id = st.id;
  const d1 = [], d2 = [], d3 = [], d4 = [], d5 = [];
  for (const lvl of LEVELS) {
    const sents = sentencesOf(st, lvl);
    if (!sents.length) continue;
    const joined = sents.join(' ');
    // D1
    for (const c of CALQUE) { const m = joined.match(new RegExp(c.re, c.re.flags.includes('g') ? c.re.flags : c.re.flags + 'g')); if (m) d1.push({ lvl, note: c.note, ex: [...new Set(m)].slice(0, 3) }); }
    // D2
    const h2 = new Set(); for (const s of sents) for (const h of desen2(s)) h2.add(h);
    if (h2.size) d2.push({ lvl, count: h2.size, ex: [...h2].slice(0, 6) });
    // D3 (yalniz B1)
    if (lvl === 'B1') { const inj = sents.filter(isCondInjection); if (inj.length) d3.push({ lvl, count: inj.length, ex: inj.slice(0, 2) }); }
    // D4: tekrar eden cumle (>=25 char, >=2x) + ardisik ayni paragraf
    const norm = (x) => x.toLowerCase().replace(/\s+/g, ' ').trim();
    const freq = new Map(); for (const s of sents) { if (s.length >= 25) { const k = norm(s); freq.set(k, (freq.get(k) || 0) + 1); } }
    const reps = [...freq.entries()].filter(([, c]) => c >= 2);
    const paras = paragraphsOf(st, lvl); let dupPara = 0;
    for (let i = 1; i < paras.length; i++) if (paras[i] && norm(paras[i]) === norm(paras[i - 1])) dupPara++;
    if (reps.length || dupPara) d4.push({ lvl, repSent: reps.length, dupPara, ex: reps.slice(0, 2).map(([k, c]) => `(${c}x) ${k.slice(0, 60)}`) });
    // D5: terminal noktalama olmayan cumleler
    const bad = sents.filter((s) => s && !endsOK(s));
    if (bad.length) d5.push({ lvl, count: bad.length, ex: bad.slice(0, 3).map((s) => '…' + s.slice(-45)) });
  }
  if (d1.length) D.d1.push({ id, title: st.title, levels: d1 });
  if (d2.length) D.d2.push({ id, title: st.title, levels: d2 });
  if (d3.length) D.d3.push({ id, title: st.title, levels: d3 });
  if (d4.length) D.d4.push({ id, title: st.title, levels: d4 });
  if (d5.length) D.d5.push({ id, title: st.title, levels: d5 });
}

// ---------- rapor ----------
const L = [];
L.push('# Kalite Teshis Raporu — 200 Hikaye', '');
L.push(`Taranan: ${stories.length} hikaye. Yontem: kural-tabanli heuristik (yuksek recall, bir miktar yanlis-pozitif olabilir; ozellikle DESEN 1 semantik oldugu icin insan/LLM dogrulamasi gerektirir).`, '');
L.push('## Ozet', '', '| Desen | Etkilenen hikaye | ',  '|---|---|');
L.push(`| 1 — Birebir ceviri / anlamsal hata (heuristik) | ${D.d1.length} |`);
L.push(`| 2 — Eksik fiil cekimi (bare "be", 3.tekil -s) | ${D.d2.length} |`);
L.push(`| 3 — B1 zorla sart cumlesi (if+will) | ${D.d3.length} |`);
L.push(`| 4 — Paragraf/cumle tekrari | ${D.d4.length} |`);
L.push(`| 5 — Kesik/eksik metin | ${D.d5.length} |`, '');

function section(key, title, fmt) {
  L.push(`## ${title}`, '');
  const arr = D[key];
  if (!arr.length) { L.push('Tespit **YOK**. ✅', ''); return; }
  L.push(`Etkilenen: **${arr.length}** hikaye.`, '');
  for (const s of arr) { L.push(`### ${s.id} — ${s.title}`); for (const lv of s.levels) L.push(fmt(lv)); L.push(''); }
}
section('d1', 'DESEN 1 — Birebir ceviri / anlamsal hata', (lv) => `- **${lv.lvl}** — ${lv.note}: ${lv.ex.map((e) => `\`${e}\``).join(', ')}`);
section('d2', 'DESEN 2 — Eksik fiil cekimi', (lv) => `- **${lv.lvl}** (${lv.count} bulgu): ${lv.ex.map((e) => `\`${e}\``).join(', ')}`);
section('d3', 'DESEN 3 — B1 zorla sart cumlesi', (lv) => `- **${lv.lvl}** (${lv.count} cumle): ${lv.ex.map((e) => `"${e}"`).join(' | ')}`);
section('d4', 'DESEN 4 — Paragraf/cumle tekrari', (lv) => `- **${lv.lvl}** (tekrar cumle: ${lv.repSent}, ardisik ayni paragraf: ${lv.dupPara}): ${lv.ex.join(' | ')}`);
section('d5', 'DESEN 5 — Kesik/eksik metin', (lv) => `- **${lv.lvl}** (${lv.count} cumle): ${lv.ex.join(' | ')}`);

writeFileSync(path.join(ROOT, 'pipeline', 'quality-diagnosis.md'), L.join('\n') + '\n');

// stdout
const line = (k, t) => console.log(`${t}: ${D[k].length} hikaye`);
console.log('=== OZET ==='); console.log('Taranan:', stories.length);
line('d1', 'DESEN 1 birebir-ceviri'); line('d2', 'DESEN 2 fiil-cekimi'); line('d3', 'DESEN 3 B1 sart-cumlesi'); line('d4', 'DESEN 4 tekrar'); line('d5', 'DESEN 5 kesik-metin');
for (const [k, t] of [['d1', 'D1'], ['d2', 'D2'], ['d3', 'D3'], ['d4', 'D4'], ['d5', 'D5']]) {
  console.log(`\n-- ${t} (${D[k].length}) --`);
  console.log(D[k].map((s) => s.id).join(', ') || '(yok)');
}
