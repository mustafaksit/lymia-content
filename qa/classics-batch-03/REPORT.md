# Klasikler batch-03 (Faz 3) — Rapor

Branch: `content/classics-batch-03`, `content/classics-batch-02` üzerine açıldı. Yayın yapılmadı:
- main'e merge edilmedi
- contentVersion 25'te bırakıldı
- CDN purge yapılmadı

## 1. Özet

| | |
|---|---|
| Hikaye | 50 hikaye (st-0323 … st-0372), her biri 5 seviyeli (A1–C1); toplam 250 seviye metni |
| Kaynak | `FAZ3-CANDIDATES.md` listesindeki 50 eserin tamamı; yedek kullanılmadı |
| Tür | klasik 15, macera 9, günlük 8, gizem 7, bilimkurgu 7, romantik 4 |
| Kapılar | 50/50 TÜM KAPILAR GEÇTİ (`gates/final.txt`). Yeni 4c kapısı dahil |
| A1–A2 çekirdek kapsam (4c) | A1: min 0.921, medyan 0.939 (hedef 0.92). A2: min 0.953, medyan 0.964 (hedef 0.95) |
| Kör inceleme | 50/50 PASS. Ayrıntı §4 |
| Ses | 250/250 seviye temiz (`audio-check.json`). Kelime sayıları tutuyor; timings, son metinle kelime kelime aynı |
| Simülatör (iOS 18.5) | 10 hikaye × 5 seviye = 50 sesli okuma PASS, 3 quiz PASS, kütüphane araması PASS |
| Kapak | Henüz üretilmedi. 100 hikayelik birleşik prompt dosyası hazır (§8) |

## 2. A1–A2 temel kelime kapsamı (yeni şart)

Faz 2'de A1 kapsamı %71–89, A2 kapsamı %80–93 aralığındaydı. Hedef %92 / %95'ti ve iki fazdır altında
kalınıyordu. Bu batch'te kapsam uyarı olmaktan çıkarıldı, kapı oldu.

**Kural (kapı 4c, `pipeline/classics/gates.py` + `gate-node.mjs`):**
- A1'de kelimeler NGSL-500 + ek listeden gelmeli, `coreCoverage ≥ 0.92` olmalı.
- A2'de kelimeler NGSL-1000'den gelmeli, `coreCoverage ≥ 0.95` olmalı.
- Muafiyetler hem paydan hem paydadan çıkarılır:
  - Özel isimler: `sources.json` içindeki `names` alanı. Cümle başında büyük harfle geçenler de sayılır.
  - Hikayeye özgü anahtar kelimeler: `keyTerms` alanının ilk 5 terimi. Lemma eşleşmesiyle uygulanır; örneğin "sisters" terimi "sister"ı da kapsar.
- Kapı yalnız `batch` numarası 3 ve üstü olan hikayelere uygulanır. Eski batch'lerin sonucu değişmedi.
- Muaf anahtar kelimeler kör inceleme girdisinde "Glossed key words (A1/A2)" başlığıyla gösterilir.
  Uygulamada bu kelimelerin çevirisi zaten var.
- LanguageTool, keyTerms ve isimleri yazım hatası saymaz. Örnek: Sadko'daki "harp".

**Fizibilite:**
- Batch-02'nin 40 hikayesinden hiçbiri bu hedefleri karşılamıyordu.
- Pilot olarak üç hikaye yazıldı: st-0327 William Tell, st-0339 Sense and Sensibility, st-0363 Hans in Luck.
  Üçü de hedefi doğal İngilizceyle tutturdu. Bunun üzerine hedef değiştirilmeden 50 hikayeye uygulandı.

**Sonuç (50 hikaye):**

| | min | medyan | max |
|---|---|---|---|
| A1 çekirdek (muafiyetli) | 0.921 | 0.939 | 0.982 |
| A2 çekirdek (muafiyetli) | 0.953 | 0.964 | 0.996 |
| A1 ham kapsam (muafiyetsiz) | 0.819 | 0.915 | 0.947 |
| A2 ham kapsam (muafiyetsiz) | 0.895 | 0.945 | 0.982 |

Ham kapsamın medyanı da batch-02 aralığının üst ucunun üstüne çıktı.

**"A1 okuru bu metni anlar mı":**
- Kör incelemeye 7. ölçüt olarak eklendi (`REVIEWER-PROMPT.md`). Sözlüksüz okumayı engelleyen kelime ya da
  kalıp sayısı birkaçı aşarsa A1 kalır.
- Bu ölçütten kalan örnekler:
  - st-0369: "keep my word", "made no sense", "at once"
  - st-0365: "look after", "tune"
  - st-0366: "on its front"
- Hepsi düzeltildi ve yeniden incelemeden geçti.

## 3. 4+ yaş uygunluğu

Batch-02'deki 4+ filtresi aynen uygulandı:
- Her hikayenin `sources.json` kaydında bir `fourPlus` notu var.
- 4p kapısı (sert terimler) çalıştı.
- Kör incelemenin 6. ölçütü de 4+ uygunluğu.

Öne çıkan yumuşatmalar:
- **Koordinatörün önden yaptıkları:**
  - st-0332: "wine" (iş olarak) çıkarıldı.
  - st-0333: bıçak sahnesi çıkarıldı.
  - st-0338: "drunk" → "swallowed" (sert terim).
- **Yazarların yaptıkları:**
  - Swineherd'de imparatorun terlikle vurması çıkarıldı.
  - Diamonds and Toads'da ablanın ormanda ölümü "uzaklara gitti" oldu.
  - Bamboo Cutter'da beşinci talibin düşüp ölmesi çıkarıldı.
  - Frog Princess'te şarap "kadehinde kalan" oldu, Koschei de kansız biçimde "kayboldu".
- **Kör incelemenin yakaladıkları:**
  - **st-0365 The Swineherd:** prensin kılığı "yüzünü kara boyadı / brown and black" diye yazılmıştı. Bu,
    blackface gibi okunabiliyordu. Tüm seviyelerde "toprak ve is" yapıldı; dosyada "black" ve "brown"
    sözcükleri artık hiç geçmiyor.
  - **st-0366 A1:** "He was black, and he had a ladder." cümlesi ten rengi gibi okunabiliyordu. Cümle
    "His clothes were black from the chimneys." oldu.
  - **st-0370 C1:** "give herself to a man" ifadesi "marry a man" oldu.

## 4. Pipeline ve kör inceleme

Pilotla aynı `pipeline/classics/` araçları kullanıldı.

**Kapılar:**

| Kapı | Kontrol |
|---|---|
| 1 | Şema |
| 2 | D1–D5 ve `audit --strict` |
| 3 | LanguageTool |
| 4 | Profil |
| **4c** | **Çekirdek kapsam (yeni)** |
| 4p | 4+ |
| 6 | Telif |
| 7 | Tekrar |

**Çalışma düzeni:**
- Her hikayeyi tek bir yazar ajanı yazdı ve düzeltti. Aynı anda en çok 12 ajan çalıştı.
- Kör inceleme her turda taze bir ajanla yapıldı. İnceleyen ajan yalnız `review-input.py` çıktısını gördü.
- Tur dökümü `reviews/SUMMARY.txt` dosyasında, ham kararlar `reviews/st-XXXX-rN.json` dosyalarında.

| Geçtiği tur | Hikaye |
|---|---|
| 1. tur | 13 |
| 2. tur | 24 |
| 3. tur | 10 |
| 4. tur (doğrulama) | 1 (st-0337) |
| 5. tur (ikinci doğrulama) | 1 (st-0338) |

**Kural dışı durum, st-0338 The Stolen Bacillus:** hikaye üç yeniden yazım turu ve doğrulama turu (r4)
sonunda üç dilbilgisi satırında kaldı. A1 ve A2'deki "Soon his face is blue too!" cümlesinde tek seferlik bir gelecek
tahmini geniş zamanla anlatılmıştı. A2'deki "What makes you laugh?" sorusu ise doğal değildi. Bu üç
satırı koordinatör düzeltti ve ikinci bir doğrulama turu (r5) PASS verdi. "3 tur + doğrulama" kuralı bu
hikayede bir tur aşıldı.

En sık kalma nedenleri:
1. A1'de engelleyen kelime veya deyim (yeni 7. ölçüt).
2. Belirsiz zamir veya konuşmacı. Örnek: st-0370 A1'de "he" İmparator yerine yaşlı adam gibi okunuyordu.
3. Mantık veya tutarlılık hatası:
   - st-0370 B1: "işçilere para ödedi" yazıyordu, sonra işçiler para istemeye geliyordu.
   - st-0368 A2: perinin vaadinde inci yoktu, ama ağızdan inci dökülüyordu.
4. Quiz'de savunulabilir ikinci şık. Örnek: st-0371 A1'de "the second time".
5. İroninin düz anlamla okunması. Örnek: st-0368 B1'de ablanın alaycı sözü.

**Koordinatörün doğrudan yaptığı küçük müdahaleler:**
- **Kapsam:** 16 hikayede tek cümlelik ya da quiz düzeltmeleri yapıldı: 0325, 0327, 0330, 0334, 0337, 0338,
  0340, 0343, 0346, 0347, 0351, 0355, 0361, 0362, 0364, 0371. Faz sonunda bunlara 0365, 0366, 0368 ve 0370
  eklendi.
- **Doğrulama:** her düzeltme yeniden kapıdan ve kör incelemeden geçti.
- **Cümle tavanı:** müdahale bir cümleyi seviye tavanının üstüne çıkardığında cümle kısaltıldı. Bu durum
  0325 B1, 0337 A1, 0361 A1, 0362 A1 ve 0371 B2'de oldu.
- **Yazar betiğinin üzerine yazması:** st-0338'de yazar ajanının `build.py` betiği koordinatörün bir quiz
  düzeltmesini sildi. Düzeltme yeniden uygulandı ve yazarlara "güncel JSON'dan yeniden kur" kuralı eklendi.

**Kaynak (sources.json) düzeltmeleri:** Koordinatörün yazdığı üç bölüm özeti asıl eserle çelişiyordu ve
düzeltildi:
- st-0323: sonda Fritz ile Franz Avrupa'ya gidiyor; anne-baba, Ernest ve Jack adada kalıyor.
- st-0344: Rebecca, Adam Ladd ile sabun satarken tanışıyor.
- st-0356: kuzenler, kentin liderinin yüzünde profesörün yüzünü tanıyor.

Bu üç hikaye düzeltilmiş özetle yazıldı ve incelendi.

## 5. Ses

Ses `pipeline/generate-audio.py` ile üretildi. Ayarlar batch-02 ile aynı: edge-tts, en-US-JennyNeural, A1 ve A2 %10 yavaş.

- **Çıktı:** 250 MP3 ve 250 `timings.json`.
- **Üretim sırası:** kör incelemeden geçen hikayeler beklenmeden üretildi. Sonradan düzeltilen hikayelerin sesi (0364, 0365, 0366, 0368, 0369, 0370, 0371, 0372) son metinden yeniden üretildi.
- **Kontrol:**
  - `pipeline/classics/audio-check.py`: 250/250 seviye temiz.
  - Her `timings.json` dosyasındaki kelime dizisi, son story JSON metniyle kelime kelime karşılaştırıldı: 250/250 aynı. Sesin eski bir metinden kalmadığı böylece doğrulandı.

## 6. Simülatör testi (iOS 18.5, iPhone 16 Pro, dev build)

İçerik bu worktree'den `python3 -m http.server 8787` ile sunuldu. Tam tablo: `screens/SIM-TEST.md`.

**Metro notu:** :8082'deki Metro ana checkout'u (`release/1.1`) sunuyordu. Bu kodda `EXPO_PUBLIC_CONTENT_ROOT`
override'ı yok, bu yüzden uygulama içeriği jsDelivr'dan okuyordu ve yeni hikayeler boş açıldı. Test ajanı
kaynak koduna dokunmadı. Override'ı içeren `fix/1.2-story-card-cover-recycling` dalını geçici bir klasöre
çıkardı ve ikinci bir Metro'yu :8083'te başlattı. Simülatör test boyunca bu Metro'ya bağlandı. Hikaye, ses
ve timings istekleri localhost:8787'den 200 ile döndü. Test bitince simülatör ayarı :8082'ye geri alındı.

| Test | Sonuç |
|---|---|
| Okuyucu + ses + karaoke: st-0323, 0327, 0332, 0338, 0341, 0364, 0365, 0368, 0370, 0372 × A1–C1 | 50/50 PASS. Başlık ve seviye doğru; ses indi ve çaldı; vurgu ilk cümlede. Tek istisna st-0323 A1: ekran görüntüsü geç alındı, vurgu 2. cümlede doğru kelimedeydi |
| Quiz: st-0327 A2, st-0365 B2, st-0372 C1 | 3/3 PASS. 0327 A2'de bir şık bilerek yanlış seçildi; yanlış şık kırmızıyla, doğru şık ("Walter") vurguyla gösterildi (+20 XP). Diğer ikisi 3/3, +45 XP. 9 cevap anahtarı metinle karşılaştırıldı, hepsi doğru |
| Kütüphane araması "Swineherd" | PASS. Hikaye bulundu, "Yeni" rozeti ve kapak yer tutucusu görünüyor, yanlış kapak yok |

Ekranlar `screens/` klasöründe: 50 okuyucu, 3 quiz ve 1 kütüphane ekranı.

**Açık gözlem (içerikle ilgisiz):** üçüncü quiz'in sonuç ekranından deep link ile çıkınca uygulama dokunmalara
tepki vermedi; deep link'ler ise çalışmaya devam etti. Uygulama kapatılıp açılınca düzeldi. Görünmez bir
overlay mi yoksa simülatör aksaklığı mı, ayırt edilemedi. Uygulama tarafında yeniden üretilmeye değer.

## 7. Bilinen uyarılar (kapıyı kırmayan)

- **"Dick" ve küfür denetimi:** st-0343 Little Lord Fauntleroy'daki ayakkabı boyacısı Dick'in adı audit'in
  küfür listesine takıldı. Yazar karakteri adsız bıraktı ("a poor young man who cleaned shoes"; yalnız B1–C1'de geçiyor). Öneri: audit'e `names`
  istisnası eklenmeli.
- **"Will Stutely" ve modal taraması:** st-0326 Robin Hood'da A1/A2 yasak yapı taraması bu adın "Will"
  kısmını modal fiil sanıyor. Karakter A1–A2'de anılmıyor; B1–C1'de adıyla geçiyor. Aynı istisna bu sorunu da çözer.
- **Karaoke ve aksanlı harfler:** karaoke yalnız `[A-Za-z]` karakterlerini sayıyor. Bu yüzden isimler ASCII
  yazıldı: Skåne → Skane, Arsène → Arsene, Akşehir → Aksehir. Kural `WRITER-TASK.md` içine eklendi.
- **st-0360 başlığı:** başlık "Persephone and the Pomegranate Seeds", metin ise Hawthorne'a uyarak
  "Proserpina" diyor. Başlık tanınırlık için bırakıldı.
- **Hedef üstü kelime sayıları:** bazı A1/A2 metinleri brief hedefini birkaç on kelime aşıyor. Hepsi kapı
  tavanının altında (A1 ≤ 385, A2 ≤ 590). Örnekler: st-0365 A1 370, st-0372 A1 371, st-0369 A1 370.
- **B1–C1 NGSL kapsamı:** %88–95 aralığında; önceki batch'lerdeki gibi uyarı düzeyinde.

## 8. Kapaklar (pilot + Faz 2 + Faz 3, 100 adet)

- **Toplu prompt dosyası:** `qa/classics-covers/prompts_lymia-kapak_classics-all.json`. 100 kayıt var
  (st-0273 … st-0372). Her kayıt `{"job":"lymia-kapak","id","prompt"}` biçiminde ve onaylı stil son ekiyle
  bitiyor.
  - İlk 50 kayıt değişmedi.
  - Yeni 50 sahne aynı üslupla yazıldı.
  - 4+ için gerilimli anlar yerine sakin anlar seçildi. Örnekler:
    - William Tell: oklu elmayı gururla tutan çocuk; nişan alan yay yok.
    - Persephone: çiçek toplama anı; kaçırma yok.
    - Daedalus: kanat takma anı; düşüş yok.
- **ID listesi:** `qa/classics-covers/ids.txt`, 100 satır.
- **Üretim:** dosyayı kapak otomasyonuna yapıştır (job `lymia-kapak`) ve üret.
- **İçe aktarma:** `node pipeline/import-covers-v2.mjs --ids $(paste -sd, qa/classics-covers/ids.txt)`

## 9. Dosyalar

- **Hikayeler:** `content/v2/stories/st-0323.json` … `st-0372.json`
- **Katalog:** `content/v2/index.json`, 300 hikaye, contentVersion 25
- **Kaynaklar:** `content/v2/sources.json`. 50 yeni kayıt (`names`, `keyTerms`, `fourPlus`, `batch: classics-batch-03`)
- **Sesler:** `content/audio/{a1,a2,b1,b2,c1}/st-0323…0372.{mp3,timings.json}`
- **Pipeline:**
  - `gates.py`, `gate-node.mjs`: 4c kapısı ve isim/keyTerm muafiyeti
  - `review-input.py`: glossed key words
  - `REVIEWER-PROMPT.md`: 7. ölçüt
  - `WRITER-BRIEF.md`: 4c bölümü
  - `copyright-terms.json`: 11 yeni film terimi
- **QA:** `qa/classics-batch-03/` klasöründe `REPORT.md`, `WRITER-TASK.md`, `batch-ids.json`, `audio-check.json`,
  `gates/`, `reviews/`, `screens/`
- **Kapaklar:** `qa/classics-covers/prompts_lymia-kapak_classics-all.json` ve `ids.txt`, 100 kapak

## 10. Senin adımların

1. 100 kapağı tek seferde üret (§8), ardından import ve commit.
2. Bu PR'ı incele ve onayla. Merge, contentVersion bump ve purge ayrı bir karar.
3. İsteğe bağlı: audit'e `names` istisnası eklensin mi? (§7, Dick / Will)
