#!/usr/bin/env node
/**
 * Dilbilgisi DUZELTME — KURAL TABANLI (LLM YOK, kotasiz, aninda).
 *
 * Ucretsiz LLM saglayicilari yuk altinda guvenilmez oldugu icin ozne-yuklem
 * uyum hatalarini deterministik duzeltir. Tense seviyeden bilinir:
 *   A1/A2/B1 -> present (3. tekil -s), B2/C1 -> past (gecmis form).
 * SADECE yuksek-guven kaliplar; belirsizler DOKUNULMAZ. Her cumlede uyum
 * dusmezse degisiklik uygulanmaz (guard). Ses AYRI yenilenir.
 * Kullanim: node pipeline/fix-grammar-rules.mjs [--dry] [--ids a,b]
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { STORIES_DIR, REPO_ROOT } from './lib/env.mjs';
import { agreementIssues } from './lib/agreement.mjs';

const LOG = path.join(REPO_ROOT, '.grammar-fixes.log');
const PRESENT = new Set(['A1', 'A2', 'B1']);

const NAMES = new Set(['Emily','Emma','Anna','Lila','Leo','Mia','Max','Jack','Sam','Maya','Ben','Tom','Tix','Lily','Ann','Nina','Kai','Zoe','Ben','Lucy','Sara','Sarah','Tom','Jack','Ella','Nora','Ravi','Omar','Mei','Lena']);
const VOWEL = new Set(['old','area','idea','hour','apple','open','empty','early','extra','orange','egg','umbrella','elephant','island','answer','object','event','end','arm','eye','action','error','effort','ocean']);

// present 3. tekil
const PRES3 = { have: 'has', do: 'does', go: 'goes', be: 'is', say: 'says' };
function to3sg(v) {
  if (PRES3[v]) return PRES3[v];
  if (/(ss|sh|ch|x|z|o)$/.test(v)) return v + 'es';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
  return v + 's';
}
// past
const PAST = { go:'went', have:'had', do:'did', say:'said', make:'made', take:'took', see:'saw', come:'came', get:'got', know:'knew', think:'thought', find:'found', give:'gave', feel:'felt', keep:'kept', leave:'left', meet:'met', run:'ran', sit:'sat', stand:'stood', hear:'heard', hold:'held', bring:'brought', build:'built', buy:'bought', catch:'caught', tell:'told', read:'read', put:'put', let:'let', cut:'cut', sell:'sold', show:'showed', grow:'grew', speak:'spoke', send:'sent', win:'won', wear:'wore', write:'wrote', eat:'ate', drink:'drank', sleep:'slept', teach:'taught', lead:'led', reach:'reached', help:'helped', walk:'walked', talk:'talked', look:'looked', want:'wanted', need:'needed', like:'liked', live:'lived', work:'worked', play:'played', open:'opened', close:'closed', move:'moved', stay:'stayed', point:'pointed', carry:'carried', follow:'followed', plan:'planned', hope:'hoped', wish:'wished', visit:'visited', climb:'climbed', ask:'asked', call:'called', turn:'turned', use:'used', pull:'pulled', push:'pushed', jump:'jumped', decide:'decided' };
function toPast(v) {
  if (PAST[v]) return PAST[v];
  if (/e$/.test(v)) return v + 'd';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
  return v + 'ed';
}
function pluralize(n) {
  const irr = { child:'children', man:'men', woman:'women', person:'people', foot:'feet', tooth:'teeth', mouse:'mice' };
  if (irr[n]) return irr[n];
  if (/(ss|sh|ch|x|z|o)$/.test(n)) return n + 'es';
  if (/[^aeiou]y$/.test(n)) return n.slice(0, -1) + 'ies';
  return n + 's';
}

const BAREV = 'say|go|see|make|take|have|want|need|like|feel|live|work|look|walk|talk|find|tell|ask|help|keep|hold|turn|call|run|come|give|know|think|become|leave|meet|write|read|play|show|sell|buy|move|open|close|grow|stay|reach|lead|point|carry|follow|build|sit|stand|eat|drink|sleep|speak|send|wear|learn|teach|plan|hope|wish|visit|enter|climb|use|pull|push|jump|decide|do|be';

/** Bir cumleyi seviyenin tensine gore duzeltir (minimal). */
function fixSentence(text, present) {
  let s = text;
  // a/an other -> another (an other DEGIL)
  s = s.replace(/\ban? other\b/g, 'another');
  // a + sesli -> an
  s = s.replace(new RegExp(`\\ba (?=(?:${[...VOWEL].join('|')})\\b)`, 'g'), 'an ');
  // are + tekil -> cogul
  s = s.replace(/\bare (child|man|woman|boy|girl|student|friend|kid|person)\b/gi, (m, n) => 'are ' + pluralize(n.toLowerCase()));
  // many + tekil -> cogul
  s = s.replace(/\bmany (child|man|woman|thing|shop|piece|word|book|day|fruit|star|year|place|room|door|map|key|note|city|island|gift|garden|person|shelf|leaf)\b(?!\s+\w+s\b)/gi, (m, n) => 'many ' + pluralize(n.toLowerCase()));
  // ozne (He/She/It/Isim) + ciplak fiil
  const subj = `(He|She|It|${[...NAMES].join('|')})`;
  s = s.replace(new RegExp(`\\b${subj} (${BAREV})\\b`, 'g'), (m, sub, v) =>
    `${sub} ${present ? to3sg(v) : toPast(v)}`);
  // "<tekil ozne> be <sifat>" -> is/was
  s = s.replace(new RegExp(`\\b${subj} be\\b`, 'g'), (m, sub) => `${sub} ${present ? 'is' : 'was'}`);
  s = s.replace(/\b(sky|map|door|air|path|room|house|water|light|city|island|book|key|garden|boat|river|wall|shop|market|night|day|sun|moon|star|wind|sea|weather|forest|hill|road|voice|sound|face|hand|eye) be\b/gi, (m, n) => `${n} ${present ? 'is' : 'was'}`);
  return s;
}

function run() {
  const dry = process.argv.includes('--dry');
  const idsArg = process.argv.indexOf('--ids');
  const ids = idsArg >= 0 ? process.argv[idsArg + 1].split(',') : null;
  let files = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.json')).sort();
  if (ids) files = files.filter((f) => ids.includes(f.replace('.json', '')));

  let storiesFixed = 0;
  const touchedLevels = [];
  for (const f of files) {
    const p = path.join(STORIES_DIR, f);
    const story = JSON.parse(readFileSync(p, 'utf8'));
    let changed = false;
    const diffs = [];
    for (const [lvl, L] of Object.entries(story.levels)) {
      const present = PRESENT.has(lvl);
      let lvlCh = 0;
      for (const para of L.paragraphs) {
        for (const sent of para.sentences) {
          const before = agreementIssues(sent.text).length;
          if (before === 0) continue;
          const cand = fixSentence(sent.text, present);
          if (cand === sent.text) continue;
          const after = agreementIssues(cand).length;
          if (after < before) { // guard: sadece dusuruyorsa uygula
            diffs.push([lvl, sent.text, cand]);
            sent.text = cand; lvlCh++; changed = true;
          }
        }
      }
      if (lvlCh > 0) touchedLevels.push(`${story.id}:${lvl}`);
    }
    if (changed) {
      storiesFixed++;
      if (!dry) writeFileSync(p, JSON.stringify(story, null, 2) + '\n');
      appendFileSync(LOG, `\n## ${story.id}\n` + diffs.map(([l, o, n]) => `[${l}] - ${o}\n[${l}] + ${n}`).join('\n') + '\n');
    }
  }
  console.log(`${dry ? '[DRY] ' : ''}${storiesFixed} hikaye duzeltildi.`);
  console.log(`Sesi yenilenecek seviyeler (${touchedLevels.length}): ${touchedLevels.join(' ')}`);
}
run();
