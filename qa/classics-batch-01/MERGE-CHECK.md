# classics-batch-01 — Merge öncesi kontrol

Tarih: 2026-10-29 · Content branch: **`content/classics-batch-01-clean`** (yeni) ·
App branch: `fix/1.2-story-card-cover-recycling`

## 1. Branch'teki 11 ek commit

`content/classics-batch-01`, yerel `v2-content` HEAD'inden (4b099a6) açılmıştı. O HEAD, origin'deki
`v2-content`'ten 11 commit ilerideydi. Bu commit'lerin hiçbiri yeni hikayelerle ilgili değil.

| # | Hash | Tarih | Mesaj | Dokunduğu dosyalar | Klasiklerle ilgisi / main'e girmesi güvenli mi? |
|---|---|---|---|---|---|
| 1 | 0f9a1e9 | 2026-09-04 | feat(vocab): kelime anotasyon pipeline pilotu | `.gitignore`, `content/v2/vocab/st-0001,0004,0150.json`, `pipeline/vocab/{annotate.py,build-vocab.mjs,validate.py}` | İlgisi yok. Pilot vocab çıktısı CDN'e yayımlanır; app şu an okumuyor. Ama yarım bir pipeline çıktısı, ayrı karar gerekir. |
| 2 | 84242ba | 2026-09-04 | fix(vocab): D çekim kapısı + sessiz fallback kaldırma | `content/v2/vocab/*`, `pipeline/lib/gemini.mjs`, `pipeline/vocab/*` | İlgisi yok. Ortak `pipeline/lib/gemini.mjs`'i değiştiriyor (LLM rotasyonu); yayına etkisi yok, ama başka pipeline'ları etkiler. |
| 3 | c25e3f6 | 2026-09-04 | feat(vocab): Aşama D kural tabanlı TR morfoloji + senses.json dondurma | `content/v2/vocab/*`, `pipeline/vocab/*` (+ test) | İlgisi yok. `senses.json` dondurması yayın kuralına bağlı; yayına ayrı karar ister. |
| 4 | ea9eb6f | 2026-09-04 | fix(vocab): VBZ/VBP geniş zaman | `pipeline/vocab/*` | İlgisi yok. Yalnız pipeline kodu, yayına etkisi yok. |
| 5 | b57067e | 2026-09-05 | fix(vocab): stageE çözülemeyen senseId | `pipeline/vocab/build-vocab.mjs` | İlgisi yok. Yalnız pipeline kodu. |
| 6 | 7a48e49 | 2026-09-05 | feat(vocab): v2 katalog çapında tasarım | `pipeline/vocab/*` | İlgisi yok. Yalnız pipeline kodu. |
| 7 | 0025e25 | 2026-09-05 | fix(vocab): 413 ucu öldürmez; groq tek anahtar | `pipeline/lib/gemini.mjs`, `pipeline/vocab/build-vocab.mjs` | İlgisi yok. Ortak `gemini.mjs`. |
| 8 | bc53334 | 2026-09-05 | feat(vocab): kota-sonrası otomatik sürücü (auto-run.sh) | `pipeline/vocab/auto-run.sh`, `build-vocab.mjs` | İlgisi yok. auto-run.sh'de eski yol sabit (`~/Documents/AiProjects/lymia-content`). |
| 9 | 54c49b3 | 2026-09-06 | feat(quiz): Faz 3 soru bankası pipeline + pilot çıktı | `.gitignore`, `content/v2/quiz/*` (26 shard), `pipeline/quiz/*` | İlgisi yok. **Güvenli değil:** quiz bankası Tatoeba cümleleri içeriyor ve içerik güvenliği süzgecinden geçmemiş (batch-01 REPORT §7: 4+ yaşa uygun olmayan örnek). Main'e girerse CDN'de herkese açık olur. |
| 10 | 3795634 | 2026-09-13 | feat(quiz): tam koşu çıktı — 26 shard (16 698 soru) | `content/v2/quiz/*`, `pipeline/quiz/report/*` | İlgisi yok. **Güvenli değil**, aynı sebep. |
| 11 | 4b099a6 | 2026-09-15 | docs(privacy): geri bildirim formu maddesi (EN+TR) | `docs/index.html` | İlgisi yok. Gizlilik sayfası GitHub Pages'te yayında; geri bildirim formunun (1.1.3) mağazada olup olmadığına göre karar senin. |

**Karar:** Klasik PR'ı yalnız klasik commit'lerini içerecek şekilde yeniden düzenlendi.
`origin/v2-content` üzerine yeni branch **`content/classics-batch-01-clean`** açıldı, 3 klasik commit'i
cherry-pick edildi. Çakışma olmadı; klasik dosyaları eski branch'le birebir aynı. Tek fark,
vocab commit'lerine ait `pipeline/lib/gemini.mjs`. Üstüne bu turun commit'leri eklendi.

- **Hiçbir commit silinmedi.** 11 commit yerel `v2-content`'te ve eski
  `origin/content/classics-batch-01` branch'inde duruyor.
- Eski PR (mustafaksit/lymia-content#1) açık bırakıldı. Onaylarsan kapatılır; yerine yeni PR açıldı.
- 11 commit'in kendi PR'ı ayrı açılmalı. Quiz bankası içerik süzgecinden geçmeden yayına girmemeli.

## 2. Kapaklar — BEKLİYOR

`node pipeline/import-covers-v2.mjs --ids st-0273,...,st-0282` bu makinede **koşturulamadı**.
Gemini otomasyonunun çıktısında bu id'ler yok:

- `gemini-auto-create-script/output/lymia-kapak/` içinde `st-0273…st-0282` dosyası bulunmuyor
  (en yeni dosyalar st-0178, st-0167…).
- `state.json` son üretim tarihi 2026-09-29. `errors.log`'da classics01 job'u yok.
- Diskte `st-0273*` adlı başka görsel de yok (Downloads, iCloud/mdfind).

Kapaklar başka bir makinede üretildiyse `output/lymia-kapak/st-02xx.png` dosyalarını bu makinedeki
`gemini-auto-create-script/output/lymia-kapak/` klasörüne koymak yeterli; bir sonraki adımda
script'i koşturup hash adlarını, index referanslarını, yerel sunucudan HTTP 200'ü ve kontak
sayfasını (`merge-check/covers-contact.png`) doğrulayacağım. Ayrıca script `--src <klasör>`
ile herhangi bir klasörden okuyabilir.

Bu yüzden 3. madde (kapak kontak sayfası ve stil kontrolü) de kapaklar gelince yapılacak.

## 3. `pipeline/classics/` (kalıcı)

Batch araçları `qa/classics-batch-01/tools/` altından `pipeline/classics/` altına taşındı.
Artık `CLASSICS_BATCH=qa/classics-batch-NN` ile her batch'te çalışıyorlar ve batch-01'de doğrulandı
(`audio-check` 50/50, `gates`, `index-add`). Faz 2'de doğrudan kullanılacak dosyalar:

- `README.md`: kurulum, 10 adımlı akış, kapı tablosu.
- `WRITER-BRIEF.md`: batch-01'de öğrenilen kurallarla güncellendi (konuşmacı belirsizliği, seviyeler
  arası çelişki, kaynakta olmayan ayrıntı, quiz dayanağı, göndermesiz ifade, rakam, ardışık tırnak).
- `REVIEWER-PROMPT.md`: kör inceleme şablonu. "Okurun gerçekten takılacağı somut sorun" ölçütü
  ilk turdan itibaren kullanılacak.
- `copyright-terms.json`: tek liste, her batch'te genişletilecek.

## 4. Uygulama: StoryCard kapak hatası (lymia-app)

**Branch ve 1.2 notu:** `1.2` adında bir branch yok. 1.2 işi (Sentry) `main`'de olduğu için fix
`origin/main`'den açılan `fix/1.2-story-card-cover-recycling` branch'inde. Main'e merge edilmedi.

**Değişiklik (`src/components/StoryCard.tsx`):**
- `expo-image`'a `recyclingKey={coverKey}` eklendi (çağıranlar `coverKey={story.id}` geçiyor:
  `Shelf.tsx`, `library.tsx` ×2).
- `onError` olunca görsel o anahtar için gizleniyor ve alttaki kitap ikonu placeholder görünüyor.
- Hata durumu anahtara bağlı tutuluyor. Böylece hücre başka hikayeye geçince eski hata yeni kapağı
  gizlemiyor.
- `tsc --noEmit` temiz, jest 139/139.

**Test (iOS 18.5 iPhone 16 Pro sim, dev build, `EXPO_PUBLIC_CONTENT_ROOT` → yerel sunucu):**

| Kanıt | Durum | Sonuç |
|---|---|---|
| `merge-check/after-search-robin-404.png` | Hızlı kaydırmanın hemen ardından "Robin" araması (dünkü hatayı üreten aynı adım). İki kapak da 404. | İki kartta da placeholder var. Dün aynı adımda Aepyornis ve Dog kapakları görünüyordu (`screens/15-library-search-robin.png`). |
| `merge-check/after-search-old-mixed.png`, `after-search-old-scrolled.png` | Mevcut hikaye st-0001 bilerek 404 yapıldı (index'te kapak yolu hiç yüklenmemiş bir hash'e çevrildi; test sonrası geri alındı). | st-0001 ve Robin Hood placeholder gösteriyor; aynı listedeki Tin Soldier, Goldilocks ve Golden Eggs kendi kapaklarını gösteriyor. |
| `merge-check/fastscroll.mp4` + `fastscroll-frames.png` (30 kare, 3 fps) | Tam liste, 8 hızlı fırlatma. | 404'lü The Pied Piper kartı kaydırma boyunca placeholder ("Yeni" rozetiyle). Başka hiçbir kartta başka hikayenin kapağı görünmüyor. |

**Mevcut 200'de kapak eşleşmesi (örneklem):** ekranlarda görünen 18 kapaklı kartın 18'i de başlığıyla
eşleşiyor: Beryl Coronet, Thumbelina, Fir Tree, Gingerbread Man, Wednesday Poem, Midnight Library Key,
Steadfast Tin Soldier, Goldilocks, Goose That Laid the Golden Eggs, Man with the Twisted Lip,
Musgrave Ritual, Remarkable Rocket, How the Whale Got His Throat, Three Little Pigs, Mother Holle,
Blue Jackal, Fox and the Grapes, Milkmaid and Her Pail.

Not: Testte önce st-0001'in webp dosyası gizlendi, ama expo-image disk önbelleği dünkü kopyayı
gösterdi. Önbellek silmek yerine (güvenlik kontrolü) kapak yolunu yeni bir hash'e çevirerek
gerçek bir 404 üretildi. Kapak hash'li adlandırmanın amacı da tam olarak bu önbellek davranışı.

## 5. Faz 2 için önerilen 40 hikaye (onayını bekliyor)

Kriterler:
- **Çakışma yok:** mevcut 210 başlık ve özete karşı tarandı. Tek çakışan aday olan Verne'in
  *From the Earth to the Moon*'u (≈ *The First Men in the Moon*) listeden çıkarıldı.
- **Tarih:** hepsi 1929 öncesi yayımlandı.
- **Telif:** yazarı 1955 öncesi ölmüş (yaşam+70 olan ülkelerde de kamu malı) ya da anonim.
- **Tür:** katalog türlerine göre dağıtıldı.

| # | Tür | Hikaye (bölüm) | Kaynak, yazar | Yıl | Telif / risk notu |
|---|---|---|---|---|---|
| 1 | adventure | The Three Musketeers — the Queen's diamond studs | Les Trois Mousquetaires, A. Dumas | 1844 | PD. Film/Disney isimleri listeye eklenecek |
| 2 | adventure | The Count of Monte Cristo — escape from the Château d'If | A. Dumas | 1844 | PD. İntikam kısmı dışarıda |
| 3 | adventure | Kidnapped — flight through the heather | R. L. Stevenson | 1886 | PD |
| 4 | adventure | The Call of the Wild | Jack London (ö. 1916) | 1903 | 20. yy ama 1929 öncesi; her yerde PD |
| 5 | adventure | Moby-Dick — the chase of the white whale | H. Melville | 1851 | PD; "How the Whale…" ile ilgisiz |
| 6 | adventure | Odysseus and the Cyclops | Homer, Odyssey IX (Butler çev. 1900 referans) | MÖ 8. yy | PD |
| 7 | adventure | Jason and the Golden Fleece | C. Kingsley, The Heroes | 1856 | PD |
| 8 | adventure | Arthur and the Sword in the Stone | T. Malory, Le Morte d'Arthur | 1485 | PD. Disney 1963 filmine özgü öğeler (Merlin'in baykuşu Archimedes vb.) yasak |
| 9 | mystery | The Hound of the Baskervilles | A. Conan Doyle (ö. 1930) | 1902 | PD |
| 10 | mystery | The Adventure of the Speckled Band | A. Conan Doyle | 1892 | PD; mevcut Holmes'larla çakışmıyor |
| 11 | mystery | The Purloined Letter | E. A. Poe | 1844 | PD |
| 12 | mystery | The Gold-Bug | E. A. Poe | 1843 | PD. Kaynaktaki ırksal karikatür (Jupiter) yumuşatılmalı |
| 13 | mystery | The Blue Cross (Father Brown) | G. K. Chesterton (ö. 1936) | 1910 | PD (AB 2007, ABD 1929 öncesi) |
| 14 | horror | The Canterville Ghost | O. Wilde | 1887 | PD; komik hayalet |
| 15 | horror | The Strange Case of Dr Jekyll and Mr Hyde | R. L. Stevenson | 1886 | PD; A1–A2'de ton yumuşatılır |
| 16 | horror | Frankenstein — the creature's story | M. Shelley | 1818 | PD. Universal 1931 görünümü (cıvatalar, yassı kafa) kapakta yasak |
| 17 | horror | The Monkey's Paw | W. W. Jacobs (ö. 1943) | 1902 | PD (AB 2014) |
| 18 | horror | Dracula — Jonathan Harker at the castle | B. Stoker | 1897 | PD. Film tiplemesi (pelerin yakası vb.) yasak |
| 19 | romance | Pride and Prejudice — Elizabeth and Mr Darcy | J. Austen | 1813 | PD |
| 20 | romance | Jane Eyre — Thornfield | C. Brontë | 1847 | PD |
| 21 | romance | Romeo and Juliet | W. Shakespeare (Lamb, Tales 1807) | 1597 | PD; trajik son korunur |
| 22 | romance | Cyrano de Bergerac — the balcony | E. Rostand (ö. 1918) | 1897 | PD |
| 23 | daily | Little Women — a Christmas without presents | L. M. Alcott | 1868 | PD |
| 24 | daily | Oliver Twist — "Please, sir, I want some more" | C. Dickens | 1838 | PD. Fagin'in kaynaktaki antisemitik tasviri kullanılmaz |
| 25 | daily | The Prince and the Pauper | M. Twain | 1881 | PD |
| 26 | daily | Black Beauty | A. Sewell | 1877 | PD |
| 27 | daily | Anne of Green Gables — Anne arrives | L. M. Montgomery (ö. 1942) | 1908 | PD (Kanada, AB 2013, ABD). "Anne with an E" dizisine özgü öğeler yasak |
| 28 | daily | The Necklace | G. de Maupassant | 1884 | PD |
| 29 | scifi | The Invisible Man | H. G. Wells (ö. 1946) | 1897 | PD (AB 2017, ABD) |
| 30 | scifi | The War of the Worlds | H. G. Wells | 1898 | PD |
| 31 | scifi | The Lost World | A. Conan Doyle | 1912 | PD |
| 32 | scifi | Five Weeks in a Balloon | J. Verne | 1863 | PD; mevcut Verne epizodlarıyla çakışmıyor |
| 33 | classic | King Midas and the Golden Touch | N. Hawthorne, A Wonder-Book | 1852 | PD |
| 34 | classic | Pandora's Box | N. Hawthorne, A Wonder-Book | 1852 | PD |
| 35 | classic | Theseus and the Minotaur | C. Kingsley, The Heroes | 1856 | PD |
| 36 | classic | The Brave Little Tailor | Grimm, KHM 20 | 1812 | PD; Mickey 1938 kısa filmi öğeleri yasak |
| 37 | classic | The Golden Goose | Grimm, KHM 64 | 1812 | PD; "Goose That Laid…" fablıyla farklı olay |
| 38 | classic | The Nutcracker and the Mouse King | E. T. A. Hoffmann | 1816 | PD. Bale/Disney/Barbie öğeleri yasak |
| 39 | classic | The Little Match Girl | H. C. Andersen | 1845 | PD; orijinal son korunur |
| 40 | classic | The Monkey King Makes Havoc in Heaven | Wu Cheng'en, Journey to the West | 1592 | PD. Dragon Ball ve diğer uyarlama öğeleri yasak |

Yedekler: Perseus and Medusa (Kingsley 1856), The Tinderbox (Andersen 1835), The Ballad of Mulan
(MS 6. yy; Disney öğeleri yasak), White Fang (London 1906), The Wolf and the Seven Young Kids (Grimm 1812).

Tür dağılımı: adventure 8, mystery 5, horror 5, romance 4, daily 6, scifi 4, classic 8.
Bölgeler: Avrupa ağırlıklı; Çin ve Antik Yunan da var.

## 6. PR'lar

- Content: `content/classics-batch-01-clean` → `v2-content` (yeni PR). Kapaklar gelince aynı branch'e eklenecek.
- App: `fix/1.2-story-card-cover-recycling` → `main` (yeni PR).
- Yapılmayanlar: main'e merge, contentVersion bump, CDN purge.
