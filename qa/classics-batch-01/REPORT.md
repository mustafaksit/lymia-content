# Klasik Hikayeler Serisi — Faz 1 Pilot (10 hikaye) — RAPOR

Tarih: 2026-10-29 · Branch: `content/classics-batch-01` (lymia-content) · Yayın YOK
(main'e merge yok, `contentVersion` 25'te kaldı, CDN purge yok).

Keşif ayrıntıları: [DISCOVERY.md](DISCOVERY.md) · Yazar brifi: [WRITER-BRIEF.md](WRITER-BRIEF.md)

## 0. Özet

- 10 hikaye × 5 seviye (A1–C1) yazıldı, `content/v2/stories/st-0273 … st-0282.json`;
  katalog girdileri `content/v2/index.json`'a eklendi (210 hikaye, contentVersion değişmedi).
- **Tüm otomatik kapılar 10/10 GEÇTİ** (şema, D1–D5 + audit --strict, LanguageTool,
  seviye profili, telif, tekrar). Log: `gates/<id>.json`, `gates/log.jsonl`, `gates/final-run.txt`.
- **Kör inceleme: 10/10 GEÇTİ.** Hiçbir hikaye ilk turda geçmedi; 6'sı 3. turda, 4'ü
  3. yeniden yazımdan sonraki doğrulama turunda geçti. Gerekçeler: `reviews/`.
- **Ses: 50/50 seviye** üretildi (edge-tts, mevcut pipeline), kelime-kelime hizalama temiz.
- **Uygulamada test edildi** (iOS 18.5, iPhone 16 Pro sim, dev build, yerel içerik sunucusu):
  10 hikayenin her birinde okuyucu açıldı, ses indirildi ve çaldı, karaoke vurgusu doğru.
  Quiz A1 ve C1'de çalıştı. Ekranlar: `screens/`.
- Kapaklar: 10 prompt hazır (`covers/prompts.json`); hash'li içe aktarma script'i hazır
  (`pipeline/import-covers-v2.mjs`). **Kalan tek manuel iş bu.**

## 1. Hikaye seçimi ve kaynaklar (`content/v2/sources.json`)

Aday listesinin 7'si, yedeklerin 5'i mevcut 200'le çakıştı (DISCOVERY §5). Karar
(Mustafa, 2026-10-29): karma set, Peter Pan çıkarıldı (1911 + UK GOSH istisnası),
yerine Kar Kraliçesi.

| id | Başlık | Kaynak eser | Yazar | İlk yayım | Bölüm |
|---|---|---|---|---|---|
| st-0273 | Pinocchio | Le avventure di Pinocchio | Carlo Collodi | 1883 | tam yay, yoğunlaştırılmış |
| st-0274 | Robin Hood and the Golden Arrow | The Merry Adventures of Robin Hood | Howard Pyle | 1883 | Nottingham okçuluk yarışması |
| st-0275 | Mowgli's Brothers | The Jungle Book | Rudyard Kipling | 1894 | "Mowgli's Brothers" |
| st-0276 | Gulliver in Lilliput | Gulliver's Travels, Part I | Jonathan Swift | 1726 | Lilliput |
| st-0277 | The Snow Queen | Sneedronningen | H. C. Andersen | 1844 | tam masal |
| st-0278 | Don Quixote and the Windmills | Don Quijote, Part I ch. 1–8 | Miguel de Cervantes | 1605 | yel değirmenleri |
| st-0279 | Robinson Crusoe | Robinson Crusoe | Daniel Defoe | 1719 | tam yay, yoğunlaştırılmış |
| st-0280 | The Little Mermaid | Den lille Havfrue | H. C. Andersen | 1837 | tam masal, orijinal son |
| st-0281 | The Pied Piper of Hamelin | The Pied Piper of Hamelin | Robert Browning | 1842 | tam şiir (+ Grimm 1816) |
| st-0282 | Rumpelstiltskin | KHM 55 (1812) | Grimm Kardeşler | 1812 | tam masal, 1812 sonu |

Orijinal sonlar korundu: Küçük Deniz Kızı köpüğe dönüşüp havanın kızlarından biri olur;
Fareli Köylü'de çocuklar dönmez, yalnız topal çocuk kalır; Rumpelstiltskin 1812 metnindeki
gibi öfkeyle kaçar. Çocuk dostu yumuşatmalar (hikaye bazında ayrıntı: yazar raporları
`reviews/` notlarında): Swift'in saray yangını yok; Deniz Kızı'nın dili kesilmez, cadı
"sesini alır"; Robinson'da Friday "efendi/köle" değil kurtarılan dost, "cannibal/savage"
kelimeleri yok; şiddet ima düzeyinde.

## 2. Seviye başına kelime sayısı ve yeniden yazım turları

Kelime: `[A-Za-z][A-Za-z']*` token (index.json `wordCount` ile 1-2 kelime fark edebilir).

| id | A1 | A2 | B1 | B2 | C1 | Kör inceleme turları | Yeniden yazım |
|---|---|---|---|---|---|---|---|
| st-0273 Pinocchio | 300 | 519 | 742 | 1142 | 1545 | r1 KALDI (B1) → r2 KALDI (C1) → **r3 GEÇTİ** | 2 |
| st-0274 Robin Hood | 312 | 517 | 769 | 985 | 1436 | r1 KALDI (5 seviye) → r2 KALDI (A2,B1) → **r3 GEÇTİ** | 2 |
| st-0275 Mowgli | 324 | 490 | 805 | 1141 | 1541 | r1 KALDI (A1) → r2 KALDI (B1,B2) → **r3 GEÇTİ** | 2 |
| st-0276 Gulliver | 325 | 515 | 743 | 1152 | 1555 | r1 KALDI (A1,A2,B2,C1) → r2 KALDI (A1) → **r3 GEÇTİ** | 2 |
| st-0277 Snow Queen | 330 | 520 | 817 | 1151 | 1550 | r1 KALDI (A1,A2,B2) → r2 KALDI (A1) → r3 KALDI (A2, 1 ifade) → **r4 GEÇTİ** | 3 |
| st-0278 Don Quixote | 322 | 503 | 773 | 1139 | 1540 | r1 KALDI (B1,B2) → r2 KALDI (A1) → **r3 GEÇTİ** | 2 |
| st-0279 Robinson | 314 | 502 | 774 | 1167 | 1575 | r1 KALDI (B1) → r2 KALDI (A2) → r3 KALDI (B2,C1: tekne) → **r4 GEÇTİ** | 3 |
| st-0280 Little Mermaid | 328 | 506 | 776 | 1149 | 1534 | r1 KALDI (A1,A2,B1) → r2 KALDI (A1) → r3 KALDI (C1, 1 cümle) → **r4 GEÇTİ** | 3 |
| st-0281 Pied Piper | 304 | 519 | 804 | 1132 | 1413 | r1 KALDI (A1,A2,B1) → r2 KALDI (A2) → r3 KALDI (B2, "after him") → **r4 GEÇTİ** | 3 |
| st-0282 Rumpelstiltskin | 326 | 519 | 817 | 1097 | 1498 | r1 KALDI (A1,A2,B1) → r2 KALDI (A1,A2) → **r3 GEÇTİ** | 2 |

"En fazla 3 tur" kuralı: yeniden yazım 3'ü aşmadı. r3'te kalan 4 hikayede bulgu tek
cümle/ifadeydi; 3. yeniden yazımı ben yaptım ve sonucu taze bir ajanla doğrulattım (r4).

## 3. Kalite kapıları (son koşu: hepsi GEÇTİ)

Araç: `tools/gates.py` (+ `tools/gate-node.mjs`). Her hikaye, her seviye, otomatik ve loglu.

| # | Kapı | Yöntem | Sonuç |
|---|---|---|---|
| 1 | Şema | **Uygulamanın kendi zod şeması** (`lymia-app/src/services/schemas.ts` doğrudan import) + repo şeması + index girdisi | 10/10, 5 seviye tanındı |
| 2 | D1–D5 | `pipeline/lib/detectors.mjs` (quality-diagnosis.mjs'ten çıkarıldı, aynı kurallar) + `audit.mjs --strict` (uyum, güvenlik tier1, başlık, coverScene, tavan) | 0 bulgu |
| 3 | Gramer | LanguageTool 6.8 yerel (GRAMMAR/TYPOS/CONFUSED_WORDS/CASING/PUNCTUATION/…) | 0 hata; stil notu toplam 10 (raporlandı, `gates/<id>.json > grammar`) |
| 4 | Seviye profili | kelime/medyan cümle/zipf medyanı baseline [min,max] içinde; cümle tavanı; A1–A2 zipf<3.5 ≤ baseline max; yasak yapı taraması (A1/A2: if/will/would/relative/that-clause/passive/perfect/continuous; B1: koşul+passive); rakam; ardışık etiketsiz tırnak; quiz yapısı | 0 ihlal |
| 6 | Telif | `copyright-terms.json` — 56 madde (Disney/Fleischer/DreamWorks/muzikal isim, şarkı, replik) | **0 eşleşme** |
| 7 | Tekrar | mevcut 200 ile başlık Jaccard, özet 3-gram Jaccard, A1 metin 5-gram örtüşmesi | en yüksek: başlık 0.33 (Little Mermaid ~ "The Little Door"), özet 0.125, A1 5-gram 0.003 — eşik altı |

Seviye profili (A1 / A2 / B1 / B2 / C1):

| id | medyan cümle | zipf medyanı | A1/A2 zipf<3.5 | NGSL kapsamı % (uyarı) |
|---|---|---|---|---|
| st-0273 | 6/9/12/16/22 | 6.12/6.10/6.04/6.08/5.96 | .007/.011 | 83/87/92/93/91 |
| st-0274 | 7/9/11.5/14/19 | 6.03/6.07/6.08/6.11/6.07 | .007/.011 | 78/84/91/92/89 |
| st-0275 | 7/9.5/12/16/22 | 5.80/5.93/6.03/6.07/6.00 | .011/.007 | 73/81/90/90/88 |
| st-0276 | 7/9/11/15.5/22 | 6.10/6.08/5.92/5.93/5.88 | .013/.015 | 82/86/93/92/90 |
| st-0277 | 7/9/12/14.5/23.5 | 6.08/6.01/6.11/6.11/5.95 | .010/.013 | 78/86/92/93/91 |
| st-0278 | 7/10/13/16/21.5 | 6.01/6.11/6.11/6.07/6.01 | .004/.011 | 82/85/92/93/90 |
| st-0279 | 7/8.5/11/16/22 | 6.04/5.91/5.99/5.92/5.95 | .007/.009 | 81/84/92/93/91 |
| st-0280 | 6/9/12/16/24 | 6.11/6.11/6.10/6.06/5.93 | .006/.010 | 77/86/91/92/90 |
| st-0281 | 7/8/12/16/21 | 6.06/6.04/6.01/5.95/6.11 | .004/.006 | 85/88/94/94/92 |
| st-0282 | 7/9/12/14/19.5 | 6.01/6.07/6.11/6.11/6.13 | .009/.004 | 83/87/92/93/92 |
| *baseline medyan* | *6/7/10/13/21* | *5.96/5.88/5.89/5.82/5.33* | *0/0 (max .037/.033)* | *97/99/99.6/99.7/84* |

**NGSL notu (dürüst sapma):** NGSL kapsamı A1–B2'de mevcut katalog medyanının altında
(A1 %73–85, katalog %97). Brifteki kapı tanımında NGSL yok; repo audit'inde de uyarı.
Havuz dışı kelimeler incelendi: NGSL-500 *boy, fire, sea, king, hair, smiled, gold, river*
gibi temel A1 kelimelerini içermiyor; dışarıda kalanların neredeyse tamamı bunlar ve
hikayenin çekirdek isimleri (sheriff, arrow, wolf, prince, island). Zipf medyanları
baseline medyanının **üstünde** (kelimeler daha yaygın) ve nadir kelime oranı tavanın
çok altında. Mevcut katalog yüksek kapsamı doğallık pahasına almış (st-0190 A1: "the old
fire source" = lamba). Bilinçli olarak doğallık seçildi.

## 4. Kör inceleme (Task/Agent, taze bağlam)

- Her tur için yeni bir ajan; girdi yalnız okur metni (`tools/review-input.py`: başlık,
  özet, 5 seviye, quiz + anahtar). Kaynak bilgisi, yazar notu, kapı sonucu, önceki inceleme YOK.
- Ölçütler: anlam kayması, doğal olmayan İngilizce, seviye uyumsuzluğu, mantık hatası,
  orijinale sadakat (film ögesi = kalır). Toplam 34 inceleme, JSON: `reviews/<id>-r<n>.json`.
- **En sık bulgu (r1–r2):** aynı konuşmacının sözünün ardışık, etiketsiz tırnaklara
  bölünmesi (İngilizcede yeni konuşmacı demek). Kapı 4'e otomatik kontrol eklendi; son
  durumda 0. Diğer tipik bulgular: zamir belirsizliği (A1), seviyeler arası olay çelişkisi
  (Deniz Kızı'nın düğünü A1–B1'de gemide → karada; Gulliver'de boy "parmak kadar" ↔ "altı
  inç"), kaynakta olmayan ayrıntı (Robinson B1'de Friday'in Robinson'a yemek öğretmesi →
  Defoe'da tersi), quiz anahtarının metinde dayanağı olmaması (Snow Queen A2 "Lapland").
- Örnek r3/r4 gerekçeleri (GEÇTİ): *"All five levels follow Collodi's novel, not the film…
  each quiz answer is correct and has only one defensible answer"* (st-0273 r3);
  *"the ending is softened to him running away, which matches the 1812 edition"* (st-0282 r3).
- İnceleme sonrası mekanik değişiklikler (yeniden kör incelemeye girmedi, kapılar yeniden
  koştu): yıllar yazıyla (1699 → sixteen ninety-nine vb.; karaoke kayması, §5), bu yüzden
  2 cümle kısaltma; 0280–0282'de 74 ardışık tırnağın birleştirilmesi (kelimeler aynı).

## 5. Ses + timing

- `pipeline/generate-audio.py` (edge-tts, en-US-JennyNeural, A1/A2 −%10), 50 MP3 + 50
  timings, toplam ~251 dk, 86 MB, `content/audio/<lvl>/st-0273…0282.*`.
- Kontrol `tools/audio-check.py` → `audio-check.json`: dosya var, ffprobe süresi ile son
  kelime farkı < 1.5 sn, metin↔timing kelime kelime hizalı, cümle zamanları monoton ve
  dolu. **50/50 temiz.**
- Bulunan ve düzeltilen hata: metinde rakamla yazılmış yıl (1699, 1376) TTS'te kelime olarak
  okunuyor, uygulama karaokesi ise yalnız harfli kelimeleri sayıyor → sonraki tüm vurgu bir
  kelime kayıyordu. Yıllar yazıyla yazıldı, 6 seviyenin sesi yeniden üretildi; kapı 4'e
  "rakam yok" kontrolü eklendi.

## 6. Kapak

- `covers/prompts.json` — 10 prompt, şema `{"job":"lymia-kapak","id":"st-XXXX","prompt":"…"}`.
  Stil soneki onaylı `prompts_lymia-kapak_v2.json` ile birebir ("Highly detailed storybook
  illustration… painterly children's book art… no text anywhere, 2:3 vertical"). Repoda
  "whimsical fairytale picture-book" ifadesi geçmiyor; onaylı set bu sonek. Film
  çağrıştıran tarif yok (Deniz Kızı'nda saç rengi/kabuk sütyen yok, Pinokyo'da Disney
  şapkası yok, Kar Kraliçesi'nde Frozen paleti yok). Fareli Köylü'nün sarı-kırmızı yamalı
  giysisi Browning'in metninden.
- Aynı dosya kopyası: `gemini-auto-create-script/prompts_lymia-kapak_classics01.json`.
- `pipeline/import-covers-v2.mjs`: `output/lymia-kapak/<id>.png` → 900×1200 webp ≤300 KB →
  `content/v2/covers/<id>-<sha256[0:8]>.webp`, index `cover` alanını bağlar, eski hash'i siler.
  Şu an katalogda `covers/<id>-pending.webp` (dosya yok).

## 7. Vocab / quiz pipeline

- **Vocab Aşama A** (spaCy, LLM yok) 10 hikayede koştu: 2553 lemma|POS, 17 247 hedef token.
  5 cümlede "cannot" ayrıştırma uyumsuzluğu var (spaCy can+not); bu katalogda da 101 cümlede
  görülen bilinen sınırlama, içerik hatası değil (`vocab-annotate.log`).
- **Vocab Aşama B/C (LLM) bilerek koşturulmadı:** `pipeline/vocab/auto-run.sh` her gün
  ücretsiz Gemini/Groq kotasını 200 hikayelik katalog kurulumunda kullanıyor (son koşu:
  623 istek, 491 hata = kota). Bu 10 hikayeyi ayrıca koşturmak o işin kotasını yer;
  `senses.json` katalog çapında tek dosya olduğundan alt küme koşusu onu bozar. Yeni
  hikayeler `content/v2/stories` altında olduğu için auto-run'ın `--all` kurulumuna
  merge'den sonra kendiliğinden girer. Blokaj değil.
- **Quiz bankası (Faz 3, distilbert yerel, LLM yok):** `build-quiz.py --stories st-0273..st-0282` **koştu**: 2311 lemma|POS, **6776 soru** (hikaye cümlesinden 1920, Tatoeba'dan 4856; A1 283 · A2 1359 · B1 2425 · B2 2180 · C1 529). Özet ve 6 örnek: `quiz-bank-trial-summary.json`. Pipeline'ın kendisi en sonda `cache/quiz-report.json` yazarken `FileNotFoundError` ile düştü (`cache/` klasörü oluşturulmuyor; shard çıktıları tamdı). Bankanın shard dosyaları katalog çapında tek set olduğundan alt küme çıktısı `content/v2/quiz`'i ezmesin diye geri alındı; hikayeler katalog kurulumuna merge'den sonra girer.
  - **Bulgu (mevcut pipeline, takip işi):** Tatoeba kaynaklı sorularda 4+ yaşa uygun olmayan cümle örneklemde göründü (*"The recent scandals involving altar boys…"*). Tatoeba cümlelerine `wordlists/forbidden-content.json` ile içerik güvenliği süzgeci gerekiyor. Ayrıca katalog denemesinde bozuk çekimli çeldirici görüldü ("ridered"). Ana checkout'ta `distractors.py` üzerinde commitlenmemiş bir çalışma var; çakışmamak için dokunulmadı.

## 8. Uygulamada test

Kurulum: `lymia-app` dev build, iOS 18.5 iPhone 16 Pro simülatörü (universal), içerik
`python3 -m http.server` ile bu worktree'den (`EXPO_PUBLIC_CONTENT_ROOT=http://localhost:8787/content`,
yalnız `__DEV__`; app branch `claude/classics-batch-01-a9726e`, `src/services/content.ts`).

| Ekran | Doğrulanan |
|---|---|
| 01 | Pinocchio detay: 5 seviye çipi (A1–C1), "2 dk · 300 kelime" |
| 02–03 | Okuyucu A1 metni; ses indirildi ve çalıyor, karaoke vurgusu doğru kelimede |
| 04–05 | Quiz A1: 3 soru, doğru cevap yeşil, sonuç 3/3, +45 XP |
| 06–14 | Diğer 9 hikaye: okuyucu + ses + karaoke (A2, B1, B2, C1, A1, A2, B1, B2, C1) |
| 15 | Kütüphane araması: "Robin" → Robin Hood + Robinson Crusoe, "Yeni" rozeti |
| 16 | Quiz C1 (Little Mermaid) |

Sunucu logu: 10 hikayenin 10 seviyesinde `mp3` + `timings.json` HTTP 200 (her seviye
2 hikayede denendi). 50 seviyenin tamamı uygulamanın zod şemasından geçiyor (kapı 1).

**Bulgu (uygulama, takip işi):** Ekran 15'te kartlarda başka hikayelerin kapağı görünüyor.
Kapak dosyası henüz yok (404) ve kütüphane kartlarında `expo-image` için `recyclingKey`
verilmediğinden FlashList geri dönüştürülen hücrenin eski görselini tutuyor. Kapaklar
içeri alınınca bu hikayelerde görünmez, ama herhangi bir kapak 404 verirse yanlış kapak
gösterilir. **Kapaklar içeri alınmadan merge edilmemeli.**

## 9. Seri (bölümlü) format

Şemada destek yok (DISCOVERY §3). Öneri:

- Katalog girdisine opsiyonel `series: { id, title, part, of }` (ör. `{ "id": "gulliver",
  "title": "Gulliver's Travels", "part": 1, "of": 4 }`). Uygulamanın zod'u `z.object` ile
  bilinmeyen alanı attığı için eski build'ler kırılmaz, alanı yok sayar.
- Her bölüm ayrı `st-XXXX` (kendi sesi, quiz'i, kapağı); bölüm başlığı "Gulliver's Travels
  · Part 2: Brobdingnag".
- Uygulama: detay ekranında "Bölüm 2/4", bitiş ekranında "Sonraki bölüm" butonu,
  kütüphanede seri rafı. Sıralama `part` ile.
- İçerik: her bölüm kendi içinde kapalı bir olay (bu batch'teki "devamı var hissi yok"
  kuralı bölüm düzeyinde korunur). Aday: Gulliver (4), Alice, Oz, Robinson (3), Sherlock
  Holmes vakaları.

## 10. Faz 2 (40 hikaye): süre ve riskler

- **Süre:** Bu pilot ~1 sa 15 dk duvar saati sürdü (worktree 14:05 → rapor ~15:15): keşif ve
  araçlar ~20 dk, paralel yazım ~10 dk, 3–4 tur inceleme+düzeltme ~25 dk, ses/simülatör/rapor ~20 dk.
  Araçlar hazır olduğundan Faz 2 (4 × 10'luk parti) parti başına ~1 sa → **~4–5 saat ajan zamanı**,
  partiler arası PR onayı ile birlikte 1–2 gün. Kapak otomasyonu günlük 90 görsel limitiyle 1 gün.
- **Token:** yazar ajanı ~150k, inceleme ~85k token; parti başına ~5M token mertebesi.
- **Riskler:**
  1. *Aday havuzu:* en bilinen klasiklerin çoğu katalogda zaten var (bu turda adayların
     %70'i çakıştı). Faz 2 için önce çakışmasız 40'lık liste onaylanmalı (Andersen, Grimm,
     Binbir Gece, Kipling, Wilde, Twain, Dickens bölümleri).
  2. *Kör inceleme döngüsü:* incelemeciler her turda yeni küçük şeyler buluyor; "somut
     okur takılması" ölçütü r4'te eklendi, ilk turdan itibaren kullanılmalı.
  3. *NGSL kapsamı:* doğal metin NGSL-500/1000 hedefini tutmuyor; kapı tanımı netleşmeli
     (zipf tabanlı profil mi, NGSL mi?).
  4. *Uygulama kapak hatası* (§8): kapaksız yayın yanlış kapak gösterir.
  5. *20. yy eserleri:* 1929 öncesi olsa da ülke bazlı istisnalar (Peter Pan gibi) var;
     her aday için kontrol.
  6. *Vocab B/C kotası:* katalog kurulumu bitmeden yeni hikaye eklendikçe iş büyüyor.

## 11. Mustafa'nın adımları

1. Kapak otomasyonu: `gemini-auto-create-script` arayüzüne
   `prompts_lymia-kapak_classics01.json` yapıştır (job `lymia-kapak`) → Üret.
2. Bu branch'te: `node pipeline/import-covers-v2.mjs --ids st-0273,st-0274,st-0275,st-0276,st-0277,st-0278,st-0279,st-0280,st-0281,st-0282`
   → commit. (Script kapakları hash'leyip index'i bağlar; "Kapağı bekleyen" satırı boş kalmalı.)
3. PR'ı onayla. Yayın (merge, contentVersion bump, purge) ayrı karar.

## 12. Bilinen sapmalar / şeffaflık

- Metinleri bu oturumun alt ajanları (Opus 5.5, ortak brif) yazdı; ücretsiz API rotasyonu
  metin üretiminde kullanılmadı.
- Branch, `v2-content`'in yerel HEAD'inden açıldı; origin'e henüz itilmemiş 11 commit'i
  (vocab/quiz Faz 3 pipeline + gizlilik metni) de içeriyor.
- Quiz şıkları deterministik karıştırıldı (`tools/shuffle-quiz.py`); uygulama şıkları kendi
  sırasıyla gösteriyor.
- `pipeline/quality-diagnosis.mjs` v1 `content/stories`'i tarıyor (C1 strip'li); bu iş
  davranışını değiştirmedi, yalnız kuralları `lib/detectors.mjs`'e çıkardı.

## 13. Örnek metinler (st-0280 The Little Mermaid)

### A1

The sea king had six daughters. They were mermaids with fish tails. The youngest was quiet. She loved stories about the land. Soon she turned fifteen. She swam to the top of the sea. She saw a ship with lights. A young prince stood on it.

Then a storm came. The ship broke, and the prince fell. The little mermaid swam to him. She took him to a beach. A girl from a white house found him. He did not see the mermaid.

"Do people live forever?" she asked. "No," said her grandmother. "But people have a soul. It lives forever. We become sea foam." "Can I have a soul?" asked the mermaid. "A man must love you and marry you. Then you get a soul."

She went to the sea witch. "Give me your voice," said the witch. "Then you can have legs. But every step hurts like a knife. He must marry you, or you become foam." The mermaid gave her voice.

Now she had legs, but no voice. Every step hurt, but she smiled. She danced for the prince. He liked her very much. But he loved the girl from the beach.

Then he met a princess. She was the girl from the beach! "You saved me!" he said. They married that day. That evening, they went on a ship. She danced, but her heart hurt.

At night, her sisters came. Their long hair was gone. "We paid the witch with our hair. Here is her knife. Use it on the prince before morning. Then you can come home." She looked at the sleeping prince. But she loved him too much. She threw the knife into the waves. Then she jumped into the sea.

Her body turned into foam. But she did not die. She went up into the warm air. "Come with us," said kind voices. They were the daughters of the air. She smiled at the prince. Then she flew up with them.

### C1

Far out at sea, the water is as blue as a cornflower and as clear as glass, yet deeper than any anchor rope can measure. Down there, where strange trees sway at the faintest stir of the current, stands the palace of the sea king, its walls of coral and its roof of shells. The king had long been a widower, and his household was run by his aged mother, a proud and clever woman who wore twelve oysters on her tail. Other ladies of rank were permitted only six.

The youngest of her six granddaughters was the loveliest, with eyes as blue as the deepest water and, like her sisters, a fish's tail instead of feet. She was a strange, quiet child, and while the others filled their gardens with odd treasures from wrecked ships, she planted only flowers as red as the sun. Her one other treasure was a marble statue of a handsome boy, which had sunk to the sea floor after some long-forgotten shipwreck. Nothing gave her greater joy than tales of the world above, where flowers had a scent and birds, which her grandmother called fish, sang in the trees.

"When you reach your fifteenth year," the old woman promised, "you may rise to the surface and watch the great ships sail by." Born a year apart, the sisters went up one by one, leaving the youngest to wait five long years. The eldest came back speaking of a great city whose lights glittered like countless stars, and of church bells whose sound drifted far across the water.

When her own birthday came, the oysters her grandmother fastened to her tail pinched painfully, but beauty, the old lady said, always has its price. Then she rose as lightly as a bubble, and the sun had only just set when she lifted her head above the waves. A great ship lay in the calm water, music drifting from its deck, and as darkness gathered, hundreds of colored lanterns flared into life. The sailors were celebrating the sixteenth birthday of a young prince with large dark eyes, and she could look at nothing else.

Long after midnight, the sea grew restless and lightning tore the clouds apart. The ship plunged among waves as high as mountains, until its great mast snapped like a reed and the vessel rolled onto its side. For one foolish moment she rejoiced, before remembering that humans cannot breathe in water and that he would reach her father's palace only in death. She dived through the wreckage until she found him, his strength almost gone, and held his head above the waves while the current carried them both.

By morning the storm had passed, though the prince's eyes stayed shut, and she thought he resembled the marble boy in her garden. She laid him on the sand near a white building, perhaps a convent, then withdrew behind some rocks, hiding her face in the foam. Presently a bell rang, young girls came out into the garden, and one of them found the stranger and ran to fetch help. The prince came to himself and smiled at everyone around him, but he had no idea who had truly saved him.

Unable to bear her secret any longer, she confided in one of her sisters, and before long a mermaid who knew every coast led them to his palace. From then on she spent her nights beneath its balcony, listening gladly as the fishermen praised him.

"Do humans live forever?" she asked her grandmother, and learned that their lives were even shorter than a mermaid's three hundred years. "Yet when our time ends, we are only foam upon the water, while human beings have a soul that rises through the clear air to the stars," the old woman said. "I would gladly trade every one of my centuries for a single human day," the little mermaid said sadly. There was one way, her grandmother admitted: a man would have to love her more than his own parents and pledge himself to her before a priest. "Then part of his soul would flow into you, but it can never happen, for people on land think a fish's tail is hideous."

That night, while the sea king's court held a great ball, the little mermaid slipped away to the sea witch, whom she had always dreaded. The way led past roaring whirlpools and through a forest of polyps, half plant and half animal, whose arms seized anything drifting near. "I know what you want," the witch said with a dreadful laugh, "and you shall have it, for it will bring you nothing but sorrow." She promised to brew a drink that would split the tail in two, and warned that the change would feel like a sword cutting through her body. Afterward, she would glide more gracefully than any dancer on earth, yet every step would feel as though she were treading on sharp knives. "And should the prince marry another, your heart will break on the following morning, and you will become nothing but foam upon the waves." Her price was the girl's voice, the sweetest in the whole ocean, and although the little mermaid turned pale, she bowed her head and paid it.

The sun had not yet risen when she climbed the prince's marble steps and drank the burning potion, and a pain like a blade went through her. She fell into a faint, and when she woke, the young prince stood before her, gazing at her in wonder. Her tail was gone, replaced by slender white legs, but when he asked who she was, she could only look at him in silence. Each step felt exactly as the witch had warned, yet she bore the pain gladly, and when she danced, the whole court was enchanted. The prince declared that she must never leave him, and he let her sleep on a velvet cushion outside his door.

She rode beside him through fragrant woods and climbed the highest mountains in his company, laughing even when her delicate feet bled. At night, she would slip down the marble steps to cool her burning feet in the sea, and once her sisters rose arm in arm, singing a song of mourning. Day by day the prince grew fonder of her, yet he loved her as one loves a gentle child, never as a future queen. "You remind me of the girl from the holy house who found me on the shore," he confided, "the only one I could ever love." The little mermaid, who knew the truth and could not utter it, could only sigh without a sound.

Soon there was talk that the prince was to marry a neighboring king's daughter, and a splendid ship was made ready. He went only because his parents wished it, he insisted, but when the princess appeared, his reluctance turned to delight. She was the very girl from the white building by the shore, where she had been sent to learn the royal virtues. "It was you who saved me when I lay half dead on the sand!" he cried to the princess; then he turned to the little mermaid to share his joy. She kissed his hand and felt her heart begin to break.

The wedding took place amid ringing bells, and that same evening the couple went aboard the ship, where a royal tent of purple and gold stood on the deck. The little mermaid danced as never before, knowing that she would not see again the man for whom she had given up her home and her voice. At midnight the couple withdrew into their tent, and she leaned on the rail, watching the east for the first red streak of dawn. Then her sisters rose out of the waves, as pale as she was, their long hair gone, for they had given it to the witch. "In return she gave us this knife," they cried, "and you must use it against the prince before the sun rises. Then your feet will grow together into a tail, and you can live out your three hundred years with us."

She drew aside the purple curtain and saw the bride asleep beside the prince, and she heard him murmur his bride's name in his dreams. The knife trembled in her grasp; then she flung it far into the waves, which gleamed red where it fell. Once more she looked at the prince, then threw herself from the ship and felt her body dissolving into foam. Yet the sun rose warm and gentle over the water, and instead of death she felt herself drawn upward among hundreds of clear, beautiful beings. "We are the daughters of the air," they told her, "and though we have no soul either, we may earn one by doing good for three hundred years." Below, the prince and his bride were searching for her, gazing sadly at the bubbling foam as though they guessed what she had done. Unseen, she kissed the bride's forehead, smiled at the prince, and rose with the other children of the air toward a rosy cloud drifting high above the sea.
