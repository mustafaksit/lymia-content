/**
 * tr-morph birim testleri. Çalıştır: node pipeline/vocab/tr-morph.test.mjs
 * (harici bağımlılık yok; başarısız vaka sayısıyla exit kodu döner.)
 */
import { inflect } from './tr-morph.mjs';

const cases = [
  // --- NNS çoğul (ünlü uyumu) ---
  ['NNS', 'kitap', {}, 'kitaplar'],
  ['NNS', 'ev', {}, 'evler'],
  ['NNS', 'köşe', {}, 'köşeler'],
  ['NNS', 'sonuç', {}, 'sonuçlar'],
  ['NNS', 'göz', {}, 'gözler'],
  ['NNS', 'koyun', {}, 'koyunlar'],
  ['NNS', 'çocuk', {}, 'çocuklar'],
  ['NNS', 'gün', {}, 'günler'],
  ['NNS', 'köpek', {}, 'köpekler'],
  ['NNS', 'yalan söyleyen', {}, 'yalan söyleyenler'], // çok sözcük: son sözcük
  // --- JJR / JJS ---
  ['JJR', 'büyük', {}, 'daha büyük'],
  ['JJS', 'büyük', {}, 'en büyük'],
  ['RBR', 'hızlı', {}, 'daha hızlı'],
  ['RBS', 'hızlı', {}, 'en hızlı'],
  // --- VBD geçmiş (dörtlü uyum + sert ünsüz) ---
  ['VBD', 'sarmak', {}, 'sardı'],
  ['VBD', 'koşmak', {}, 'koştu'], // ş sert -> tu
  ['VBD', 'bakmak', {}, 'baktı'], // k sert -> tı
  ['VBD', 'gelmek', {}, 'geldi'],
  ['VBD', 'okumak', {}, 'okudu'],
  ['VBD', 'aramak', {}, 'aradı'],
  ['VBD', 'gitmek', {}, 'gitti'], // t sert -> tt
  ['VBD', 'görmek', {}, 'gördü'],
  ['VBD', 'yazmak', {}, 'yazdı'],
  ['VBD', 'ikna etmek', {}, 'ikna etti'], // çok sözcük
  ['VBD', 'gülmek', {}, 'güldü'],
  // --- VBN aktif (have) vs edilgen ---
  ['VBN', 'sarmak', { aux: ['have'] }, 'sarmış'],
  ['VBN', 'yazmak', { aux: ['have'] }, 'yazmış'],
  ['VBN', 'sarmak', { aux: ['be'] }, 'sarılmış'], // edilgen ünsüz
  ['VBN', 'yazmak', { aux: [] }, 'yazılmış'],      // aux yok -> edilgen
  ['VBN', 'okumak', { aux: [] }, 'okunmuş'],       // ünlü kök -> +n
  ['VBN', 'almak', { aux: [] }, 'alınmış'],        // l kök -> +ın
  ['VBN', 'bölmek', { aux: ['be'] }, 'bölünmüş'],
  // --- VBG sürerlik (be) / sıfat-fiil (amod) / ulaç (advcl) ---
  ['VBG', 'sarmak', { aux: ['be'] }, 'sarıyor'],
  ['VBG', 'aramak', { aux: ['be'] }, 'arıyor'],   // ünlü düşer
  ['VBG', 'okumak', { aux: ['be'] }, 'okuyor'],   // ünlü düşer
  ['VBG', 'gitmek', { aux: ['be'] }, 'gidiyor'],  // yumuşama t->d
  ['VBG', 'yürümek', { aux: ['be'] }, 'yürüyor'],
  ['VBG', 'otlamak', { dep: 'amod' }, 'otlayan'], // sıfat-fiil, tampon y
  ['VBG', 'sarmak', { dep: 'amod' }, 'saran'],
  ['VBG', 'gitmek', { dep: 'amod' }, 'giden'],
  ['VBG', 'sarmak', { dep: 'advcl' }, 'sararak'], // ulaç
  ['VBG', 'okumak', { dep: 'advcl' }, 'okuyarak'],
  ['VBG', 'koşmak', {}, 'koşuyor'], // aux/dep yok -> varsayılan sürerlik
  // --- VBZ / VBP ---
  ['VBZ', 'sarmak', {}, 'sarıyor'],
  ['VBP', 'gelmek', {}, 'geliyor'],
  ['VBZ', 'söylemek', {}, 'söylüyor'],
  ['JJR', 'daha iyi', {}, 'daha iyi'],
  ['JJS', 'en iyi', {}, 'en iyi'],
  ['VBG', 'söylemek', {aux:['be']}, 'söylüyor'],
  // --- taban tag: gloss aynen ---
  ['VB', 'sarmak', {}, 'sarmak'],
  ['NN', 'kitap', {}, 'kitap'],
  ['JJ', 'büyük', {}, 'büyük'],
  ['RB', 'hızlı', {}, 'hızlı'],
];

let fail = 0;
for (const [tag, gloss, ctx, expected] of cases) {
  const got = inflect(gloss, 'X', tag, ctx);
  const ok = got === expected;
  if (!ok) { fail++; console.log(`✗ ${tag} "${gloss}" ${JSON.stringify(ctx)} -> "${got}" (beklenen "${expected}")`); }
}
console.log(`\n${cases.length - fail}/${cases.length} test geçti.`);
process.exit(fail ? 1 : 0);
