#!/usr/bin/env node
/* D2 ROUND 2 — genisletilmis detektor, TUM katalog (200). LLM ile duzelt.
 * EKLE: proper-noun ozne + ciplak fiil; det+tekil-isim + ciplak fiil.
 * DUZELT: imperatif "Be" muaf; baglac "that" FP cikarildi (yalniz who/which).
 * Guard: minimal-edit + d2count2 dusmeli. Log: fix-d2-round2-log.md */
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.mjs';
import { agreementIssues } from './lib/agreement.mjs';
loadEnv();
const { callGemini, parseJsonResponse } = await import('./lib/gemini.mjs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);

const BARE = 'say|go|see|make|take|have|want|need|like|feel|live|work|look|walk|talk|find|tell|ask|help|keep|hold|turn|call|run|come|give|know|think|become|leave|meet|write|read|play|show|sell|buy|move|open|close|grow|stay|reach|lead|point|carry|follow|build|sit|stand|eat|drink|sleep|speak|send|wear|learn|teach|plan|hope|wish|visit|enter|climb|use|pull|push|jump|decide|own|love|watch|remind|remember|bring';
const BARE_RE = new RegExp('^(' + BARE + ')$', 'i');
const BE_ALLOW = new Set(('to,not,will,would,wo,ll,d,can,could,shall,should,may,might,must,let,help,helps,helped,make,makes,made,see,sees,saw,hear,hears,heard,watch,watches,and,or,be,been,being,cannot,cant,dont,doesnt,didnt,never,always,also,still,rather,only,just,simply,really,truly,soon,then,now,once,again,all,ever,otherwise,somehow,certainly,surely,probably,perhaps,maybe,finally,suddenly,quickly').split(','));
const PLURAL_ANTE = new Set('people,they,we,friends,children,men,women,others,ones,kids,students,those,two,three,four,five,many,some,both,villagers,animals,birds,boys,girls,parents,things,words,books,stories,covers,days,swans,dogs,cats,eyes,hands'.split(','));
const STARTERS = new Set('The,He,She,It,They,We,You,But,And,So,Then,When,After,Before,Now,Here,There,This,That,These,Those,A,An,One,Both,All,Some,Many,Each,Every,His,Her,Their,Our,My,Your,If,As,At,In,On,Of,To,For,With,From,By,No,Not,Yes,Why,How,What,Who,Where,Later,Soon,Once,Today,Yesterday,Tomorrow,Suddenly,Finally,Meanwhile'.split(','));
const SINGDET = new Set('the,a,an,this,every,each,one'.split(','));

const clean = (w) => w.replace(/[^a-z']/gi, '').toLowerCase();
// ciplak finite "be" (imperatif ve modal/mastar haric)
function bareBe(text) {
  const out = []; const toks = text.split(/\s+/);
  for (let i = 1; i < toks.length; i++) {
    if (toks[i].replace(/[^a-z]/g, '') === 'be') { // yalniz kucuk harf 'be' (imperatif "Be" haric)
      const rawPrev = toks[i - 1];
      const prev = clean(rawPrev), prev2 = clean(toks[i - 2] || '');
      if (!prev || BE_ALLOW.has(prev) || BE_ALLOW.has(prev2)) continue;
      if (/["'“‘,]$/.test(rawPrev)) continue; // tirnak/virgul sonrasi -> imperatif/aliinti
      out.push(`${rawPrev} ${toks[i]}`);
    }
  }
  return out;
}
function properNounBare(text) {
  const out = []; const re = /\b([A-Z][a-z]+)\s+([a-z]+)\b/g; let m;
  while ((m = re.exec(text))) {
    if (m.index === 0) continue; // cumle basi
    const before = text.slice(0, m.index).trim();
    if (!before || /[.!?"'“‘]$/.test(before)) continue; // cumle/aliinti basi
    if (STARTERS.has(m[1])) continue;
    if (BARE_RE.test(m[2]) && !BE_ALLOW.has(m[2].toLowerCase())) out.push(`${m[1]} ${m[2]}`);
  }
  return out;
}
function detNounBare(text) {
  const out = []; const re = /\b(the|a|an|this|every|each|one)\s+([a-z]+)\s+([a-z]+)\b/gi; let m;
  while ((m = re.exec(text))) {
    const det = m[1].toLowerCase(), noun = m[2].toLowerCase(), verb = m[3].toLowerCase();
    if (!SINGDET.has(det)) continue;
    if (/s$/.test(noun)) continue;            // cogul gorunumlu
    if (PLURAL_ANTE.has(noun)) continue;
    if (!BARE_RE.test(verb) || BE_ALLOW.has(verb)) continue;
    if (['who','that','which','and','or','but'].includes(noun)) continue;
    out.push(`${m[1]} ${noun} ${verb}`);
  }
  return out;
}
function relWhoWhich(text) {
  const out = []; const re = new RegExp(`\\b(who|which)\\s+(${BARE})\\b`, 'gi'); let m;
  while ((m = re.exec(text))) { const b = clean(text.slice(0, m.index).trim().split(/\s+/).pop() || ''); if (!PLURAL_ANTE.has(b)) out.push(m[0]); }
  return out;
}
const RE_INDEF = new RegExp(`\\b(everyone|everybody|someone|somebody|nobody|no one)\\s+(${BARE})\\b`, 'gi');
function indef(text) { const out = []; let m; RE_INDEF.lastIndex = 0; while ((m = RE_INDEF.exec(text))) { if (/^(like|help)$/i.test(m[2])) continue; out.push(m[0]); } return out; }

function d2c2(text) {
  let n = agreementIssues(text).filter((h) => /tekil|be/.test(h.label)).length;
  n += bareBe(text).length + properNounBare(text).length + detNounBare(text).length + relWhoWhich(text).length + indef(text).length;
  return n;
}

const toks = (s) => new Set(s.toLowerCase().match(/[a-z']+/g) || []);
function minimalEdit(a, b) {
  if (!b || !b.trim()) return false; if (b.length < a.length * 0.5 || b.length > a.length * 2) return false;
  const A = toks(a), B = toks(b); let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter || 1) >= 0.5;
}
const INSTR = `Fix ONLY verb agreement in the target sentence. Change bare 'be' to correct tense (is/are/was/were per context), add missing 3rd person -s (Sue say->Sue says, the act remind->reminds). Do NOT change vocabulary, plot or style; do NOT add words. Watch: 'that' after said/knew/felt is a CONJUNCTION (don't touch its verb); 'like' can be a preposition; an imperative 'Be ...' inside quotes is a command (leave it). Check subject plurality before adding -s. Keep it a minimal edit.`;

const ALL = readdirSync(path.join(ROOT, 'content', 'stories')).filter((f) => f.endsWith('.json')).sort().map((f) => f.replace('.json', ''));
const argIds = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : ALL;
const log = ['# D2 ROUND 2 — genisletilmis detektor, tum katalog', ''];
const summary = { scanned: 0, storiesWithHits: 0, storiesFixed: 0, newSentences: 0, fixed: 0, flagged: [], errors: [] };
const regen = [];

for (const id of argIds) {
  summary.scanned++;
  let st; try { st = JSON.parse(readFileSync(S(id), 'utf8')); } catch { continue; }
  const items = [], refs = [];
  for (const [lvl, L] of Object.entries(st.levels)) {
    const flat = L.paragraphs.flatMap((p) => p.sentences);
    flat.forEach((sent, i) => { if (d2c2(sent.text) > 0) { items.push({ i: items.length, prev: flat[i - 1]?.text || '', target: sent.text, next: flat[i + 1]?.text || '' }); refs.push({ lvl, obj: sent }); } });
  }
  if (!items.length) continue;
  summary.storiesWithHits++; summary.newSentences += items.length;
  let fixes;
  try {
    const prompt = `${INSTR}\n\nReturn STRICT JSON only, OBJECT: {"fixes":[{"i":<n>,"fixed":"<sentence>"}]}. Items:\n${JSON.stringify(items)}`;
    fixes = parseJsonResponse(await callGemini(prompt, { json: true })).fixes;
    if (!Array.isArray(fixes)) throw new Error('non-array');
  } catch (e) { summary.errors.push(`${id}:${(e.message || '').slice(0, 30)}`); continue; }
  const byI = new Map(fixes.map((f) => [f.i, f.fixed]));
  const diffs = [], touched = new Set();
  for (let k = 0; k < items.length; k++) {
    const fixed = byI.get(k), orig = items[k].target;
    if (fixed == null || fixed === orig || !minimalEdit(orig, fixed)) continue;
    if (d2c2(fixed) >= d2c2(orig)) continue;
    refs[k].obj.text = fixed; diffs.push([refs[k].lvl, orig, fixed]); touched.add(refs[k].lvl);
  }
  if (diffs.length) {
    writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
    summary.storiesFixed++; summary.fixed += diffs.length;
    log.push(`## ${id} — ${diffs.length}/${items.length} cumle`);
    for (const [l, o, n] of diffs) log.push(`- [${l}]\n  - ~~${o}~~\n  - ✅ ${n}`);
    let resid = 0; for (const L of Object.values(st.levels)) for (const p of L.paragraphs) for (const se of p.sentences) resid += d2c2(se.text);
    log.push(`  → kalan D2r2: ${resid}${resid ? ' ⚠️' : ' ✅'}`); if (resid) summary.flagged.push(`${id}(${resid})`);
    for (const l of touched) regen.push(`${id}\t${l}\tD2r2`);
    log.push('');
  }
  process.stderr.write(`.${id.slice(-3)}`);
}
appendFileSync(path.join(ROOT, 'pipeline', 'fix-d2-round2-log.md'), log.join('\n') + '\n');
if (regen.length) appendFileSync(path.join(ROOT, 'pipeline', 'audio-regen-queue.md'), '\n# D2-round2\n' + regen.join('\n') + '\n');
writeFileSync(path.join(ROOT, 'pipeline', '.fix-d2r2.json'), JSON.stringify(summary, null, 2));
console.log(`\nD2r2: tarandi ${summary.scanned} | hit'li ${summary.storiesWithHits} | duzeltilen hikaye ${summary.storiesFixed} | cumle ${summary.fixed} | flagged ${summary.flagged.length} | err ${summary.errors.length}`);
