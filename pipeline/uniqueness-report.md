# Benzersizlik Raporu — 200 Hikaye

Uretim tarihi taramasi: 200 hikaye tarandi (content/stories/).

## 1) Baslik Cakismasi (birebir, normalize case+bosluk)

Birebir ayni baslik **YOK**. ✅

## 2) Baslik Benzerligi (Levenshtein ratio ≥ %80)

| Skor | Hikaye A | Hikaye B |
|---|---|---|
| %89 | st-0025 — The Whispering Library Clock | st-0027 — The Whispering Library Book |
| %88 | st-0148 — The Tortoise and the Hare | st-0248 — The Tortoise and the Eagle |
| %83 | st-0247 — The Lion and the Gnat | st-0271 — The Lion and the Statue |

## 3) Icerik/Kurgu Benzerligi (B1 TF-IDF cosine ≥ %70)

Esik ustu (≥%70) benzer icerik cifti **YOK**. ✅

En yuksek 5 icerik benzerligi (esik alti, referans icin):

| Skor | Hikaye A | Hikaye B |
|---|---|---|
| %63 | st-0113 — The Music at the Market | st-0117 — Lost in the Market |
| %62 | st-0012 — Alice's Adventures in Wonderland | st-0239 — Alice: Through the Looking-Glass (epizod) |
| %60 | st-0109 — The Signal in the Dark | st-0119 — The Garden Without Soil |
| %56 | st-0028 — The Hidden Mountain Map | st-0032 — Before the Sun Goes Down |
| %56 | st-0104 — The Lost Island Quest | st-0115 — The Boat to the Far Island |

## 4) Kaynak Dagilimi

| Kaynak | Adet |
|---|---|
| Ozgun konsept | 44 |
| Public domain uyarlama | 156 |
| **Toplam** | **200** |

**Notlar:**

- Story JSON'larinda `source` alani yok; siniflama baslik eslesmesiyle yapildi.

- Ozgun = erken v1 katalog ozgun konseptleri. `v2-originals.json` (24 ozgun aday) basliklarindan HICBIRI uretilmemis — kuyrugun sonundaydilar, hedefe onlardan once ulasildi.

- PD uyarlama = v2-classics + v2-remaining-pd + v2-batch1-fables + faz2 listesi eslesenleri, ARTI erken v1 katalogundaki 6 taninmis PD tam-eser (Happy Prince, Sherlock Holmes, Alice, Tom Sawyer, A Christmas Carol, Wizard of Oz).

