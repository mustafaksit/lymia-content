# Yazar brifi — Klasik Hikayeler (Faz 2+)

Bu dosya her hikaye yazarinin (insan ya da ajan) tek referansidir. Batch-01'de
(qa/classics-batch-01) kullanilan brifin, kor incelemelerden ogrenilen kurallarla
guncellenmis halidir. Koordinator ajan prompt'unda repo kokunu, batch klasorunu
(`CLASSICS_BATCH=qa/classics-batch-NN`) ve hikaye id'sini verir. Yazar commit/push ATMAZ.

## Gorev

Atanan hikayeyi (id, eser, bolum: `content/v2/sources.json`) **kendi cumlelerinle**
5 seviyede (A1, A2, B1, B2, C1) yeniden anlat ve `content/v2/stories/<id>.json`
olarak yaz. Sonra otomatik kapilari gecene kadar duzelt.

Yasaklar:
- Hicbir ceviriden veya orijinal metinden cumle kopyalama. Unlu replikleri bile
  kendi ifadenle yaz.
- Film/cizgi film/muzikal versiyonlarina ozgu karakter, isim, sarki, replik, sahne,
  gorunum YOK. Liste: `pipeline/classics/copyright-terms.json` (ornegin "Anna",
  "Wilson", "Blue Fairy", "Happily ever after" de yasak). Kaynak eserde olmayan bir
  ogeyi eklemeden once dur.
- Ozel isim olarak YALNIZ `sources.json > names` listesindekileri kullan. Diger
  karakterleri tanimla ("the old miller", "the sea witch"). Liste yetmiyorsa isim
  uydurma; tanimla.
- Diger dosyalara dokunma (index.json'u yalniz `pipeline/classics/index-add.mjs` gunceller).

## Sadakat

- Olay orgusu `content/v2/sources.json > stories.<id>.episode` alanindaki kaynak bolumu izler. Ana olaylar,
  sira ve SON kaynaktaki gibidir (Andersen sonlari degismez: Kucuk Deniz Kizi mutlu
  bitmez; Fareli Koylu'de cocuklar geri donmez; Rumpelstiltskin 1812 metnindeki gibi
  ofkeyle kacar).
- A1'de ana karakterler ve ana olay korunur; yan karakterler atilabilir. Ust seviyeler
  daha fazla ayrinti/yan karakter tasir, ama hepsi AYNI hikaye.
- Romanlarda tek, kapali bir hikaye: baslangic-gelisme-sonuc tam; "devami var"
  hissi yok.
- Cocuk dostu (4+): siddet ima edilebilir, ayrintilanmaz. Swift'in sarayda yangin
  sondurme sahnesi yok. Robinson'da Friday "servant/master" degil, kurtarilan arkadas
  ve yoldastir; "cannibal/savage" kelimeleri yok (B2+ "men who meant to kill their
  prisoner" duzeyinde kalabilir).

## 4+ yas uygunlugu (App Store 4+ — ZORUNLU)

Uygulama 4+ derecelendirmede. Her hikaye, her seviyede:
- Kan, yara, sakatlik ayrintisi YOK. Olum olay geregi varsa sakin ve kisa ("he died that
  night", "she went with her grandmother"); nasil oldugu betimlenmez.
- Siddet: kavga/duello/savas ancak sonucu soylenerek ("he won the fight"); vurma, kesme,
  bogma, yakma betimi yok. Cinayet ayrintisi yok; suc gerekiyorsa "a wicked deed" duzeyinde.
- Cinsellik ve cinsel ima yok; romantizm el tutma/teklif/evlilik duzeyinde.
- Korkutma: gerilim ve gizem serbest, dehset/iğrençlik yok. Hayaletler, devler, buyuculer
  korkutucu degil masalsi.
- Alkol, uyusturucu, intihar, istismar yok. Irksal/etnik karikatur yok (kaynakta olsa bile).
- `sources.json > stories.<id>.fourPlus` notundaki yumusatmalar BAGLAYICIDIR.

## Seviye kurallari

| | Kelime (hedef) | Cumle tavani | Medyan cumle | Paragraf |
|---|---|---|---|---|
| A1 | 250-330 | 8 kelime | 5-7 | 6-9 |
| A2 | 400-520 | 12 kelime | 7-9 | 7-10 |
| B1 | 620-820 | 16 kelime | 10-12 | 8-11 |
| B2 | 950-1150 | 22 kelime | 13-16 | 9-13 |
| C1 | 1250-1550 | 32 kelime | 18-24 | 10-14 |

Kelime sayimi: `[A-Za-z][A-Za-z']*` token sayisi (tireli kelime 2 sayilir).

Dil bilgisi:
- **A1/A2:** yalniz genis zaman (present simple) ve basit gecmis (past simple). Anlati
  past simple, konusmalar present simple olabilir. `can / can't / could / must` serbest.
  YASAK: `if`, `unless`, `will`, `would`, `shall`, `'ll`, relative clause (`who`
  yalniz soru cumlesinde; `which/whose/whom` hic), `that`-clause ("said that he..."),
  edilgen cati, perfect zamanlar (`has/had + V3`), surekli zamanlar (`was running`,
  `is going to`). Baglaclar: and, but, because, so (+ then, when ile zaman bildirmek
  olur: "When the sun came up, ..." A2'de serbest, A1'de kacin).
- **B1:** + past continuous, `will`, basit relative clause (who/which/that).
  YASAK: kosul cumlesi (`if/unless`; "asked if" = whether serbest), edilgen cati.
- **B2:** + kosul, edilgen, reported speech, past perfect serbest.
- **C1:** edebi dil, ironi/kinaye, serbest dolayli anlatim, cesitli cumle yapilari
  (inversion, cleft, participle clause). Sisirme YOK: sona "ve boylece ogrendiler ki..."
  turu ahlak dersi/tekrar paragraflari eklenmez. C1 uzunlugu ayrinti ve sahneyle gelir.
- A1/A2'de nadir kelime (wordfreq zipf < 3.5) orani cok dusuk olmali (<= %3).
  `sources.json > keyTerms` icindeki cekirdek kelimeler ozel isim gibi sayilir; geri
  kalan nadir kelimelerden kacin (A1'de "lance", "squire", "sledge" yok).

Dogallik: anadili Ingilizce bir cocuk kitabi yazarinin metni. "Ogretici kalip" yok
("This is a cat. The cat is big."), her cumleyi ayni ozneyle baslatma, "One day"
tekrari yok, ayni cumleyi tekrarlama (25+ karakterlik cumle iki kez gecerse D4 kapisi
duser). Her cumle nokta/unlem/soru isaretiyle biter (tirnak sonra gelebilir).

## JSON semasi (mevcut katalogla birebir)

```json
{
  "id": "st-0273",
  "title": "Pinocchio",
  "genre": "classic",
  "summary": "A wooden puppet who cannot stop telling lies sets out to become a real boy.",
  "coverScene": "An old woodcarver in a small workshop smiles at a wooden puppet that has just come to life.",
  "levels": {
    "A1": {
      "paragraphs": [
        { "sentences": [
          { "text": "An old man lived in a small house.", "audioStart": 0, "audioEnd": 0 },
          { "text": "\"Who are you?\" he asked.", "audioStart": 0, "audioEnd": 0 }
        ] }
      ],
      "audio": "audio/a1/st-0273.mp3",
      "wordTimings": "audio/a1/st-0273.timings.json",
      "quiz": [
        { "q": "What did the old man make?", "options": ["A chair", "A puppet", "A boat"], "answer": 1 }
      ]
    },
    "A2": { "...": "ayni yapi, audio/a2/..." }
  }
}
```

- `title`: `sources.json > title` aynen.
- `genre`: `content/v2/sources.json > stories.<id>.genre` (batch-01: hepsi `"classic"`).
- `summary`: tek cumle, 10-18 kelime, genis zaman, sade ve dogal Ingilizce, sonu verme.
- `coverScene`: tek cumle, kapak sahnesi; genel tarif. Film versiyonlarini cagristiran
  kiyafet/renk/gorunum tarifi YOK (Alice icin "mavi elbise" gibi). Cekimli fiil kullan
  ("stands", "is"; "be" degil).
- Her cumle ayri nesne; `audioStart`/`audioEnd` = 0 (ses adimi doldurur).
  Diyalog ve konusma etiketi ayni nesnede: `"Help me!" she cried.`
- Duz tirnak `"` ve duz kesme `'` kullan.
- Ayni konusmacinin birden cok cumlesi: tirnagi ILK cumle nesnesinde ac, SON cumle
  nesnesinde kapat (`"No," she said.` / `"But people have a soul.` / `It lives forever."`).
  Kapanip hemen yeniden acilan etiketsiz tirnak Ingilizcede yeni konusmaci demektir
  (batch-01 kor incelemelerinin en sik bulgusu; kapi 4 artik yakalar).
- Rakam yok: yillar ve sayilar yaziyla (`sixteen ninety-nine`). TTS rakami kelime
  olarak okur ama uygulama karaokesi yalniz harfli kelimeleri sayar; vurgu kayar.
- `quiz`: her seviyede TAM 3 soru, her soruda TAM 3 sik, `answer` 0-2. Dogru cevabin
  yeri karisik olsun (hikaye genelinde 0/1/2 dagilsin). Sorular o seviyenin metninden
  cevaplanabilir, dili o seviyeye uygun, celdiriciler makul ama acikca yanlis.
  Soru `?` ile biter.

## Kapilar (otomatik) — hepsi GECTI olmadan teslim etme

```bash
export CLASSICS_BATCH=qa/classics-batch-NN
export APP_REPO=<lymia-app checkout>          # uygulamanin zod semasi buradan import edilir
node pipeline/classics/index-add.mjs <id>     # katalog girdisi (her metin degisiminden sonra)
pipeline/.venv/bin/python pipeline/classics/gates.py <id>
```

Kapilar: 1 sema (uygulama zod), 2 D1-D5 + audit --strict, 3 LanguageTool 0 hata,
4 seviye profili (kelime/cumle/zipf baseline icinde, cumle tavani, yasak yapilar, quiz),
6 telif 0 eslesme, 7 mevcut 200 ile tekrar. Ayrinti: `$CLASSICS_BATCH/gates/<id>.json`.

- LanguageTool yanlis-pozitifi gibi gorunse bile cumleyi yeniden kur (ornek: "filled
  every corner of" -> baska ifade). Kural ignore etme.
- Yasak yapi taramasi heuristiktir; yakaladigi her cumleyi seviyeye uygun yeniden yaz.
- NGSL kapsami (profil satirindaki `ngsl`) B1-C1'de uyari duzeyindedir (B1-B2 >= %95 hedefle).
- **4c cekirdek kapsam (batch-03'ten itibaren KAPI):** A1 `core` >= 0.92 (NGSL-500 + ek liste),
  A2 `core` >= 0.95 (NGSL-1000). Ozel isimler ve sources `keyTerms`'un ilk 5'i muaftir; geri
  kalan her kelime listeden olmali. Kapi kalinca hata satiri liste disi kelimeleri sayilariyla
  verir: her birini listede olan basit karsiligiyla degistir (gaze -> look, whisper -> say
  quietly, enormous -> very big). Hikayeye ozgu bir kelime gerekiyorsa once keyTerms'te mi bak.
  Dogallik yine sart: "fire source" gibi yapay ifadeye kacma, cumleyi yeniden kur.

## Teslim (son mesajin)

Kisa rapor: id, baslik, seviye basina kelime sayisi, kapi kosu sayisi (kac kez gates.py
calistirdin ve son sonuc), sadakat icin yaptigin bilincli kisaltma/yumusatmalar
(kaynaktaki hangi olay atildi/yumusatildi ve neden), kalan uyarilar (NGSL, LT stil).

## Kor incelemeden ogrenilen kurallar (batch-01, 34 inceleme)

En sik kalma sebepleri; yazarken bastan uygula:
1. **Konusmaci belirsizligi:** her tirnagin kime ait oldugu tek okumada belli olmali. A1'de
   "he said" yerine isim kullan ("said the king"); zamir onceki cumledeki baska kisiyi
   gosterebiliyorsa ismi tekrarla.
2. **Seviyeler arasi olay celiskisi yok:** ayni olay her seviyede ayni (dugun karada mi
   gemide mi, boy "parmak kadar" mi "alti inc" mi). Kisalt, ama degistirme.
3. **Kaynakta olmayan ayrinti ekleme** (Robinson'a Friday'in yemek ogretmesi gibi); emin
   degilsen cikar.
4. **Quiz anahtari o seviyenin metnine dayanmali** (soru, metinde gecmeyen bir bilgiyi
   soramaz).
5. **Gonderimsiz ifade yok:** "the room", "that street", "his boat" ancak onceden
   tanitildiysa.
6. **Rakam ve ardisik tirnak:** yukaridaki sema notlari (kapi 4 yakalar).
