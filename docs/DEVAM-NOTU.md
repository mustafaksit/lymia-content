# DEVAM NOTU — 2026-08-19

> Bu dosya diğer bilgisayardan devam ederken ilk okunacak dosya. Repo:
> `mustafaksit/lymia-content`, branch `v2-content` (henüz `main`'e merge
> edilmedi — v2 tamamlanana kadar bilerek ayrı tutuluyor).

## Şu an neredeyiz

**Öncelik 1 (mevcut katalog sağlığı) BİTTİ:**
- Yayındaki 50 hikayenin başlık tekrarı giderildi (14 rename), özet/metin
  tutarsızlıkları düzeltildi.
- Yayındaki 50 hikayenin **tüm gramer uyum hataları giderildi (316→0)**,
  etkilenen 44 seviyenin sesi+karaoke zamanlaması yenilendi.
- `npm run health` → yayındaki 50 hikaye: gramer 0 hata, kapak 0 eksik,
  ses/timing/quiz/özet tam. **%100 sağlam.**
- `npm run audit` → 0 hard-fail. `npm run test:unit` → 8/8.
- `contentVersion` hâlâ **21** — hiçbir şey CDN'e yayınlanmadı, kasıtlı.

**Öncelik 2 (G3 — 200 hikayeye üretim) BAŞLADI, TIKANDI (kota):**
- Hedef: 200 hikaye = 50 mevcut (kalır) + 24 onaylı özgün + ~126 public
  domain retold.
- `docs/faz2-aday-listesi.md`: ~136 PD aday, kullanıcı onayladı.
- Batch-1 spec hazır: `pipeline/v2-batch1-fables.json` (ilk 10 Ezop fablı,
  plot'lu, PD).
- Pipeline'a deterministik kapılar eklendi (LLM'siz): `pipeline/
  fix-grammar-rules.mjs` (kural-tabanlı gramer düzeltme, batch runner'a
  audio'dan önce bağlı) + `audit --strict` (uyum/başlık/tavan kapıları).
- **Batch-1 çalıştırıldı, 0/10 üretildi.** Sebep: `generate-story.mjs`
  ("The North Wind and the Sun" vb. denemede) sürekli
  `Gemini HTTP 429: tüm sağlayıcılar kotayı tüketti` verdi. Manifest
  (`pipeline/.v2-batch-state.json`) 10 girişi kaydetti ama hiçbiri
  tamamlanmadı — **resume güvenli**, aynı komutu tekrar çalıştırınca
  devam eder.

## Kota gerçeği (asıl blokaj)

- 4 Gemini API anahtarı `.env`'de (`GEMINI_API_KEYS`, virgüllü) — **hepsi
  aynı Google projesinden**, yani aynı günlük ücretsiz kotayı paylaşıyor.
  Rotasyon bugün fayda vermedi.
- Groq anahtarı da eklendi (`GROQ_API_KEY`), model `openai/gpt-oss-120b`.
  Gramer düzeltmede kısa sürede işe yaradı ama üretim yükünde (hikaye
  başına ~4-10 LLM çağrısı) günlük kotayı hızla tüketti.
- Cerebras anahtarı denendi, **402 Payment Required** — bu hesapta
  ücretsiz katman aktif değil, kullanılamadı.
- **Matematik:** ~145 hikaye × ~10 çağrı ≈ 1450 çağrı. Tek proje/hesabın
  günlük ücretsiz kotasıyla bu tek oturumda bitmez.
- `.env` **gitignore'da**, repoya girmedi. Diğer bilgisayarda yeniden
  eklenmesi gerekiyor — bkz. "Yapılması gereken" altında.

## Yapılması gereken (öncelik sırasıyla)

1. **Kota stratejisi netleşmeli.** Üç seçenek, kullanıcı karar verecek:
   - Bağımsız Google hesaplarından (farklı proje) yeni Gemini anahtarları
     — gerçek çözüm, her hesap kendi günlük kotasını getirir.
   - Cerebras'ta free-tier'ı aktifleştirmek (billing sekmesinde; bazı
     hesaplarda kart eklenince ücretsiz kota açılıyor).
   - Çok-günlük grind: `node pipeline/run-v2-batch.mjs --kind classics
     --spec pipeline/v2-batch1-fables.json --from 0 --count 10` komutunu
     her gün kota resetinde (~gece yarısı Pasifik saati) tekrar çalıştır;
     idempotent, tamamlanan adımlar atlanır.
2. **`.env` yeniden kurulmalı** (diğer bilgisayarda, .env gitignore'da
   olduğu için repoda yok):
   ```
   GEMINI_API_KEYS=anahtar1,anahtar2,...
   GEMINI_MODELS=gemini-flash-latest
   GROQ_API_KEY=gsk_...
   ```
3. Batch-1 kota gelince aynı komutla devam eder (yukarıdaki komut).
   Bittiğinde: `npm run health` + `npm run audit` + rastgele 3 hikayenin
   B1/B2 tam metnini oku (kalite kontrolü) + `docs/batch-1-okuma.md`
   yaz + commit.
4. Batch-1 onaylanınca Batch-2 (`docs/faz2-aday-listesi.md`'den sıradaki
   10 — Grimm masalları önerilir) aynı akışla.
5. Tüm ~145 yeni hikaye bitince: **kapaklar** (Faz 4, Pollinations/Flux,
   ayrı — Gemini kotasından bağımsız) + `index.json`/`contentVersion`
   bump (Faz 5, CDN yayını) — **kullanıcı onayı olmadan yapılmayacak.**

## Diğer bekleyen işler (içerikten bağımsız, app repo'da)

`mustafaksit/lymia-app` reposunda:
- **İŞ 2 — quiz sonu interstitial**: `release/1.0.1` branch'inde,
  henüz kodlanmadı. Frekans kuralları aynen korunacak (ilk oturum
  reklamsız, min 180sn, günlük tavan). Zorunlu 30sn YOK.
- `release/1.0.1` şu an `hotfix/ad-empty-slot` merge edilmiş halde;
  build alınmadı, kullanıcı onayı bekliyor.
- 1.0 (9) App Store'da **onaylı ve yayında** (tag `v1.0-approved`,
  commit `5057f0f`). Bu sağlam, dokunma.

## Önemli dosyalar

- `pipeline/lib/agreement.mjs` — gramer uyum detektörü (yüksek hassasiyet,
  yanlış-pozitif ayıklandı, birim test var).
- `pipeline/fix-grammar-rules.mjs` — kural-tabanlı düzeltme (LLM YOK,
  anında). Yayındaki 50 hikayeyi bununla düzelttik.
- `pipeline/fix-grammar.mjs` + `pipeline/lib/gemini.mjs` — LLM re-pass
  altyapısı (çoklu sağlayıcı/anahtar, backoff, timeout). Gelecekte
  gerekirse kullanılabilir ama gramer için artık gerek yok.
- `pipeline/run-v2-batch.mjs` — G3 üretim orkestratörü, `--spec` ile
  özel liste alır, idempotent (`pipeline/.v2-batch-state.json`).
- `docs/faz2-aday-listesi.md` — onaylı ~136 PD aday.
- `docs/katalog-saglik-raporu.md` — health check çıktısı (güncel değil,
  `npm run health` ile tazele).

## Hızlı doğrulama komutları

```bash
npm run health        # katalog sağlık tablosu
npm run audit          # 0 hard-fail bekleniyor
npm run test:unit       # 8/8 bekleniyor
```
