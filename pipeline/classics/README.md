# Klasik hikaye batch'leri (pipeline/classics)

Public-domain klasiklerin 5 seviyeli (A1–C1) yeniden anlatimlari icin uretim + kalite
akisi. Batch-01'de (st-0273..st-0282, rapor `qa/classics-batch-01/REPORT.md`) kuruldu.
Metinler ajanlar tarafindan yazilir; bu klasordeki araclar LLM kullanmaz (LanguageTool,
wordfreq, uygulamanin zod semasi, D1–D5 dedektorleri yereldir).

## Dosyalar

| Dosya | Is |
|---|---|
| `WRITER-BRIEF.md` | Yazar brifi: kurallar, seviye tablosu, JSON semasi, batch-01 dersleri |
| `REVIEWER-PROMPT.md` | Kor inceleme ajan prompt sablonu |
| `copyright-terms.json` | Film/cizgi film/muzikal versiyonlarina ozgu yasak isim/ifade listesi (her batch'te genislet) |
| `gates.py` (+ `gate-node.mjs`) | Kapilar 1–4, 6, 7 → `$CLASSICS_BATCH/gates/<id>.json`, `log.jsonl` |
| `index-add.mjs` | `content/v2/index.json` girdisini ekler/gunceller; contentVersion'a dokunmaz |
| `review-input.py` | Kor inceleme girdisi (yalniz okur metni) → `$CLASSICS_BATCH/reviews/input/` |
| `shuffle-quiz.py` | Quiz siklarini deterministik karistirir, dogru cevabi korur |
| `audio-check.py` | MP3 + timing kontrolu (sure, kelime-kelime hizalama, cumle zamanlari) |
| `baseline.py` | Katalog seviye profili → `stats/baseline-v2.json` (dikkat: v2'deki TUM hikayeleri olcer) |
| `batch.py` | Ortak yollar (`CLASSICS_BATCH`) |

## Kurulum (bir kez)

```bash
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install edge-tts wordfreq language_tool_python
brew install openjdk            # LanguageTool icin Java
npm install                     # sharp (kapak ice aktarma)
```

LanguageTool'u paylasilan sunucu olarak acmak (paralel yazarlar icin; gates.py
`LT_SERVER`'a bagli, yoksa kendi gomulu sunucusunu baslatir):

```bash
cd ~/.cache/language_tool_python/LanguageTool-6.8 && \
  /opt/homebrew/opt/openjdk/bin/java -Xmx2g -cp languagetool-server.jar \
  org.languagetool.server.HTTPServer --port 8081 --allow-origin "*"
```

Not: Metro da 8081'i kullanir; LT acikken Metro'yu `--port 8082` ile baslat.

## Akis (batch basina)

1. **Aday listesi:** `qa/classics-batch-NN/` olustur; mevcut katalogla cakisma kontrolu
   (`content/v2/index.json` basliklari + ozetleri). Kullanici onayi.
2. **Kaynaklar:** `content/v2/sources.json > stories.<id>` (eser, yazar, yil, bolum, `names`,
   `keyTerms`). Yalniz 1929 oncesi; ulke bazli istisnalari kontrol et (Peter Pan/UK GOSH).
3. `qa/classics-batch-NN/batch-ids.json` = `["st-....", ...]`.
4. **Yazim:** hikaye basina bir ajan, `WRITER-BRIEF.md` ile. Ajan `index-add.mjs` + `gates.py`
   ile kapilar GECTI olana kadar duzeltir.
5. `shuffle-quiz.py` (yazarlar sik sirasini sabit birakabiliyor).
6. **Kor inceleme:** `review-input.py <tur> <ids>` → her hikaye icin taze ajan
   (`REVIEWER-PROMPT.md`). Kalan hikaye kendi yazarina geri gider. En fazla 3 yeniden yazim.
7. **Ses:** `pipeline/.venv/bin/python pipeline/generate-audio.py --story content/v2/stories/<id>.json`
   → `audio-check.py` 0 hata.
8. **Kapak:** prompt dosyasi (`{"job":"lymia-kapak","id":..,"prompt":..}`, stil soneki
   `gemini-auto-create-script/prompts_lymia-kapak_v2.json` ile ayni) → Gemini otomasyonu →
   `node pipeline/import-covers-v2.mjs --ids ...`. **Kapaksiz batch merge edilmez**
   (app'te 404 kapakli kart baska hikayenin kapagini gosterebiliyordu; lymia-app 1.2 fix'i).
9. **Uygulama testi:** lymia-app dev build, `EXPO_PUBLIC_CONTENT_ROOT=http://localhost:8787/content`,
   `python3 -m http.server 8787` repo kokunde. Ekranlar `qa/classics-batch-NN/screens/`.
10. Rapor + PR. Yayin (merge, contentVersion, purge) ayri karar.

```bash
export CLASSICS_BATCH=qa/classics-batch-02
export APP_REPO=../lymia-app
pipeline/.venv/bin/python pipeline/classics/gates.py          # batch-ids.json'daki tum id'ler
python3 pipeline/classics/audio-check.py
```

## Kapilar

| # | Kapi | Gecme kosulu |
|---|---|---|
| 1 | Sema | lymia-app `src/services/schemas.ts` (dogrudan import) + repo semasi + index girdisi |
| 2 | D1–D5 | `pipeline/lib/detectors.mjs` 0 bulgu + `audit.mjs --strict` 0 hata |
| 3 | Gramer | LanguageTool: GRAMMAR/TYPOS/CONFUSED_WORDS/CASING/PUNCTUATION… 0 (stil raporlanir) |
| 4 | Seviye profili | kelime/medyan cumle/zipf baseline [min,max]; cumle tavani; A1–A2 zipf<3.5 ≤ baseline max; yasak yapi; rakam yok; ardisik etiketsiz tirnak yok; quiz yapisi |
| 6 | Telif | `copyright-terms.json` 0 eslesme |
| 7 | Tekrar | baslik Jaccard < 0.5, ozet 3-gram < 0.2, A1 5-gram < 0.1 (mevcut katalog) |

Kapi 5 (kor inceleme) ajanla yapilir. NGSL kapsami yalniz raporlanir (bkz. batch-01 REPORT §3).
