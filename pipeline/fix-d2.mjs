#!/usr/bin/env node
/* D2 duzeltme — KURAL TABANLI, guard'li. Kapsam:
 *  - <ozne> be  -> is/are/was/were  (sayi + cumle-tensine gore)
 *  - He/She/It/ozel-isim/belirsiz-zamir + ciplak fiil -> 3.tekil -s / gecmis
 *  - who/that/which + ciplak fiil   -> +s/gecmis (yalniz TEKIL oncul)
 * Guard: bir cumle ancak D2-hit sayisi DUSUYOR ve yeni agreement hatasi
 * dogmuyorsa degistirilir. Tense cumlenin kendi fiil sinyalinden. Ses AYRI.
 * Log: pipeline/fix-d2-log.md */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agreementIssues } from './lib/agreement.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);

const D2_IDS = ('st-0008,st-0024,st-0033,st-0047,st-0088,st-0097,st-0102,st-0104,st-0106,st-0109,st-0113,st-0115,st-0117,st-0119,st-0120,st-0121,st-0122,st-0123,st-0124,st-0125,st-0126,st-0130,st-0131,st-0132,st-0134,st-0135,st-0136,st-0137,st-0144,st-0145,st-0148,st-0149,st-0150,st-0152,st-0155,st-0156,st-0161,st-0164,st-0165,st-0168,st-0169,st-0170,st-0173,st-0176,st-0177,st-0180,st-0186,st-0188,st-0190,st-0193,st-0197,st-0199,st-0205,st-0209,st-0212,st-0217,st-0222,st-0227,st-0233,st-0235,st-0238,st-0240,st-0241,st-0242,st-0243,st-0244,st-0251,st-0253,st-0256,st-0257,st-0260,st-0262,st-0263,st-0266,st-0268,st-0269,st-0272').split(',');

// ---------- morfoloji ----------
const PRES3 = { have: 'has', do: 'does', go: 'goes', say: 'says', be: 'is' };
const to3sg = (v) => PRES3[v] || (/(ss|sh|ch|x|z|o)$/.test(v) ? v + 'es' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ies' : v + 's');
const PAST = { go:'went',have:'had',do:'did',say:'said',make:'made',take:'took',see:'saw',come:'came',get:'got',know:'knew',think:'thought',find:'found',give:'gave',feel:'felt',keep:'kept',leave:'left',meet:'met',run:'ran',sit:'sat',stand:'stood',hear:'heard',hold:'held',bring:'brought',build:'built',buy:'bought',catch:'caught',tell:'told',read:'read',put:'put',let:'let',cut:'cut',sell:'sold',show:'showed',grow:'grew',speak:'spoke',send:'sent',win:'won',wear:'wore',write:'wrote',eat:'ate',drink:'drank',sleep:'slept',teach:'taught',lead:'led',reach:'reached',help:'helped',walk:'walked',talk:'talked',look:'looked',want:'wanted',need:'needed',like:'liked',live:'lived',work:'worked',play:'played',open:'opened',close:'closed',move:'moved',stay:'stayed',point:'pointed',carry:'carried',follow:'followed',plan:'planned',hope:'hoped',wish:'wished',visit:'visited',climb:'climbed',ask:'asked',call:'called',turn:'turned',use:'used',pull:'pulled',push:'pushed',jump:'jumped',decide:'decided',own:'owned',love:'loved',watch:'watched',become:'became',enter:'entered',learn:'learned' };
const toPast = (v) => PAST[v] || (/e$/.test(v) ? v + 'd' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ied' : v + 'ed');

const BARE = 'say|go|see|make|take|have|want|need|like|feel|live|work|look|walk|talk|find|tell|ask|help|keep|hold|turn|call|run|come|give|know|think|become|leave|meet|write|read|play|show|sell|buy|move|open|close|grow|stay|reach|lead|point|carry|follow|build|sit|stand|eat|drink|sleep|speak|send|wear|learn|teach|plan|hope|wish|visit|enter|climb|use|pull|push|jump|decide|own|love|watch';
const PLURAL_ANTE = new Set('people,they,we,friends,children,men,women,others,ones,kids,students,those,two,three,four,five,many,some,both,villagers,animals,birds,boys,girls,parents'.split(','));
const SING_PRON = new Set('he,she,it,this,that,who,someone,somebody,everyone,everybody,nobody,anyone,anybody,nothing,something,one'.split(','));
const PLUR_PRON = new Set('they,we,you,these,those,people'.split(','));

// cumle tensi: past sinyali baskin mi?
const PAST_RE = /\b(was|were|had|did|would|could|went|said|made|took|saw|came|got|knew|thought|found|gave|felt|kept|left|met|ran|sat|stood|heard|held|brought|built|bought|caught|told|sold|grew|spoke|sent|won|wore|wrote|ate|drank|slept|taught|led|became|began|[a-z]+ed)\b/g;
const PRES_RE = /\b(is|are|am|does|has|have|says|goes|[a-z]+s)\b/g;
function isPast(text) {
  const p = (text.match(PAST_RE) || []).length;
  const q = (text.match(PRES_RE) || []).length;
  return p > 0 && p >= q;
}
// "be" oncesi ozne sayisi (plural mi?)
function subjPlural(prevWord) {
  const w = prevWord.replace(/[^a-z]/gi, '').toLowerCase();
  if (PLUR_PRON.has(w)) return true;
  if (SING_PRON.has(w)) return false;
  if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return true; // kaba cogul
  return false; // varsayilan tekil
}

// ---------- D2 hit sayaci (guard icin) ----------
const RE_REL = new RegExp(`\\b(who|that|which)\\s+(${BARE})\\b`, 'gi');
const RE_INDEF = new RegExp(`\\b(everyone|everybody|someone|somebody|nobody|nothing|something|no one)\\s+(${BARE})\\b`, 'gi');
const BE_ALLOW = new Set(('to,not,will,would,wo,ll,d,can,could,shall,should,may,might,must,let,help,helps,helped,make,makes,made,see,sees,saw,hear,hears,heard,watch,watches,and,or,be,been,being,cannot,cant,dont,doesnt,didnt,never,always,also,still,rather,only,just,simply,really,truly,soon,then,now,once,again,all,ever,otherwise,somehow,certainly,surely,probably,perhaps,maybe,finally,suddenly,quickly').split(','));
function bareBeList(text) {
  const out = []; const toks = text.split(/\s+/);
  for (let i = 1; i < toks.length; i++) {
    if (toks[i].replace(/[^a-z]/gi, '').toLowerCase() !== 'be') continue;
    const prev = toks[i - 1].replace(/[^a-z']/gi, '').toLowerCase();
    const prev2 = (toks[i - 2] || '').replace(/[^a-z']/gi, '').toLowerCase();
    if (!prev || BE_ALLOW.has(prev) || BE_ALLOW.has(prev2)) continue;
    out.push(i);
  }
  return out;
}
function d2count(text) {
  let n = 0;
  for (const h of agreementIssues(text)) if (/tekil|be/.test(h.label)) n++;
  let m; RE_REL.lastIndex = 0;
  while ((m = RE_REL.exec(text))) { const before = text.slice(0, m.index).trim().split(/\s+/).pop() || ''; if (!PLURAL_ANTE.has(before.replace(/[^a-z]/gi, '').toLowerCase())) n++; }
  RE_INDEF.lastIndex = 0; while ((m = RE_INDEF.exec(text))) n++;
  n += bareBeList(text).length;
  return n;
}

// ---------- duzeltme ----------
function fixSentence(text) {
  const past = isPast(text);
  let s = text;

  // 1) "<ozne> be" -> is/are/was/were  (token bazli, guard'la)
  {
    const toks = s.split(/(\s+)/); // bosluklari koru
    const words = []; const map = [];
    toks.forEach((t, i) => { if (!/^\s+$/.test(t)) { words.push(t); map.push(i); } });
    for (let wi = 1; wi < words.length; wi++) {
      if (words[wi].replace(/[^a-z]/gi, '').toLowerCase() !== 'be') continue;
      const prev = words[wi - 1].replace(/[^a-z']/gi, '').toLowerCase();
      const prev2 = (words[wi - 2] || '').replace(/[^a-z']/gi, '').toLowerCase();
      if (!prev || BE_ALLOW.has(prev) || BE_ALLOW.has(prev2)) continue;
      const plural = subjPlural(words[wi - 1]);
      const repl = past ? (plural ? 'were' : 'was') : (plural ? 'are' : 'is');
      words[wi] = words[wi].replace(/be/i, repl);
      toks[map[wi]] = words[wi];
    }
    s = toks.join('');
  }

  // 2) He/She/It + ciplak fiil
  s = s.replace(new RegExp(`\\b(He|She|It)\\s+(${BARE})\\b`, 'g'), (m, sub, v) => `${sub} ${past ? toPast(v) : to3sg(v)}`);
  // 3) belirsiz zamir + ciplak fiil
  s = s.replace(new RegExp(`\\b(Everyone|Everybody|Someone|Somebody|Nobody|No one|Nothing|Something|everyone|everybody|someone|somebody|nobody|nothing|something)\\s+(${BARE})\\b`, 'g'), (m, sub, v) => `${sub} ${past ? toPast(v) : to3sg(v)}`);
  // 4) who/that/which + ciplak fiil (yalniz tekil oncul)
  s = s.replace(new RegExp(`(\\S+)(\\s+)(who|that|which)\\s+(${BARE})\\b`, 'gi'), (m, ante, sp, rel, v) => {
    if (PLURAL_ANTE.has(ante.replace(/[^a-z]/gi, '').toLowerCase())) return m;
    return `${ante}${sp}${rel} ${past ? toPast(v) : to3sg(v)}`;
  });

  return s;
}

// ---------- calistir ----------
const log = ['# D2 Duzeltme Logu (kural-tabanli, guard\'li)', ''];
let fixedStories = 0, totalSent = 0, flagged = [];
for (const id of D2_IDS) {
  let st; try { st = JSON.parse(readFileSync(S(id), 'utf8')); } catch { log.push(`## ${id} — ⚠️ okunamadi`); continue; }
  const diffs = [];
  for (const [lvl, L] of Object.entries(st.levels)) {
    for (const p of L.paragraphs) for (const sent of p.sentences) {
      const before = d2count(sent.text);
      if (!before) continue;
      const beforeAgr = agreementIssues(sent.text).length;
      const cand = fixSentence(sent.text);
      if (cand === sent.text) continue;
      const after = d2count(cand), afterAgr = agreementIssues(cand).length;
      if (after < before && afterAgr <= beforeAgr) { // guard
        diffs.push([lvl, sent.text, cand, before, after]);
        sent.text = cand; totalSent++;
      }
    }
  }
  if (diffs.length) {
    fixedStories++;
    writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
    log.push(`## ${id} — ${diffs.length} cumle`);
    for (const [l, o, n, b, a] of diffs) log.push(`- [${l}] (D2 ${b}→${a})\n  - ~~${o}~~\n  - ✅ ${n}`);
    // gate: kalan D2 var mi?
    let resid = 0; for (const L of Object.values(st.levels)) for (const p of L.paragraphs) for (const se of p.sentences) resid += d2count(se.text);
    log.push(`  → kalan D2 (tum seviyeler): ${resid}${resid ? ' ⚠️ ISARETLENDI' : ' ✅'}`);
    if (resid) flagged.push(`${id}(${resid})`);
    log.push('');
  }
}
writeFileSync(path.join(ROOT, 'pipeline', 'fix-d2-log.md'), log.join('\n') + '\n');
console.log(`D2: ${fixedStories} hikaye, ${totalSent} cumle duzeltildi.`);
console.log(`Isaretlenen (kalan D2 hit) : ${flagged.length ? flagged.join(', ') : 'yok ✅'}`);
