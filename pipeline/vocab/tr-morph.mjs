/**
 * Kural tabanlı Türkçe çekim (LLM YOK). Girdi: gloss_tr (sözlük hali), pos,
 * Penn tag, ve spaCy bağlamı { dep, aux[] }. Çıktı: cümledeki çekime uygun Türkçe.
 *
 * Türkçe çekim yüksek düzenli (ünlü uyumu + ekler) olduğundan bu iş deterministik
 * yapılır; ücretsiz LLM'ler bunu güvenilir üretemiyordu (pilotta %4). Düzensiz
 * durumlar için genişletilebilir istisna sözlüğü (EXCEPTIONS) kullanılır.
 */

const BACK = new Set(['a', 'ı', 'o', 'u']);
const FRONT = new Set(['e', 'i', 'ö', 'ü']);
const VOWELS = new Set([...BACK, ...FRONT]);
const HARD = new Set(['ç', 'f', 'h', 'k', 'p', 's', 'ş', 't']); // sert ünsüzler
const SOFTEN = { t: 'd', k: 'ğ', ç: 'c', p: 'b' };
// Ünsüz yumuşaması istisnaları: bu köklerde/desende yumuşama OLUR (git->gid).
// Çoğu tek heceli kök (yap, at, bak) yumuşamaz; yalnız aşağıdakiler yumuşar.
const SOFTEN_ROOTS = new Set(['git', 'et', 'tat', 'güt', 'güç']);

const lastVowel = (w) => {
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.has(w[i])) return w[i];
  return null;
};
/** a/e iki yönlü uyum. */
const twoWay = (w) => (BACK.has(lastVowel(w)) ? 'a' : 'e');
/** ı/i/u/ü dört yönlü uyum. */
function fourWay(w) {
  const v = lastVowel(w);
  if (v === 'a' || v === 'ı') return 'ı';
  if (v === 'e' || v === 'i') return 'i';
  if (v === 'o' || v === 'u') return 'u';
  if (v === 'ö' || v === 'ü') return 'ü';
  return 'i';
}
const endsVowel = (w) => VOWELS.has(w[w.length - 1]);

function shouldSoften(root) {
  if (SOFTEN_ROOTS.has(root)) return true;
  if (root.length > 3 && root.endsWith('et')) return true; // seyret, kaybet, hisset...
  return false;
}
/** Ünlüyle başlayan ek öncesi kök sonu yumuşaması (t->d, k->ğ, ç->c, p->b). */
function soften(root) {
  const last = root[root.length - 1];
  if (SOFTEN[last] && shouldSoften(root)) return root.slice(0, -1) + SOFTEN[last];
  return root;
}

/** Mastar ekini (-mak/-mek) atarak fiil kökü. */
function verbRoot(word) {
  if (word.endsWith('mak')) return word.slice(0, -3);
  if (word.endsWith('mek')) return word.slice(0, -3);
  return word;
}
const isInfinitive = (w) => /m[ae]k$/.test(w);

// ---- ek üreticiler (fiil kökü girer) ----
function pastTense(root) {
  const d = HARD.has(root[root.length - 1]) ? 't' : 'd';
  return root + d + fourWay(root); // sar+d+ı, koş+t+u, git+t+i
}
function continuous(root) {
  if (endsVowel(root)) {
    // Son ünlü düşer; tampon ünlü DÜŞÜŞTEN SONRAKİ köke göre uyumlanır
    // (söyle->söyl->söylüyor; ara->ar->arıyor; oku->ok->okuyor).
    const stem = root.slice(0, -1);
    return stem + fourWay(stem) + 'yor';
  }
  return soften(root) + fourWay(root) + 'yor'; // git->gid+i+yor, sar->sar+ı+yor
}
function perfect(root) {
  return root + 'm' + fourWay(root) + 'ş'; // sar->sarmış (aktif, have)
}
function passivePerfect(root) {
  const last = root[root.length - 1];
  let passive;
  if (VOWELS.has(last)) passive = root + 'n';                 // oku->okun
  else if (last === 'l') passive = soften(root) + fourWay(root) + 'n'; // al->alın
  else passive = soften(root) + fourWay(root) + 'l';          // sar->sarıl, et->edil
  return passive + 'm' + fourWay(passive) + 'ş';
}
function participle(root) {
  // sıfat-fiil -an/-en (amod/acl)
  const suf = twoWay(root) === 'a' ? 'an' : 'en';
  if (endsVowel(root)) return root + 'y' + suf; // otla->otlayan
  return soften(root) + suf;                    // sar->saran, git->giden
}
function converb(root) {
  // ulaç -arak/-erek (advcl)
  const suf = twoWay(root) === 'a' ? 'arak' : 'erek';
  if (endsVowel(root)) return root + 'y' + suf; // oku->okuyarak
  return soften(root) + suf;
}

/** Çok sözcüklü gloss'ta yalnız SON sözcük (asıl fiil) çekilir. */
function applyToLastVerb(gloss, fn) {
  const parts = gloss.split(' ');
  const last = parts[parts.length - 1];
  if (!isInfinitive(last)) return gloss; // düzgün mastar değil -> çekilemez
  parts[parts.length - 1] = fn(verbRoot(last));
  return parts.join(' ');
}
function pluralize(gloss) {
  const parts = gloss.split(' ');
  const w = parts[parts.length - 1];
  parts[parts.length - 1] = w + (twoWay(w) === 'a' ? 'lar' : 'ler');
  return parts.join(' ');
}

/** Düzensiz/özel durumlar: gloss(son sözcük) -> { tag/mod: form }. Genişletilebilir. */
export const EXCEPTIONS = {};

/**
 * Ana çekim. ctx = { dep, aux }. Bilinmeyen/taban tag'lerde gloss aynen döner.
 */
export function inflect(gloss, pos, tag, ctx = {}) {
  const g = (gloss || '').trim();
  if (!g) return g;
  const { dep = '', aux = [] } = ctx;

  const parts = g.split(' ');
  const lastWord = parts[parts.length - 1];
  const exc = EXCEPTIONS[lastWord];

  switch (tag) {
    case 'NNS':
    case 'NNPS':
      return exc?.NNS ?? pluralize(g);
    case 'JJR':
    case 'RBR':
      return /^daha /i.test(g) ? g : `daha ${g}`; // gloss zaten karşılaştırmalıysa çift önek yok
    case 'JJS':
    case 'RBS':
      return /^en /i.test(g) ? g : `en ${g}`;
    case 'VBD':
      return exc?.VBD ?? applyToLastVerb(g, pastTense);
    case 'VBN':
      return aux.includes('have')
        ? (exc?.VBN_active ?? applyToLastVerb(g, perfect))
        : (exc?.VBN_passive ?? applyToLastVerb(g, passivePerfect));
    case 'VBG': {
      if (aux.includes('be')) return exc?.VBG_cont ?? applyToLastVerb(g, continuous);
      if (dep === 'amod' || dep === 'acl' || dep === 'acl:relcl') return exc?.VBG_amod ?? applyToLastVerb(g, participle);
      if (dep === 'advcl') return exc?.VBG_advcl ?? applyToLastVerb(g, converb);
      return exc?.VBG_cont ?? applyToLastVerb(g, continuous);
    }
    case 'VBZ':
    case 'VBP':
      return exc?.VBZ ?? applyToLastVerb(g, continuous);
    default:
      return g; // RB, JJ, NN, VB ve diğerleri: sözlük hali
  }
}
