// D1-D5 kalite dedektorleri (kural tabanli, LLM yok). quality-diagnosis.mjs
// (katalog taramasi) ve qa/ kapilari (yeni icerik) ayni kurallari kullanir.
import { agreementIssues } from './agreement.mjs';

// ---------- DESEN 1: birebir ceviri / anlamsal hata (heuristik kalip) ----------
export const CALQUE = [
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
export function desen2(text) {
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
export const isCondInjection = (s) => /\bif\b/i.test(s) && /\bwill\b/i.test(s);

// ---------- DESEN 5: kesik/eksik metin ----------
export const endsOK = (s) => /[.!?…][»"'”’)\]]*$/.test(s);

// ---------- tek hikaye/seviye taramasi ----------
const norm = (x) => x.toLowerCase().replace(/\s+/g, ' ').trim();

/** Bir seviyenin cumle ve paragraf metinleri icin D1-D5 bulgulari (bos dizi = temiz). */
export function detectLevel(lvl, sents, paras) {
  const joined = sents.join(' ');
  const d1 = [];
  for (const c of CALQUE) {
    const m = joined.match(new RegExp(c.re, c.re.flags.includes('g') ? c.re.flags : c.re.flags + 'g'));
    if (m) d1.push({ note: c.note, ex: [...new Set(m)].slice(0, 3) });
  }
  const h2 = new Set();
  for (const s of sents) for (const h of desen2(s)) h2.add(h);
  const d2 = [...h2];
  const d3 = lvl === 'B1' ? sents.filter(isCondInjection) : [];
  const freq = new Map();
  for (const s of sents) if (s.length >= 25) { const k = norm(s); freq.set(k, (freq.get(k) || 0) + 1); }
  const reps = [...freq.entries()].filter(([, c]) => c >= 2).map(([k, c]) => `(${c}x) ${k}`);
  let dupPara = 0;
  for (let i = 1; i < paras.length; i++) if (paras[i] && norm(paras[i]) === norm(paras[i - 1])) dupPara++;
  const d4 = [...reps, ...(dupPara ? [`ardisik ayni paragraf: ${dupPara}`] : [])];
  const d5 = sents.filter((s) => s && !endsOK(s));
  return { d1, d2, d3, d4, d5 };
}
