/**
 * Baslik tekrar denetimi (v2 IS 1b).
 *
 * Neden var: yayindaki katalogda 5 kumede BIREBIR AYNI baslik cikti
 * (The Hidden Mountain Map x3, The Library Note x3, ...). Bu modul yeni
 * uretilen bir basligin katalogdaki mevcut basliklarla anahtar kelime kumesi
 * cakismasini olcer; uretim/denetim asamasinda tekrari daha dogmadan yakalar.
 *
 * Esik:
 *   - exact (buyuk/kucuk harf duyarsiz)  -> her zaman COLLISION (hard-fail)
 *   - jaccard >= HARD (0.6)               -> her zaman COLLISION (hard-fail)
 *   - jaccard >= SOFT (0.5)               -> yakin (strict'te hard-fail, degilse uyari)
 * Jaccard, icerik anahtar kelimeleri (stopword ve <=2 harf haric) uzerinden.
 */

export const SOFT_THRESHOLD = 0.5;
export const HARD_THRESHOLD = 0.6;

const STOPWORDS = new Set(
  ('the a an of in on at to and or but for with from by is are was were be been ' +
    'there that this those these who what how his her its their my your our not no')
    .split(' '),
);

/** Basligin icerik anahtar kelimeleri (kucuk harf, stopword/kisa kelime disi). */
export function titleKeywords(title) {
  const words = (title || '').toLowerCase().match(/[a-z']+/g) || [];
  return new Set(words.filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

export function jaccard(aSet, bSet) {
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const w of aSet) if (bSet.has(w)) inter += 1;
  return inter / (aSet.size + bSet.size - inter);
}

/**
 * `title`, `others` ([{id, title}]) icinde bir cakisma yaratiyor mu.
 * Donen: en guclu cakismayi tanimlayan { level: 'exact'|'hard'|'soft', ... } veya null.
 * `selfId` verilirse kendini atlar.
 */
export function findTitleCollision(title, others, selfId = null) {
  const mine = titleKeywords(title);
  const norm = (title || '').trim().toLowerCase();
  let best = null;
  for (const o of others) {
    if (selfId != null && o.id === selfId) continue;
    if ((o.title || '').trim().toLowerCase() === norm) {
      return { level: 'exact', jaccard: 1, otherId: o.id, otherTitle: o.title, shared: [...mine] };
    }
    const j = jaccard(mine, titleKeywords(o.title));
    let level = null;
    if (j >= HARD_THRESHOLD) level = 'hard';
    else if (j >= SOFT_THRESHOLD) level = 'soft';
    if (level && (!best || j > best.jaccard)) {
      const shared = [...mine].filter((w) => titleKeywords(o.title).has(w));
      best = { level, jaccard: j, otherId: o.id, otherTitle: o.title, shared };
    }
  }
  return best;
}
