# Katalog Saglik Raporu

Uretim: `node pipeline/health-check.mjs` (salt-okunur). Gramer = yuksek-hassasiyetli uyum detektoru (agreement.mjs).

```
id       | yayin | sev | ozet | kapak | ses | timing | quiz | gramer
---------|-------|-----|------|-------|-----|--------|------|-------
st-0001 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0002 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 5 hata
st-0003 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0004 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0005 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0006 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0007 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 4 hata
st-0008 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0011 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0012 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 8 hata
st-0013 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0014 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 3 hata
st-0015 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0016 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 4 hata
st-0017 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0018 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0019 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0020 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0021 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0023 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0024 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0025 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0027 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0028 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0032 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0033 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0040 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0042 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0047 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0049 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0052 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0060 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 3 hata
st-0070 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0080 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0084 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0088 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0091 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0092 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 4 hata
st-0097 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0098 | LIVE  | 5/5 | ok | ok | ok | ok | ok | temiz
st-0102 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 4 hata
st-0104 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0106 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 8 hata
st-0109 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 10 hata
st-0113 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 15 hata
st-0115 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 17 hata
st-0117 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 12 hata
st-0119 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 1 hata
st-0120 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 2 hata
st-0121 | LIVE  | 5/5 | ok | ok | ok | ok | ok | 3 hata
st-0122 | yeni  | 5/5 | ok | EKSIK | ok | ok | ok | 15 hata
st-0123 | yeni  | 5/5 | ok | EKSIK | ok | ok | ok | 85 hata
st-0124 | yeni  | 5/5 | ok | EKSIK | ok | ok | ok | 34 hata
st-0125 | yeni  | 5/5 | ok | EKSIK | ok | ok | ok | 19 hata
st-0126 | yeni  | 5/5 | ok | EKSIK | ok | ok | ok | 36 hata

=== OZET ===
Toplam 55 hikaye (50 yayinda, 5 yeni)
Tam saglam (5 seviye + ozet + kapak + ses + timing + quiz + gramer temiz): 18/55
Yayindaki 50: gramer hatasi olan 32, kapagi eksik 0
Toplam gramer uyum hatasi (tum katalog): 316
```
