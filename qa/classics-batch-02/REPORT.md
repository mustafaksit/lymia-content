# Klasikler batch-02 (Faz 2) — Rapor

Branch: `content/classics-batch-02` (`content/classics-batch-01-clean` üzerine). Yayın yok: main'e merge,
contentVersion bump (25'te kaldı) ve CDN purge yapılmadı.

## 1. Özet

| | |
|---|---|
| Hikaye | 40 (st-0283 … st-0322), her biri 5 seviye (A1–C1), 200 seviye metni |
| Tür | macera 9, gizem 6, romantik 4, günlük 7, bilimkurgu 4, klasik 10 |
| Kapılar | 40/40 TÜM KAPILAR GEÇTİ (`gates/final.txt`) |
| Kör inceleme | 40/40 PASS. 9'u 1. turda, 18'i 2. turda, 11'i 3. turda, 2'si doğrulama turunda geçti |
| Ses | 200/200 seviye temiz (`audio-check.json`): kelime sayısı tutuyor, rakam yok, kuyruk boşluğu normal |
| Simülatör (iOS 18.5) | 8 hikaye × 5 seviye = 40 sesli okuma PASS, 3 quiz PASS, kütüphane araması PASS |
| Kapak | Henüz yok (`covers/<id>-pending.webp`). 50 kapak için toplu prompt dosyası hazır (§8) |
| Faz 3 | 50 aday listesi: `FAZ3-CANDIDATES.md` |

## 2. 4+ yaş uygunluğu (şart 1)

Kategori listesi App Store 4+ derecesine göre baştan elendi. Kan, şiddet, cinayet ayrıntısı veya
cinsellik içeren 12 eser çıkarıldı. Yerlerine aynı türden masal, macera veya gizem eserleri geldi:

| Çıkan | Neden |
|---|---|
| Dr Jekyll and Mr Hyde | cinayet (Carew), şiddet |
| Frankenstein | cinayetler (William, Elizabeth) |
| The Monkey's Paw | ölüm, ceset, dehşet |
| Dracula | kan, ölü, korku |
| Romeo and Juliet | intihar |
| Jane Eyre | tımarhane, kundaklama, yanma, bigami |
| The Speckled Band | yılanla cinayet |
| The Call of the Wild | köpek dövüşleri, öldürme |
| Moby-Dick | balina avı, ölüm |
| The War of the Worlds | kitlesel ölüm, ısı ışını |
| The Invisible Man | şiddet, cinayet |
| The Lost World | yerli halkla çatışma, öldürme |

- **Korku kategorisi:** bu batch'te korku türünde eser yok. The Canterville Ghost, kan lekesi yerine "hiç
  çıkmayan eski kırmızı leke" ile korkutmayan, komik bir gizem tonunda anlatıldı.
- **sources.json:** her hikayeye bir `fourPlus` notu eklendi. Not, neyin yumuşatıldığını ve neyin bilerek
  dışarıda bırakıldığını söyler. Örnekler:
  - Dolittle'da Jolliginki ve Bumpo bölümü yok.
  - Oliver Twist'te Fagin'in etnik tasviri ile Nancy ve Sikes yok.
  - Gold-Bug'da Jupiter'in şivesi ve karikatürü yok.
- **Kör inceleme:** ölçütlere 6. madde olarak "4+ yaş uygunluğu" eklendi (`pipeline/classics/REVIEWER-PROMPT.md`).
  İnceleme iki tütün sahnesi yakaladı ve ikisi de çıkarıldı:
  - st-0292 B1: "he lit his pipe"
  - st-0293 C1: "lighting his pipe"
- **4p kapısı:** `gates.py` içinde 4+ terim kapısı var. Sert terimlerden biri geçerse kapı kalır; yumuşak
  terimler (died, sword, skull…) yalnız raporlanır, hepsi masum bağlamda.
- **batch-01 düzeltmeleri:** batch-01'de de geriye dönük iki 4+ düzeltmesi yapıldı ve sesleri yeniden üretildi:
  - st-0277 C1: "stabbed" → "pierced"
  - st-0280 B2 ve C1: "feet bled" → "every step hurt"

## 3. Pipeline (şart 2)

Pilotla aynı `pipeline/classics/` araçları ve aynı kapılar kullanıldı:

| Kapı | Kontrol |
|---|---|
| 1 | Şema |
| 2 | D1–D5 ve `audit --strict` |
| 3 | LanguageTool |
| 4 | Seviye profili |
| 4p | 4+ terimleri |
| 6 | Telif |
| 7 | Tekrar |

Akış şöyle işledi:
- Her hikayeyi tek bir yazar ajanı yazdı ve düzeltti, en fazla 20 ajan aynı anda çalıştı.
- Kör inceleme her turda taze bir ajanla yapıldı. İnceleme ajanı yalnız `review-input.py` çıktısını gördü.
- Tur sınırı: en fazla 3 yeniden yazım turu, ardından doğrulama.
- Tur dökümü: `reviews/SUMMARY.txt`.
- Ham kararlar: `reviews/st-XXXX-rN.json`.

En sık kalma nedenleri:
1. Belirsiz zamir veya konuşmacı.
2. Seviyede tanıtılmamış kişi ("the earl", "Jimmy Bean", "Marmee").
3. Seviyeler arası zaman çizgisi çelişkisi (Theseus'ta şafak/gece).
4. Quiz'de savunulabilir ikinci şık.
5. Kaynağa sadakat hatası:
   - Norwood'da McFarlane'in geceyi Blackheath'te değil Norwood'da geçirmesi
   - Baskervilles'de itiraf ve kovalamaca sırası

Koordinatörün doğrudan yaptığı küçük müdahaleler (hepsi sonra yeniden kapı ve kör incelemeden geçti):
- **Başlık geri dönüşü:** st-0317 ve st-0319'da yazar ajanları başlığı onaylı başlıktan eski hâline
  döndürmüştü. Başlıklar onaylı hâle geri alındı: "Dummling and the Golden Goose" ve "The Little Match-Seller".
  Eski başlıklar katalogdaki st-0131 ve st-0256 ile benzerlik eşiğini aşıyordu.
- **Tek cümlelik düzeltmeler:**
  - st-0292 A2: "His nephew" → "Sir Charles's nephew"
  - st-0315 C1: "At dawn" → "That night"

## 4. Ses

`pipeline/generate-audio.py` ile üretildi (edge-tts, en-US-JennyNeural, A1 ve A2 %10 yavaş).
- **Çıktı:** 200 MP3 ve 200 `timings.json`.
- **Geçici hata:** st-0290 ve st-0291'de edge-tts bir kez "NoAudioReceived" verdi. Yeniden denemede ikisi
  de üretildi.
- **Kontrol:** `pipeline/classics/audio-check.py` 200/200 seviyeyi temiz buldu; kelime sayıları birebir
  eşleşiyor.

## 5. Simülatör testi (iOS 18.5, iPhone 16 Pro, dev build)

İçerik bu worktree'den `python3 -m http.server 8787` ile sunuldu. Uygulama tarafında
`EXPO_PUBLIC_CONTENT_ROOT=http://localhost:8787/content` kullanıldı (yalnız `__DEV__`), Metro 8082'de çalıştı.
Tam tablo: `screens/SIM-TEST.md`.

| Test | Sonuç |
|---|---|
| Okuyucu + ses + karaoke: st-0283, 0292, 0298, 0305, 0309, 0313, 0318, 0322 × A1–C1 | 40/40 PASS. Her seviyede ses indirildi, çalıyor, vurgu ilk cümlede doğru kelimede |
| Quiz: st-0298 A2, st-0313 B2, st-0322 C1 | 3/3 PASS, sonuç ekranı ve +45 XP |
| Kütüphane araması "Musketeers" | PASS. Uygulama yeniden başlatıldıktan sonra bulundu, "Yeni" rozeti ve kapak yer tutucusu görünüyor, yanlış kapak yok |

Ekranlar `screens/` klasöründe: 40 okuyucu, 3 quiz ve 1 kütüphane ekranı.

Not: kütüphane aramasının ilk denemesi boş döndü. Uygulama yeni içerik eklenmeden önce açılmıştı ve
bellekte eski 210 hikayelik katalog vardı. Katalog yalnız açılışta ya da bağlantı geri gelince okunuyor,
contentVersion da bilerek 25'te bırakıldı. Uygulama yeniden başlatılınca yeni hikayeler göründü. Bu bir
uygulama hatası değil; yayında contentVersion bump'ı bunu çözer.

## 6. Bilinen uyarılar (kapıyı kırmayan)

- **NGSL kapsamı:** A1 %71–89, A2 %80–93 aralığında, hedef %92 ve %95. Önceki batch'teki gibi uyarı
  düzeyinde. Açığın çoğu hikayenin vazgeçilmez sözcüklerinden geliyor: isimler, sword, beetle, goose…
- **Hedef üstü kelime sayıları:** bazı seviyeler brief'in kelime hedefini aşıyor ama kapı sınırının altında:
  - st-0316: A1 333, B1 834, C1 1599
  - st-0295 A2: 540
  - st-0310 A2: 566
  - st-0317 A1: 369
- **Gate tuhaflığı:** `d'Artagnan` adı kesme işaretinde bölünüyor ve "d" nadir sözcük sayılıyor.
  Kapıyı kırmıyor, düzeltilmedi.
- **LanguageTool sunucusu:** son kapı turundan sonra kapandı. Sonuçlar etkilenmedi.

## 7. Dosyalar

- `content/v2/stories/st-0283.json` … `st-0322.json`
- `content/v2/index.json`: 250 hikaye, contentVersion 25
- `content/v2/sources.json`: 40 yeni kaynak ve `fourPlus` notları
- `content/audio/{a1,a2,b1,b2,c1}/st-0283…0322.{mp3,timings.json}`
- `qa/classics-batch-02/`:
  - `REPORT.md`
  - `FAZ3-CANDIDATES.md`
  - `WRITER-TASK.md`
  - `batch-ids.json`
  - `audio-check.json`
  - `gates/`
  - `reviews/`
  - `screens/`
- `qa/classics-covers/prompts_lymia-kapak_classics-all.json` ve `ids.txt`: 50 kapak, st-0273…st-0322
- `qa/classics-batch-01/audio-check.json`: batch-01'in geriye dönük 4+ ses yenilemesinin kontrol çıktısı

## 8. Kapaklar (pilot ve Faz 2, 50 adet)

- **Toplu prompt dosyası:** `qa/classics-covers/prompts_lymia-kapak_classics-all.json`. 50 kayıt, her biri
  `{"job":"lymia-kapak","id","prompt"}` biçiminde. Onaylı stil son eki her kayıtta var.
- **ID listesi:** `qa/classics-covers/ids.txt`.
- **Üretim:** kapak otomasyonuna dosyayı yapıştır (job `lymia-kapak`) ve üret.
- **İçe aktarma:**
  `node pipeline/import-covers-v2.mjs --ids $(paste -sd, qa/classics-covers/ids.txt)`

## 9. Faz 3

`FAZ3-CANDIDATES.md`: 50 aday.
- **Elemeler:** tarih (1929 öncesi), telif (yazar 1955 öncesi ölmüş ya da eser folklor) ve 4+ uygunluğu.
  Çakışma kontrolü mevcut 250 hikayeyle yapıldı.
- **Tür dağılımı:** macera 9, gizem 7, romantik 4, günlük 8, bilimkurgu 7, klasik 15. Korku türünde aday
  yok; bu türün yerine gizem ve masal tercih edildi.
- **Yedekler:** 6 eser.

## 10. Senin adımların

1. 50 kapağı tek seferde üret (§8), ardından import ve commit.
2. Bu PR'ı incele ve onayla. Merge, contentVersion bump ve purge ayrı karar.
3. Faz 3 listesini onayla ya da değiştir.
