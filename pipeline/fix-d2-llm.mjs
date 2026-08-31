#!/usr/bin/env node
/* D2 LLM re-pass: yalniz isaretli cumleleri, baglamla, minimal-uyum duzeltmesi.
 * Hikaye basina TEK cagri (batch). Drift-guard + d2count guard + gate. Ses ayri.
 * Log: fix-d2-log.md ; kuyruk: audio-regen-queue.md ; ozet: .fix-d2-llm.json */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.mjs';
import { agreementIssues } from './lib/agreement.mjs';
loadEnv();
const { callGemini, parseJsonResponse } = await import('./lib/gemini.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (id) => path.join(ROOT, 'content', 'stories', `${id}.json`);
const D2_IDS = 'st-0008,st-0024,st-0033,st-0047,st-0088,st-0097,st-0102,st-0104,st-0106,st-0109,st-0113,st-0115,st-0117,st-0119,st-0120,st-0121,st-0122,st-0123,st-0124,st-0125,st-0126,st-0130,st-0131,st-0132,st-0134,st-0135,st-0136,st-0137,st-0144,st-0145,st-0148,st-0149,st-0150,st-0152,st-0155,st-0156,st-0161,st-0164,st-0165,st-0168,st-0169,st-0170,st-0173,st-0176,st-0177,st-0180,st-0186,st-0188,st-0190,st-0193,st-0197,st-0199,st-0205,st-0209,st-0212,st-0217,st-0222,st-0227,st-0233,st-0235,st-0238,st-0240,st-0241,st-0242,st-0243,st-0244,st-0251,st-0253,st-0256,st-0257,st-0260,st-0262,st-0263,st-0266,st-0268,st-0269,st-0272'.split(',');

// ---- d2 detektor (fix-d2.mjs ile ayni) ----
const BARE = 'say|go|see|make|take|have|want|need|like|feel|live|work|look|walk|talk|find|tell|ask|help|keep|hold|turn|call|run|come|give|know|think|become|leave|meet|write|read|play|show|sell|buy|move|open|close|grow|stay|reach|lead|point|carry|follow|build|sit|stand|eat|drink|sleep|speak|send|wear|learn|teach|plan|hope|wish|visit|enter|climb|use|pull|push|jump|decide|own|love|watch';
const RE_REL = new RegExp(`\\b(who|that|which)\\s+(${BARE})\\b`, 'gi');
const RE_INDEF = new RegExp(`\\b(everyone|everybody|someone|somebody|nobody|nothing|something|no one)\\s+(${BARE})\\b`, 'gi');
const PLURAL_ANTE = new Set('people,they,we,friends,children,men,women,others,ones,kids,students,those,two,three,four,five,many,some,both,villagers,animals,birds,boys,girls,parents,things,words,books,stories,covers,days'.split(','));
const BE_ALLOW = new Set(('to,not,will,would,wo,ll,d,can,could,shall,should,may,might,must,let,help,helps,helped,make,makes,made,see,sees,saw,hear,hears,heard,watch,watches,and,or,be,been,being,cannot,cant,dont,doesnt,didnt,never,always,also,still,rather,only,just,simply,really,truly,soon,then,now,once,again,all,ever,otherwise,somehow,certainly,surely,probably,perhaps,maybe,finally,suddenly,quickly').split(','));
function bareBe(text){let n=0;const t=text.split(/\s+/);for(let i=1;i<t.length;i++){if(t[i].replace(/[^a-z]/gi,'').toLowerCase()!=='be')continue;const p=t[i-1].replace(/[^a-z']/gi,'').toLowerCase(),p2=(t[i-2]||'').replace(/[^a-z']/gi,'').toLowerCase();if(!p||BE_ALLOW.has(p)||BE_ALLOW.has(p2))continue;n++;}return n;}
function d2count(text){let n=0;for(const h of agreementIssues(text))if(/tekil|be/.test(h.label))n++;let m;RE_REL.lastIndex=0;while((m=RE_REL.exec(text))){const b=text.slice(0,m.index).trim().split(/\s+/).pop()||'';if(!PLURAL_ANTE.has(b.replace(/[^a-z]/gi,'').toLowerCase()))n++;}RE_INDEF.lastIndex=0;while((m=RE_INDEF.exec(text)))n++;n+=bareBe(text);return n;}

// drift-guard: minimal edit mi?
const toks = (s) => new Set((s.toLowerCase().match(/[a-z']+/g) || []));
function minimalEdit(a, b) {
  if (!b || !b.trim()) return false;
  const la = a.length, lb = b.length;
  if (lb < la * 0.5 || lb > la * 2) return false;
  const A = toks(a), B = toks(b); let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const jacc = inter / (A.size + B.size - inter || 1);
  return jacc >= 0.5;
}

const INSTR = `Fix ONLY the verb agreement in the target sentence. Change bare 'be' to correct tense (is/are/was/were per context), add missing 3rd person -s. Do NOT change vocabulary, plot, or style. Do NOT add words. Watch: 'that' can be a conjunction (not relative), 'like' can be a preposition (not verb), check if the subject noun is plural before adding -s. Keep it a minimal edit.`;

const argIds = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : D2_IDS;
const logLines = [];
const summary = { stories: 0, sentences: 0, flagged: [], errors: [] };
const regen = [];

for (const id of argIds) {
  let st; try { st = JSON.parse(readFileSync(S(id), 'utf8')); } catch { summary.errors.push(id); continue; }
  // isaretli cumleleri topla
  const items = []; const refs = [];
  for (const [lvl, L] of Object.entries(st.levels)) {
    const flat = L.paragraphs.flatMap((p) => p.sentences);
    flat.forEach((sent, i) => {
      if (d2count(sent.text) > 0) {
        items.push({ i: items.length, prev: flat[i - 1]?.text || '', target: sent.text, next: flat[i + 1]?.text || '' });
        refs.push({ lvl, obj: sent });
      }
    });
  }
  if (!items.length) continue;

  let fixes;
  try {
    const prompt = `${INSTR}\n\nFor each item, return the corrected target sentence. Return STRICT JSON only, an OBJECT: {"fixes":[{"i":<number>,"fixed":"<sentence>"}]}. Items:\n${JSON.stringify(items)}`;
    const parsed = parseJsonResponse(await callGemini(prompt, { json: true }));
    fixes = parsed.fixes;
    if (!Array.isArray(fixes)) throw new Error('non-array');
  } catch (e) { summary.errors.push(`${id}:${(e.message || '').slice(0, 40)}`); logLines.push(`## ${id} — ⚠️ LLM hata: ${(e.message || '').slice(0, 60)}`); continue; }

  const byI = new Map(fixes.map((f) => [f.i, f.fixed]));
  const diffs = []; const touched = new Set();
  for (let k = 0; k < items.length; k++) {
    const fixed = byI.get(k); const orig = items[k].target;
    if (fixed == null || fixed === orig) continue;
    if (!minimalEdit(orig, fixed)) { logLines.push(`  [drift-atlandi] ${id}: "${orig}" -> "${fixed}"`); continue; }
    if (d2count(fixed) >= d2count(orig)) continue; // guard: hata dusmuyorsa atla
    refs[k].obj.text = fixed; diffs.push([refs[k].lvl, orig, fixed]); touched.add(refs[k].lvl);
  }
  if (diffs.length) {
    writeFileSync(S(id), JSON.stringify(st, null, 2) + '\n');
    summary.stories++; summary.sentences += diffs.length;
    logLines.push(`## ${id} — ${diffs.length} cumle`);
    for (const [l, o, n] of diffs) logLines.push(`- [${l}]\n  - ~~${o}~~\n  - ✅ ${n}`);
    let resid = 0; for (const L of Object.values(st.levels)) for (const p of L.paragraphs) for (const se of p.sentences) resid += d2count(se.text);
    logLines.push(`  → kalan D2: ${resid}${resid ? ' ⚠️ ISARETLENDI' : ' ✅'}`);
    if (resid) summary.flagged.push(`${id}(${resid})`);
    for (const l of touched) regen.push(`${id}\t${l}\tD2-llm`);
    logLines.push('');
  }
  process.stderr.write(`.${id.slice(-3)}`);
}

appendFileSync(path.join(ROOT, 'pipeline', 'fix-d2-log.md'), '\n\n---\n# D2 LLM RE-PASS (Asama 3)\n\n' + logLines.join('\n') + '\n');
if (regen.length) appendFileSync(path.join(ROOT, 'pipeline', 'audio-regen-queue.md'), '\n# D2-llm\n' + regen.join('\n') + '\n');
writeFileSync(path.join(ROOT, 'pipeline', '.fix-d2-llm.json'), JSON.stringify(summary, null, 2));
console.log(`\nD2 LLM bitti: ${summary.stories} hikaye, ${summary.sentences} cumle. flagged: ${summary.flagged.length}, errors: ${summary.errors.length}`);
