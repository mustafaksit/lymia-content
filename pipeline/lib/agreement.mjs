/**
 * Ozne-yuklem uyum denetimi (v2, IS 1 grammar gate).
 *
 * Neden var: LLM ile sadelestirilen A1/A2 metinlerinde 3. tekil -s ve "be"
 * uyumu sistematik kayiyordu ("Emily write", "She feel", "map show",
 * "a old", "are child", "many thing"). Bu modul YUKSEK HASSASIYETLI
 * (dusuk yanlis-pozitif) kaliplari yakalar; amaci gate olmak, tam duzeltici
 * degil. Tam duzeltme Gemini re-pass ile (seviye-tensine duyarli).
 *
 * Severity: audit'te normalde uyari, --strict'te hata (yeni uretim gecemez).
 * Yanlis-pozitiften kacinmak icin isim-ozne + ciplak fiil gibi belirsiz
 * kaliplar DISARIDA birakildi; onlari Gemini re-pass ele alir.
 */

// 3. tekil oznenin ardindan ciplak (uyumsuz) gelen yaygin fiiller.
// -s / gecmis olsaydi eslesmezdi; bu liste present-tense uyum hatasina odakli.
const BARE_VERBS =
  '(say|go|see|make|take|have|want|need|like|feel|live|work|look|walk|talk|find|tell|ask|' +
  'help|keep|hold|turn|call|run|come|give|know|think|become|leave|meet|write|read|play|' +
  'show|sell|buy|move|open|close|grow|stay|reach|lead|point|carry|follow|build|sit|stand|' +
  'eat|drink|sleep|speak|send|bring|wear|learn|teach|plan|hope|wish|visit|enter|climb)';

// Sesli sesle baslayan, "an" gerektiren yaygin kelimeler (yuksek hassasiyet).
const VOWEL_WORDS =
  '(old|area|idea|other|hour|apple|open|empty|early|extra|orange|egg|umbrella|elephant|' +
  'island|answer|object|event|end|arm|eye|action|error|effort|ocean)';

// "are"/"many" ile tekil gelen sayilabilir isimler.
const SINGULAR_NOUNS =
  '(child|man|woman|boy|girl|student|friend|kid|person|thing|shop|piece|word|book|day|' +
  'fruit|star|year|place|room|door|map|key|note|city|island|gift|garden)';

const RULES = [
  { re: new RegExp(`\\b(He|She|It)\\s+${BARE_VERBS}\\b`, 'g'), label: '3.tekil ozne + ciplak fiil' },
  { re: new RegExp(`\\b(is|was)\\s+${BARE_VERBS}\\b`, 'g'), label: 'yardimci + ciplak fiil' },
  { re: /\ba\s+(?=[aeiou])/gi, cond: (m, text, idx) => new RegExp(`^a\\s+${VOWEL_WORDS}\\b`, 'i').test(text.slice(idx)), label: 'a + sesli (an olmali)' },
  { re: new RegExp(`\\bare\\s+${SINGULAR_NOUNS}\\b`, 'gi'), label: 'are + tekil isim' },
  { re: new RegExp(`\\bmany\\s+${SINGULAR_NOUNS}\\b(?!s)`, 'gi'), label: 'many + tekil isim' },
  { re: /\b(\w+)\s+be\s+(clear|calm|far|near|ready|happy|sad|big|small|old|new|full|empty|good|bad)\b/g, label: '"be" ciplak (is/was olmali)' },
];

/** Metindeki uyum hatalarini dondurur: [{label, match}]. */
export function agreementIssues(text) {
  const hits = [];
  for (const rule of RULES) {
    if (rule.cond) {
      // "a + sesli" ozel: curated kelime listesiyle dogrula (yanlis-pozitif dusuk)
      const m = new RegExp(`\\ba\\s+${VOWEL_WORDS}\\b`, 'gi');
      let x;
      while ((x = m.exec(text)) !== null) hits.push({ label: rule.label, match: x[0] });
      continue;
    }
    let x;
    while ((x = rule.re.exec(text)) !== null) hits.push({ label: rule.label, match: x[0] });
  }
  return hits;
}

/** Bir seviyenin tum cumlelerindeki uyum hatasi sayisi. */
export function levelAgreementCount(levelData) {
  let n = 0;
  for (const p of levelData.paragraphs ?? []) {
    for (const s of p.sentences ?? []) n += agreementIssues(s.text).length;
  }
  return n;
}
