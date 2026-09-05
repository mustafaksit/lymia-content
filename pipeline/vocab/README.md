# Vocab Pipeline (kelime anotasyonu)

Her hikayenin her seviyesindeki her kelime için lemma, POS, çekim etiketi ve
bağlama göre Türkçe karşılık üretir. Çıktı: `content/v2/vocab/senses.json` +
`content/v2/vocab/{storyId}.json`. `content/` ve `content/v2/stories` YALNIZ okunur.

## Aşamalar

| Aşama | Dosya | LLM? | İş |
|---|---|---|---|
| A envanter | `annotate.py` + `build-vocab.mjs inventory` | Hayır | spaCy tokenizasyon + lemma/POS/tag + dep/aux; lemma\|pos geçiş envanteri |
| B anlam envanteri | `build-vocab.mjs` | Evet | lemma\|pos başına <=8 temsili cümle → farklı anlamlar (20 lemma/istek) |
| C sınıflandırma | `build-vocab.mjs` | Evet | tek anlamlı→otomatik; çok anlamlı→geçişler 40'lık paket, anlam no |
| D çekim | `tr-morph.mjs` | **Hayır (KURAL)** | ünlü uyumu + ek kuralları ile Türkçe çekim |
| E dosya | `build-vocab.mjs` | Hayır | senses.json + {storyId}.json (compact) |

LLM için mevcut ücretsiz rotasyon (`../lib/gemini.mjs`, Gemini öncelikli). **Ücretli API yok.**

## Aşama D neden kural tabanlı

Ücretsiz LLM'ler Türkçe çekimi güvenilir üretemedi (pilotta 571 çiftin ~%4'ü).
Türkçe çekim yüksek düzenli olduğundan `tr-morph.mjs` deterministik üretir:
NNS `-lar/-ler`, JJR `daha +`, JJS `en +`, VBD/VBN/VBG/VBZ fiil ekleri
(dörtlü ünlü uyumu, sert ünsüz, yumuşama, spaCy dep/aux bağlamı). Birim test:
`node tr-morph.test.mjs`.

## SÜREÇ KURALI — DONDURMA YALNIZ YAYINDAN SONRA

`senses.json` CDN'e **yayınlandıktan sonra** dondurulur (istemcinin token→senseIdx
eşlemeleri sürümler arası kararlı kalsın). Yayın **öncesi** tam yeniden kurulum serbesttir.

Kapı: **`PUBLISHED_VERSION` env değişkeni**.

- `PUBLISHED_VERSION` **tanımlı DEĞİLSE** (yayın öncesi, varsayılan): `loadFrozenSenses`
  devreye girmez, tüm lemma\|pos için Aşama B baştan çalışır. Katalog çapında temiz
  kurulum bu moddadır.
- `PUBLISHED_VERSION` **tanımlıysa** (yayından sonra): var olan lemma\|pos için B
  yeniden çağrılmaz, anlamlar `senses.json`'dan yüklenir; yalnız **yeni lemma** veya
  **0 dönen token** için ek-tur B çalışır ve yeni anlamları **mevcut listeye EKLER**
  (`{lemma}|{pos}|{n}`). **Var olan senseId asla silinmez/yeniden numaralanmaz**;
  koşuda referans edilmeyen dondurulmuş anlamlar bile çıktı senses.json'da korunur.

Temiz baseline için `content/v2/vocab/senses.json` (ve gerekiyorsa `{storyId}.json`)
`pipeline/vocab/archive/` altına taşınır; `cache/stage-B` temsili-cümle bağımlı olduğu
için `MAX_REPRESENTATIVE` değişince eski girdiler zaten eşleşmez.

## Çalıştırma

```bash
# venv (python3.11; 3.14'te spaCy wheel yok)
pipeline/vocab/.venv-vocab/bin/python -m spacy download en_core_web_sm   # ilk kez

# Aşama A: tüm hikayeleri anote et (dep/aux dahil)
pipeline/vocab/.venv-vocab/bin/python pipeline/vocab/annotate.py --all

# envanter sayıları
node pipeline/vocab/build-vocab.mjs inventory

# üretim (pilot / tümü). --probe: başlangıçta anahtar testi
node pipeline/vocab/build-vocab.mjs build --stories st-0001,st-0004,st-0150 --probe
node pipeline/vocab/build-vocab.mjs build --all

# doğrulama
pipeline/vocab/.venv-vocab/bin/python pipeline/vocab/validate.py
```

`cache/` ve `.venv-vocab/` git'e girmez (bkz. kök `.gitignore`).
