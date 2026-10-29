# Keşif — Klasik Hikayeler batch-01

Tarih: 2026-10-29. Repo `lymia-content`, kaynak branch `v2-content` (yerel HEAD `4b099a6`,
origin'den 11 commit ileride: vocab/quiz Faz 3 pipeline'ı + gizlilik metni). Bu iş
`content/classics-batch-01` branch'inde, ayrı bir git worktree'de
(`../lymia-content-classics-01`) yapıldı; ana checkout'taki commitlenmemiş quiz
pipeline değişikliklerine dokunulmadı.

## 1. Şema (3 örnek: st-0001 A1-ağırlıklı gizem, st-0190 Aladdin klasik, st-0218 C1-uzun Holmes)

Story JSON (`content/v2/stories/st-XXXX.json`):

```
{ id: "st-NNNN", title, genre (horror|mystery|adventure|romance|scifi|daily|classic),
  summary (tek cümle), coverScene (tek cümle, kapak sahnesi),
  levels: { A1|A2|B1|B2|C1: {
      paragraphs: [ { sentences: [ { text, audioStart, audioEnd } ] } ],
      audio: "audio/<lvl>/<id>.mp3",
      wordTimings: "audio/<lvl>/<id>.timings.json",
      quiz: [ { q, options: [3 adet], answer: 0..2 } ]   // seviye başına tam 3 soru
  } } }
```

- **5 seviye anahtarı:** `A1, A2, B1, B2, C1`. Uygulamanın zod şeması (`lymia-app/src/services/schemas.ts`)
  bilinmeyen seviye anahtarlarını reddetmez, yok sayar (tolerant). Bilinmeyen üst-düzey alanlar da
  zod `object` varsayılanıyla atılır (hata değil).
- **Quiz:** seviye başına 3 çoktan seçmeli soru, 3 şık, `answer` indeks. Mevcut katalogda cevap
  dağılımı dengesiz (A1: 0→341, 1→214, 2→45) — yeni içerikte karıştırıldı.
- Ayrı bir kelime-quiz bankası da var (`content/v2/quiz/{a..z}.json`, `lemma|POS` anahtarlı cloze
  soruları, Faz 3 pipeline `pipeline/quiz/`); hikaye-sonu quiz'den bağımsız, uygulama bu build'de
  okumuyor.
- **Ses/timing ilişkisi:** ses v2'ye kopyalanmaz, ortak `content/audio/<lvl>/<id>.mp3` +
  `<id>.timings.json` (`[{word,start,end}]`, saniye). `pipeline/generate-audio.py` (edge-tts,
  `en-US-JennyNeural`, A1/A2 `-10%` hız) MP3 + WordBoundary zamanlamalarını üretir ve cümlelerin
  `audioStart/audioEnd` alanlarını kelime sayısına göre (`[A-Za-z][A-Za-z']*`) doldurur. Uygulama
  sesi `AUDIO_CDN_BASE/<lvl>/<id>.mp3`'ten indirir, karaoke'yi timings ile yapar.
- **Katalog** (`content/v2/index.json`): `schemaVersion 1, contentVersion 25, adConfig, stories[200]`;
  girdi: `id, slug, title, summary, genre, levels[], wordCount{}, minutes{} (wc/128), cover, isNew, order`.
- **Kapak hash adlandırma:** `content/v2/covers/<id>-<sha256(webp)[0:8]>.webp`, katalogda
  `cover: "covers/<id>-<hash8>.webp"` (v2 köküne göre, `?v=` yok). Hash içerik değişince değişir →
  jsDelivr/expo-image cache sorunu yok. Üreten: `pipeline/build-v2.mjs`.

## 2. Baseline (mevcut 200, `stats/baseline-v2.json`)

Hikaye başına değerlerin dağılımı (medyan / min / max):

| Seviye | Kelime | Medyan cümle | Zipf medyanı | zipf<3.5 oranı |
|---|---|---|---|---|
| A1 | 233 / 124 / 385 | 6 / 4 / 8 | 5.96 / 5.46 / 6.37 | 0 / 0 / 0.037 |
| A2 | 323 / 157 / 590 | 7 / 5 / 11 | 5.88 / 5.62 / 6.33 | 0 / 0 / 0.033 |
| B1 | 567 / 159 / 975 | 10 / 5 / 17 | 5.89 / 5.52 / 6.27 | 0 / 0 / 0.017 |
| B2 | 864 / 165 / 1379 | 13 / 4 / 21 | 5.82 / 5.49 / 6.33 | 0.003 / 0 / 0.024 |
| C1 | 1127 / 1000 / 1688 | 21 / 16 / 123* | 5.33 / 4.95 / 6.26 | 0.087 / 0.009 / 0.152 |

\* C1 max 123: noktalaması bozuk tek bir hikaye (cümle bölünmemiş). Repo kuralı C1 cümle tavanı 32.

Repo seviye kuralları (`pipeline/lib/levels.mjs`): cümle tavanı A1 8 / A2 12 / B1 16 / B2 22 / C1 32,
uzunluk bandı A1 250-400 … C1 1000-1700 (mutlak tavan B2 1200, C1 2400), NGSL kapsamı ≥ %95 (C1 %90).
Yöntem: `qa/classics-batch-01/tools/baseline.py` (özel isimler zipf hesabından hariç).

Gözlem: mevcut klasik yeniden anlatımların kalitesi düşük (st-0190 A1: "the old fire source",
C1: son 4 paragraf ahlak dersi dolgusu). Yeni batch baseline uzunluk aralığında kalıp bu dolguyu yapmaz.

## 3. Seri (bölümlü) format desteği

**Yok.** Şemada `series/part/episode` alanı yok; uygulama tipleri (`CatalogStory`, `Story`) ve
zod şeması da tanımlamıyor. Mevcut katalog romanları başlığa "(tek epizod)" ekleyerek tek hikaye
yapmış (Treasure Island, Heidi, The Secret Garden…). Bu turda kullanılmadı; öneri REPORT.md'de.

## 4. D1-D5 dedektörleri ve yayın akışı

- **D1-D5:** `pipeline/quality-diagnosis.mjs` (2026-09 kalite teşhisi). D1 birebir çeviri/anlam
  kalıpları, D2 eksik fiil çekimi (bare "be", 3. tekil -s, `pipeline/lib/agreement.mjs`), D3 B1'de
  zorla şart cümlesi (if+will), D4 cümle/paragraf tekrarı, D5 kesik metin (terminal noktalama yok).
  Bu iş kuralları `pipeline/lib/detectors.mjs`'e çıkardı (quality-diagnosis.mjs artık oradan import
  eder; A1-B2 çıktısı birebir aynı). Not: quality-diagnosis v1 `content/stories`'i tarar (C1 strip'li);
  kapılar v2 dosyalarını tarar.
- **audit:** `pipeline/audit.mjs --strict` (şema, içerik güvenliği tier1, özne-yüklem uyumu, başlık
  çakışması, coverScene lint, uzunluk tavanı) — CI'da (`.github/workflows/content-audit.yml`).
- **C1-strip:** `pipeline/lib/publish-filter.mjs > stripUnpublishedLevels` — v1 `content/stories`'ten
  C1'i atar (build 9 uyumu için), `build-index.mjs` başında çağrılır. v2'yi `pipeline/build-v2.mjs`
  üretir (5 seviye, `V2_SOURCE_COMMIT` = C1-strip öncesi commit'ten) — **yeni hikayeler için
  build-v2 kullanılmamalı** (v1 dosyasını kaynak alır); bu batch doğrudan v2'ye yazıldı ve katalog
  girdisi `qa/classics-batch-01/tools/index-add.mjs` ile eklendi (contentVersion değişmedi).
- **jsDelivr purge:** script yok; README'de manuel URL:
  `https://purge.jsdelivr.net/gh/mustafaksit/lymia-content@main/content/...`. Uygulama
  `@main` okur → bu branch'teki hiçbir şey merge edilmeden kullanıcıya gitmez.
- Kapak üretimi: `pipeline/import-covers.mjs` v1 yoluna (`content/covers/<id>.webp`) yazıyor; v2 için
  yeni `pipeline/import-covers-v2.mjs` eklendi (hash'li ad + index bağlama).

## 5. Mevcut 200 hikaye listesi

Başlık + tek cümle özet: `qa/classics-batch-01/existing-200.txt` (id | tür | başlık | özet).

**Aday listesiyle çakışma** (başlık/olay örgüsü mevcut):
Alice (st-0012), Oz (st-0015), Kızıl Saçlılar Kulübü (st-0126), Tom Sawyer (st-0013),
Alaaddin (st-0190), Çirkin Ördek Yavrusu (st-0152), Noel Şarkısı (st-0014), 80 Günde Devr-i Alem
(st-0147); yedeklerden Define Adası (st-0237), Mutlu Prens (st-0008), Külkedisi (st-0176),
Kırmızı Başlıklı Kız (st-0168), Heidi (st-0234). Boşta kalan: Peter Pan, Pinokyo, Robin Hood,
Mowgli, Gulliver. Kullanıcı kararı (2026-10-29): Peter Pan çıkar (1911 + UK GOSH istisnası);
eksikler: Kar Kraliçesi, Don Kişot, Robinson Crusoe, Küçük Deniz Kızı, Fareli Köylü, Rumpelstiltskin.

## 6. Araçlar ve ortam

- LanguageTool 6.8 yerel (language_tool_python + Homebrew OpenJDK, paylaşılan HTTP sunucu :8081).
- wordfreq 3.1, edge-tts 7.3 (`pipeline/.venv`, Python 3.14).
- Uygulama: `lymia-app` dev build, iOS 18.5 iPhone 16 Pro simülatörü; içerik yerel HTTP sunucudan
  (`EXPO_PUBLIC_CONTENT_ROOT`, yalnız `__DEV__`).
