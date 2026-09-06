# Quiz soru bankası pipeline (Faz 3)

Her `lemma|pos` için **anlamı ölçen**, tek doğru cevaplı, 4 şıklı cümle-boşluk
(cloze) soruları üretir. Amaç kullanıcının kelimenin **anlamını** bildiğini
ölçmek; hikaye cümlesini ezberlemesini değil. Bir soru "insanın çözebileceği
kadar açık" olmalı — bunu bir masked-LM (MLM) ile makineyle ölçeriz.

## Boru hattı

1. **`gate.py` — çözülebilirlik kapısı.** Cümledeki hedef kelime `[MASK]`'lenir,
   MLM ilk 20 tahmini üretir. Hedef (veya lemma'nın aynı etiketli çekimi) ilk
   5'te **ve** olasılığı ≥ 0.05 ise cümle geçer. Ek elemeler: uzunluk 6–22
   kelime, hedef cümlede tam bir kez geçmeli, özel isim (PROPN) oranı < %25.
   Kapı, "He secretly left the house" gibi belirsiz (MLM'nin `rarely/usually`
   dediği) cümleleri eler; "She wrapped the gift" gibi anlamı cümleden
   çıkarılabilen cümleleri geçirir.
2. **`sentences.py` — cümle kaynağı.** `lemma|pos` başına en fazla 3 geçen cümle.
   Sıra: (1) hikaye cümleleri (annot), (2) yetmezse Tatoeba (seviye-uygun,
   çekim içeren), (3) hâlâ 0 ise "LLM gerekli" listesine yazılır (bu aşamada
   **LLM çağrısı yapılmaz**).
3. **`distractors.py` — çeldirici üretimi.** Soru başına 3 çeldirici. Havuz: aynı
   POS envanteri, zipf sıklığı hedefe ±1, CEFR aynı/±1. Elenenler: aynı lemma,
   WordNet eş/hiper/hiponim, aynı kök, cümlede geçen kelimeler. MLM kontrolü: her
   çeldiricinin `[MASK]` olasılığı ≤ 0.01 **ve** hedefin onda birinden küçük
   olmalı (yani MLM için apaçık yanlış). Çeldirici hedefin yüzey etiketine göre
   çekilir (lemminflect).
4. **`build-quiz.py` — orkestrasyon + çıktı.** Doğrular ve `content/v2/quiz/`
   altına compact JSON yazar.

## Kurulum

```bash
cd pipeline/quiz
python3.11 -m venv .venv-quiz
.venv-quiz/bin/pip install transformers torch wordfreq nltk spacy lemminflect
```

Tatoeba İngilizce cümleleri (CC-BY 2.0 FR, aşağıdaki kaynak notuna bakın):

```bash
mkdir -p data
curl -L https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2 -o data/eng_sentences.tsv.bz2
bunzip2 data/eng_sentences.tsv.bz2
```

`.venv-quiz/`, `data/`, `cache/`, `.hf-cache/` git'e girmez (bkz. kök `.gitignore`).
Model (`distilbert-base-uncased`) ilk çalışmada `.hf-cache/`'e indirilir.

## Çalıştırma

```bash
.venv-quiz/bin/python build-quiz.py --pilot        # 3 pilot hikaye (varsayılan)
.venv-quiz/bin/python build-quiz.py --all          # 200 hikaye
.venv-quiz/bin/python build-quiz.py --stories st-0001,st-0004
.venv-quiz/bin/python build-quiz.py --no-tatoeba   # yalnız hikaye cümleleri
```

Rapor: `cache/quiz-report.json`. Çıktı: `content/v2/quiz/index.json` + `{ilk-harf}.json`.

## Eşikler

`common.py` içinde parametrik ve raporda tekrar yazılır:

| Eşik | Değer | Anlam |
|---|---|---|
| `GATE_TARGET_IN_TOPN` | 5 | Hedef MLM'nin ilk 5 tahmininde olmalı |
| `GATE_MIN_PROB` | 0.05 | Hedef olasılığı en az bu |
| `SENT_MIN/MAX_WORDS` | 6 / 22 | Cümle uzunluğu |
| `PROPN_MAX_RATIO` | 0.25 | Özel isim oranı üst sınırı |
| `DISTRACTOR_MAX_PROB` | 0.01 | Çeldirici `[MASK]` olasılığı üst sınırı |
| `DISTRACTOR_RATIO` | 0.10 | Çeldirici, hedef olasılığının onda birinden küçük |
| `ZIPF_WINDOW` | 1.0 | Çeldirici sıklığı hedefe ±1 zipf |
| `MAX_STORY_ATTEMPTS` | 12 | Sık lemma'larda gate çağrısı üst sınırı (hız) |

### CEFR tahmini (Oxford listesi olmadan)

Oxford 3000/5000 CEFR listesi ücretsiz/dağıtılabilir bulunamadığı için seviye,
`wordfreq` zipf sıklığından kestirilir (zipf: 7 ≈ "the" çok sık, 1 çok nadir):

| Seviye | zipf eşiği |
|---|---|
| A1 | ≥ 5.5 |
| A2 | ≥ 4.8 |
| B1 | ≥ 4.0 |
| B2 | ≥ 3.2 |
| C1 | < 3.2 |

Hikaye cümlelerinde seviye hikayenin kendi CEFR seviyesidir; Tatoeba
cümlelerinde bu zipf tahmini kullanılır.

## Kaynak / lisans notu

Cümle kaynağı olarak **Tatoeba** (https://tatoeba.org) İngilizce cümleleri
kullanılır. Tatoeba cümleleri **CC-BY 2.0 FR** lisansıyla dağıtılır. Yayınlanan
her Tatoeba kaynaklı soru `source: {type:"tatoeba", id:<cümle id>}` ile o cümleye
atıf verir; uygulama/depo künyesinde Tatoeba'ya atıf yapılmalıdır.
Model: `distilbert-base-uncased` (Apache-2.0).
