# Kapak stili: Lymia Sunny Storybook (Güneşli Masal)

> Kalıcı kapak görsel dili. Kasım 2026'dan itibaren üretilen tüm hikaye kapakları bu stille yapılır.
> Kısa adı **LSS** (Lymia Sunny Storybook). Promptta ya da notta "LSS stili" denince bu dosya kastedilir.

## Ne zaman ve neden

- Yayındaki 200 kapaktan 20'si incelenip ortak dil çıkarıldı (st-0122 sonrası set).
- İlk ChatGPT denemesinde "highly detailed / fine ink linework" ifadeleri kullanıldı. Sonuç gravür gibi
  taramalı çıktı ve uygulamadaki kapaklarla uyuşmadı.
- Stil bloğu "temiz karikatür, net kontur, orta detay" olarak yeniden yazıldı. st-0273–0277 bu stille
  üretildi ve onaylandı ("Bu görsel dili daha iyi").

## Stilin özü

| Unsur | Kural |
|---|---|
| Çizgi | Her şeklin etrafında düzgün, eşit kalınlıkta koyu kahve kontur. Tarama ve gravür çizgisi yok |
| Form | Sade, yuvarlak formlar. Gerçekçi kırışık ve yaşlı cilt dokusu yok |
| Boya | Guaj benzeri pürüzsüz dolgu. Gölge yumuşak ve basit, parlama hafif |
| Renk | Parlak, doygun, güneşli renkler. Sepya ve soluk vintage ton yok |
| Karakter | Sevimli ve dostça. Büyük ifadeli gözler, yuvarlak yüz, pembe yanak |
| Detay | Orta seviye. 4–8 net hikaye nesnesi, küçük resimde bile okunur. Arka plan sade |
| Derinlik | Üç katman. Önde yaprak, çiçek ya da nesne; ortada ana özne; arkada sade ve aydınlık mekân |
| Duygu | Neşeli, sıcak, güvenli (4+). Gece sahneleri lamba, ay ve yıldızla parlar |
| Kadraj | Dikey 2:3 (1024×1536), full-bleed. Çerçeve, beyaz kenar ve vinyet yok. Yazı, harf ve rakam yok |
| Kırpma | Uygulama görseli 3:4'e (900×1200) kırpar. Baş ve önemli nesneler üst ve alt %10'dan uzak durur |

## Sabit bloklar (birebir kopyalanır)

Bu iki blok her promptun sonuna olduğu gibi eklenir. Değiştirmek gerekirse önce bu dosya güncellenir,
sonra tüm promptlar.

```text
Style: a bright, cheerful children's storybook illustration in a clean cartoon picture-book style. Every shape has a clear, smooth dark-brown outline of even weight; forms are simple and rounded; colours are smooth gouache-like fills with soft, simple shading and gentle highlights. Bright, saturated, sunny colours with high clarity and warm natural light. Characters are cute and friendly, with large expressive eyes, simple rounded faces, smooth skin and rosy cheeks. Medium level of detail: a handful of clear storytelling props, easy to read even as a small thumbnail, with an uncluttered background. Layered depth: leafy plants, flowers or small objects in the foreground, the main subject in the middle, a simple bright setting behind. Mood: cheerful, cozy and safe for children aged 4 and up. Full-bleed: the painting fills the whole canvas edge to edge, with no border, frame, vignette or white margin.
```

```text
Avoid: fine cross-hatching, etching or engraving lines, hyper-detailed textures, realistic wrinkles or aged skin, sepia or muted vintage tones, photorealism, 3D render, anime or manga style, flat vector art; any text, letters, numbers, logos, signatures or watermarks (signs and books stay blank or pictorial); anything scary, violent or sad; an overall dark image (night scenes still glow with warm lamps, moonlight and stars).
```

## Prompt şablonu

```text
Create a vertical 2:3 portrait illustration (1024 x 1536) for the cover of the children's story "<Title>", based on the original public-domain book, in a fresh original design that does not resemble any film or animated version.
Scene: <hikayenin en tanıdık ve sakin anı, 2–4 cümle>.
Characters: <her karakter: yaş, saç, yüz ifadesi, kıyafet ve renkleri, duruş>.
Setting and props: <dönem, mekân, hikayeye özel 4–8 nesne>.
Composition: main subject large and centred in the middle of the frame, faces clearly visible; keep heads and key objects away from the top and bottom 10% (the image will be cropped to 3:4); <ön plan>; <arka plan>; <kamera açısı>.
Light and colour: <günün saati, ışık kaynağı, 3–5 baskın renk>.
<STYLE bloğu>
<AVOID bloğu>
```

## ChatGPT ile üretirken

- **Film benzerliği reddi:** ChatGPT, filmi olan hikayelerde üçüncü taraf benzerliği gerekçesiyle
  üretimi reddedebiliyor. Şablonun ilk satırındaki "public-domain book… does not resemble any film"
  cümlesi bu yüzden var.
  - Yine reddederse, filmle özdeşleşmiş yan karakterleri çıkar. Örneğin Mowgli'de Baloo ve Bagheera
    çıkarıldı, yalnız kurtlar kaldı.
  - Kostümü kitabın orijinal tarifine çek. Örneğin Pinocchio'ya Collodi'nin 1883 tarifindeki kıyafet
    verildi.
- **Stil kayması:** Her 10–15 kapakta bir yeni sohbet aç.
- **Kontrol listesi:**
  - Görselde yazı ya da rakam yok (saat kadranı ve tabelalar da buna dahil)
  - Kenarda çerçeve yok
  - Karakter metne uyuyor
  - Ana özne ortada

## Kaynaklar

- Hikaye bazlı promptlar (st-0273–0372): `qa/classics-covers/CHATGPT-COVER-PROMPTS.md`
- İçe aktarma: `node pipeline/import-covers-v2.mjs --src <klasör> --ids st-0273,...`
