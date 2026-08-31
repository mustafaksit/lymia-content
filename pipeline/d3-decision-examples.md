# D3 Karar Örnekleri — B1 "if…will" Şart Cümlesi Enjeksiyonu

> 110 B1 hikayesinde, geçmiş zaman anlatısının içine Type-1 (if + present, will) şart
> cümlesi sızmış. Aşağıda 5 temsili örnek; her biri için **A (çıkar)** ve **B (geçmişe çek)**.
> Hangi yaklaşımı seçeceğini söyle; ona göre 110'una uygulayacağım. Karar gelene kadar D3'e dokunulmadı.

**Genel gözlem:** Bazı hikayeler geçmiş anlatı değil, "hâlâ anlatılır / evrensel ahlak" (present perfect)
kaydında (Stone Soup, The Two Pots). Orada B (geçmiş) tuhaf düşüyor, A (çıkar) daha temiz. Saf geçmiş
anlatıda (The Whispering Well, Tortoise and the Hare) B doğal olabilir.

---

## Örnek 1 — st-0006 The Whispering Well
- **Önce:** He wondered if his mind was playing a trick on him.
- **HATA:** `If he is careful, he will cover the well and walk away.`
- **Sonra:** The next morning, Ben went back to the garden.
- **A (çıkar):** cümleyi tamamen sil. → Akış: "…playing a trick on him. The next morning, Ben went back…" (niyet beyanı kaybolur ama boşluk hissedilmez).
- **B (geçmiş):** `He thought that if he was careful, he could cover the well and walk away.`

## Örnek 2 — st-0148 The Tortoise and the Hare
- **Önce:** He has spent much time running fast in his past days.
- **HATA:** `If he runs again tomorrow, he will win the race.`
- **Sonra:** While the proud runner slept, the slow animal never stopped moving.
- **A (çıkar):** sil. → Akış korunur; tavşanın kibri "proud runner" ile zaten ima ediliyor.
- **B (geçmiş):** `He was sure that if he ran again the next day, he would win the race.`

## Örnek 3 — st-0208 Stone Soup  (present-perfect/evrensel kayıt)
- **Önce:** People have shown that water and stone can start a meal.
- **HATA:** `If people look closely, they will see the start of wonderful food.`
- **Sonra:** They have made a fire.
- **A (çıkar):** sil. → En temiz seçenek (anlatı zaten geçmiş değil, present-perfect).
- **B (geçmiş):** tuhaf düşer; en fazla present bırakılıp genel doğru olarak: `Looking closely, one could see the start of a wonderful meal.`

## Örnek 4 — st-0250 The Two Pots  (doğrudan ahlak/hitap)
- **Önce:** People still tell this story to their children in every town.
- **HATA:** `If someone asks you about the two friends, you will remember the lesson.`
- **Sonra:** Every child has heard how the metal item failed to save the earth item.
- **A (çıkar):** sil. → Ahlak cümlesi zaten çevre cümlelerde var; boşluk kalmaz.
- **B (geçmiş):** uymuyor (evrensel hitap). Zorlarsak: `If someone asked about the two friends, you would remember the lesson.` (yapay).

## Örnek 5 — st-0234 Heidi (tek epizod)
- **Önce:** They have lived there for years.
- **HATA:** `If the weather is good, they will walk up the hill again tomorrow.`
- **Sonra:** Every single day brought new happiness to the little girl.
- **A (çıkar):** sil. → Akış korunur.
- **B (geçmiş):** `If the weather was good, they would walk up the hill again the next day.` ("tomorrow"→"the next day").

---

### Karar için
- **Seçenek A (çıkar):** en güvenli, deterministik; kurgu boşluğu riski düşük (örneklerde yok). Hızlı, LLM'siz.
- **Seçenek B (geçmişe çek):** anlatıyı korur ama (1) present-perfect/evrensel kayıttaki hikayelerde tuhaf, (2) "tomorrow→the next day", modal seçimi (would/could) gibi bağlam kararları gerektirir → tam güvenli olması için LLM re-pass daha uygun.
- **Hibrit öneri:** Saf geçmiş anlatıdakiler B (geçmiş), present-perfect/evrensel kayıttakiler A (çıkar). Ama bu ayrım da bağlam ister.
