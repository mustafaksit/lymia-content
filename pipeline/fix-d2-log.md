# D2 Düzeltme Logu — SONUÇ: UYGULANMADI (geri alındı)

## Ne yapıldı
Kural-tabanlı D2 fixer (`pipeline/fix-d2.mjs`) denendi: 74 hikayede 343 cümle değiştirildi,
sonra **tamamı geri alındı** (343/343, 0 kayıp). Hiçbir kalıcı D2 değişikliği YOK.

## Neden geri alındı — kör kural yeni HATALAR üretti
Guard ("hata sayısı düşsün") aldatıldı: dönüşüm regex eşleşmesini bozunca sayaç düşüyor
ama gramer bozuluyordu. Somut bozulmalar:

| Orijinal (doğru/yarı-doğru) | Fixer çıktısı (YANLIŞ) | Sebep |
|---|---|---|
| …agreed that **work** together… | …agreed that **worked** together… | "that" = bağlaç, relatif sanıldı |
| …things that **tell** time | …things that **tells** time | "things" çoğul öncül, tekil sanıldı |
| Nothing **like** this… | Nothing **liked** this… | "like" burada edat, fiil sanıldı |
| "He **be** like the Prince" | "**was** like the Prince" | özne düşürüldü (token hatası) |
| …hope could root… (that hope) | …**hoped** could root… | complement "that", relatif sanıldı |

## Ölçüm — D2 neden deterministik değil
77 hikayedeki hit kaynakları:
- curated `agreementIssues` (güvenli, He/She/It+fiil, "X be sıfat"): **0**
- relatif who/that/which + fiil (riskli, "that" belirsizliği + çoğul öncül): **126**
- isimden sonra bare "be" (özne sayısı + tense belirsizliği): **201**
- belirsiz zamir + fiil ("Nothing like" gibi edat tuzakları): **36**

Yani D2 hatalarının **%0'ı** güvenli-curated tipte; %100'ü POS/bağlam bilgisi gerektiren
belirsiz kalıplar. Mevcut güvenli fixer (`fix-grammar-rules.mjs`) bu 77'de **0 düzeltme** buldu.

## Öneri
D2, ilk varsayımın aksine **deterministik değil**; D1 gibi **LLM re-pass**'e yönlendirilmeli
(cümleyi bağlamıyla ver, "özne-yüklem uyumunu ve fiil çekimini düzelt, kurguyu/tense'i koru"
talimatıyla). Alternatif: çok dar bir alt-küme (yalnız cümle-başı belirsiz zamir + çekirdek fiil)
elle küratörlenip script'le düzeltilebilir ama kazanç düşük, risk sürüyor.

`fix-d2.mjs` repoda duruyor ama **çalıştırılmamalı** (yukarıdaki nedenlerle).


---
# D2 LLM RE-PASS (Asama 3)

## st-0126 — ⚠️ LLM hata: Unexpected non-whitespace character after JSON at position 4
## st-0124 — ⚠️ LLM hata: Unexpected non-whitespace character after JSON at position 3


---
# D2 LLM RE-PASS (Asama 3)

## st-0126 — 19 cumle
- [A1]
  - ~~Mr. Wilson be a shop man.~~
  - ✅ Mr. Wilson is a shop man.
- [A1]
  - ~~Holmes be a great man.~~
  - ✅ Holmes is a great man.
- [A2]
  - ~~Mr. Wilson be a shop man with red head.~~
  - ✅ Mr. Wilson is a shop man with red head.
- [A2]
  - ~~Holmes be a great man.~~
  - ✅ Holmes is a great man.
- [A2]
  - ~~The answer be that the club need a reason to be away.~~
  - ✅ The answer is that the club need a reason to be away.
- [A2]
  - ~~Holmes see a real point be a space.~~
  - ✅ Holmes sees a real point is a space.
- [A2]
  - ~~If the space be good then the person can take money.~~
  - ✅ If the space is good then the person can take money.
- [A2]
  - ~~Police and bank staff be there and be in a black part.~~
  - ✅ Police and bank staff are there and are in a black part.
- [A2]
  - ~~They be until night when person will come to use the space.~~
  - ✅ They are until night when person will come to use the space.
- [A2]
  - ~~Holmes tell police the club be an idea.~~
  - ✅ Holmes tells police the club is an idea.
- [A2]
  - ~~The space be the real idea.~~
  - ✅ The space is the real idea.
- [A2]
  - ~~The shop be open and people can buy and sell.~~
  - ✅ The shop is open and people can buy and sell.
- [B1]
  - ~~Mr. Wilson be a red head man who own a shop.~~
  - ✅ Mr. Wilson is a red head man who owns a shop.
- [B1]
  - ~~The shop be in a town area and many customers come each hour.~~
  - ✅ The shop is in a town area and many customers come each hour.
- [B1]
  - ~~One day he meet Sherlock Holmes who be a great man.~~
  - ✅ One day he meets Sherlock Holmes who is a great man.
- [B1]
  - ~~The club say it be close now and the job end after few time.~~
  - ✅ The club says it is close now and the job ends after few time.
- [B1]
  - ~~The real point be a hole that go from the shop down to the bank.~~
  - ✅ The real point is a hole that goes from the shop down to the bank.
- [B1]
  - ~~If the hole be ready then the person can take money from the bank.~~
  - ✅ If the hole is ready then the person can take money from the bank.
- [B1]
  - ~~He says he work for a club that need money for a secret plan.~~
  - ✅ He says he works for a club that needs money for a secret plan.
  → kalan D2: 26 ⚠️ ISARETLENDI

## st-0124 — 8 cumle
- [A1]
  - ~~Hour be early night.~~
  - ✅ Hour is early night.
- [A1]
  - ~~The new man be Jimmy.~~
  - ✅ The new man is Jimmy.
- [B1]
  - ~~If the man be his friend, he will smile and hold his old friend.~~
  - ✅ If the man is his friend, he will smile and hold his old friend.
- [B1]
  - ~~The other man be Jimmy, a man who have become a city man after many years.~~
  - ✅ The other man is Jimmy, a man who has become a city man after many years.
- [B1]
  - ~~Jimmy have known the wait man since they be boy and they have share many years.~~
  - ✅ Jimmy has known the wait man since they were boy and they have shared many years.
- [B1]
  - ~~He be send by Jimmy to keep the wait man and to keep the promise safe.~~
  - ✅ He was sent by Jimmy to keep the wait man and to keep the promise safe.
- [B1]
  - ~~He can not speak, but his eye show that he be ready to do his work.~~
  - ✅ He can not speak, but his eye shows that he is ready to do his work.
- [B1]
  - ~~Jimmy watch from far, his mind heavy but his duty be done.~~
  - ✅ Jimmy watch from far, his mind heavy but his duty is done.
  → kalan D2: 2 ⚠️ ISARETLENDI



---
# D2 LLM RE-PASS (Asama 3)

## st-0008 — 3 cumle
- [A1]
  - ~~A mother tells child, "Be like Prince."~~
  - ✅ A mother tells child, "Is like Prince."
- [B1]
  - ~~She said, "Be like the Happy Prince."~~
  - ✅ She said, "Is like the Happy Prince."
- [C1]
  - ~~A wise mother, soothing her wailing infant, whispered, "Be like the Happy Prince; he never weeps."~~
  - ✅ A wise mother, soothing her wailing infant, whispered, "Is like the Happy Prince; he never weeps."
  → kalan D2: 0 ✅

## st-0102 — 1 cumle
- [B2]
  - ~~Both Emma and Luca feel a small still joy that grow each bright day today.~~
  - ✅ Both Emma and Luca feel a small still joy that grows each bright day today.
  → kalan D2: 0 ✅

## st-0106 — 1 cumle
- [A1]
  - ~~Home be a good place.~~
  - ✅ Home is a good place.
  → kalan D2: 1 ⚠️ ISARETLENDI

## st-0109 — 15 cumle
- [B1]
  - ~~A signal say Leo and Maya that a new object be very near the ship.~~
  - ✅ A signal says Leo and Maya that a new object is very near the ship.
- [B1]
  - ~~Water be like small light and the air be cool as the night air moves still.~~
  - ✅ Water is like small light and the air is cool as the night air moves still.
- [B1]
  - ~~The panel link to a main power core that be off due to an old dark.~~
  - ✅ The panel links to a main power core that is off due to an old dark.
- [B1]
  - ~~The wire be open and power can not flow to garden because of damage.~~
  - ✅ The wire is open and power can not flow to garden because of damage.
- [B1]
  - ~~The ship system be stable now and the ship can move toward home with calm.~~
  - ✅ The ship system is stable now and the ship can move toward home with calm.
- [B1]
  - ~~A new plan be set to return home with the garden alive, make future people learn.~~
  - ✅ A new plan is set to return home with the garden alive, make future people learn.
- [B1]
  - ~~The garden be inside the ship and give a very still feeling to all who watch.~~
  - ✅ The garden is inside the ship and gives a very still feeling to all who watch.
- [B1]
  - ~~The ship arrive at ground near a large area that look ready for new life.~~
  - ✅ The ship arrives at ground near a large area that looks ready for new life.
- [B1]
  - ~~The garden be placed near water and plants begin to spread slow across good ground.~~
  - ✅ The garden is placed near water and plants begin to spread slow across good ground.
- [B1]
  - ~~Soon the soil be rich and garden grow.~~
  - ✅ Soon the soil is rich and garden grows.
- [B1]
  - ~~He knows that the ship fix be a key part of the success for all people.~~
  - ✅ He knows that the ship fix is a key part of the success for all people.
- [B1]
  - ~~And they all feel that this story be only the start of many good year ahead.~~
  - ✅ And they all feel that this story is only the start of many good year ahead.
- [B1]
  - ~~If the travel be good the people will celebrate and share the story across many worlds.~~
  - ✅ If the travel is good the people will celebrate and share the story across many worlds.
- [B1]
  - ~~And the night sky will always remember the bright garden that be above the planet.~~
  - ✅ And the night sky will always remember the bright garden that is above the planet.
- [B2]
  - ~~Leo and Maya were on an old star ship that move through a dark very star area during the night.~~
  - ✅ Leo and Maya were on an old star ship that moves through a dark very star area during the night.
  → kalan D2: 8 ⚠️ ISARETLENDI

## st-0113 — 7 cumle
- [A1]
  - ~~Emily see sign that say door.~~
  - ✅ Emily sees sign that says door.
- [B1]
  - ~~Emily follow the street and soon see a big clear sign that read market door.~~
  - ✅ Emily follows the street and soon sees a big clear sign that reads market door.
- [B1]
  - ~~Emily see a shop that sell big material but she cannot pay for it.~~
  - ✅ Emily sees a shop that sells big material but she cannot pay for it.
- [B1]
  - ~~A good woman who work there offer Emily a small piece for free.~~
  - ✅ A good woman who works there offers Emily a small piece for free.
- [B2]
  - ~~Emily follows a loud sound band while Lila follows a sign that lead to a new area.~~
  - ✅ Emily follows a loud sound band while Lila follows a sign that leads to a new area.
- [B2]
  - ~~A kind woman who work there offer her a small piece for free because she happy today.~~
  - ✅ A kind woman who works there offers her a small piece for free because she is happy today.
- [B2]
  - ~~She will include the name of the person who help her, the sign direction, and the food taste.~~
  - ✅ She will include the name of the person who helps her, the sign direction, and the food taste.
  → kalan D2: 3 ⚠️ ISARETLENDI

## st-0115 — 26 cumle
- [A2]
  - ~~They also find another paper that show a new place near water.~~
  - ✅ They also find another paper that shows a new place near water.
- [B1]
  - ~~They also find another map that show a new cave near the sea.~~
  - ✅ They also find another map that shows a new cave near the sea.
- [B1]
  - ~~They also find a note that say the gift will help the village grow.~~
  - ✅ They also find a note that says the gift will help the village grow.
- [B2]
  - ~~The map show a new island that be far from any place that people know on the sea.~~
  - ✅ The map shows a new island that is far from any place that people know on the sea.
- [B2]
  - ~~The map was old but the line be still clear, and the lines appear to light in the dark.~~
  - ✅ The map was old but the lines were still clear, and the lines appear to light in the dark.
- [B2]
  - ~~The map be draw by an old man who love the sea.~~
  - ✅ The map was drawn by an old man who loved the sea.
- [B2]
  - ~~The sky was clear and the wind be calm, so the boat move fast to the place.~~
  - ✅ The sky was clear and the wind was calm, so the boat moved fast to the place.
- [B2]
  - ~~When they arrive they see a small beach and a tall tree that show the spot on the map.~~
  - ✅ When they arrive they see a small beach and a tall tree that shows the spot on the map.
- [B2]
  - ~~Inside the box is a note that say the gift will be a present for the people if they can answer questions.~~
  - ✅ Inside the box is a note that says the gift will be a present for the people if they can answer questions.
- [B2]
  - ~~Sam count the steps and see that there be many steps, which be the right answer.~~
  - ✅ Sam counts the steps and sees that there are many steps, which is the right answer.
- [B2]
  - ~~Inside they find a small wood key and another map that show a new room near the sea.~~
  - ✅ Inside they find a small wood key and another map that shows a new room near the sea.
- [B2]
  - ~~The note inside be write in a simple hand and it promise a gift.~~
  - ✅ The note inside was written in a simple hand and it promises a gift.
- [B2]
  - ~~They use the key to open a stone gate that lead to a new room full of sound.~~
  - ✅ They use the key to open a stone gate that leads to a new room full of sound.
- [B2]
  - ~~Inside the room they hear a soft voice that ask them to answer a second question.~~
  - ✅ Inside the room they hear a soft voice that asks them to answer a second question.
- [B2]
  - ~~The voice say the answer be the name of the sea that touch the island.~~
  - ✅ The voice says the answer is the name of the sea that touches the island.
- [B2]
  - ~~Sam think about the map and remember that the sea be called the blue sea.~~
  - ✅ Sam thinks about the map and remembers that the sea is called the blue sea.
- [B2]
  - ~~Maya say the answer be blue sea, and the voice laugh with happy.~~
  - ✅ Maya says the answer is blue sea, and the voice laughs with happy.
- [B2]
  - ~~The voice be good and it guide them with soft light.~~
  - ✅ The voice was good and it guides them with soft light.
- [B2]
  - ~~The room be still and the air feel cool.~~
  - ✅ The room was still and the air felt cool.
- [B2]
  - ~~Inside the chest they find a large bag of seed and a note that say the gift will help the people grow.~~
  - ✅ Inside the chest they find a large bag of seed and a note that says the gift will help the people grow.
- [B2]
  - ~~The note explain that the seed be from a rare plant that can give food for many years.~~
  - ✅ The note explains that the seeds are from a rare plant that can give food for many years.
- [B2]
  - ~~The bag of seed be heavy but the box be strong, and they can carry it without trouble.~~
  - ✅ The bag of seed was heavy but the box was strong, and they could carry it without trouble.
- [B2]
  - ~~The seed be small but each hold a promise of future food.~~
  - ✅ The seeds are small but each holds a promise of future food.
- [B2]
  - ~~The bag of seed be kept in a safe place until the planting season.~~
  - ✅ The bag of seed was kept in a safe place until the planting season.
- [B2]
  - ~~Sam and Maya will always remember the trip and the map that lead them to the great present.~~
  - ✅ Sam and Maya will always remember the trip and the map that led them to the great present.
- [B2]
  - ~~Each child who read the story feel a fire of interest.~~
  - ✅ Each child who reads the story feels a fire of interest.
  → kalan D2: 0 ✅

## st-0117 — 9 cumle
- [A2]
  - ~~She be sure because the way is clear.~~
  - ✅ She is sure because the way is clear.
- [A2]
  - ~~Lucy hope more people be good and enjoy market.~~
  - ✅ Lucy hopes more people are good and enjoy market.
- [B2]
  - ~~Anna points to a fruit shop that sell fresh fruit for a good price.~~
  - ✅ Anna points to a fruit shop that sells fresh fruit for a good price.
- [B2]
  - ~~A kind woman who walk near notices Emily worry and ask if she need any help.~~
  - ✅ A kind woman who walks near notices Emily worry and asks if she needs any help.
- [B2]
  - ~~The information office is run by a kind employee who say people well and offer good map.~~
  - ✅ The information office is run by a kind employee who says people well and offers good map.
- [B2]
  - ~~The map show the route that lead back to the fruit shop where Anna may wait for her friend.~~
  - ✅ The map shows the route that leads back to the fruit shop where Anna may wait for her friend.
- [B2]
  - ~~The kind woman who help Emily watch them and feel sure that her help made a happy ending.~~
  - ✅ The kind woman who helps Emily watches them and feels sure that her help made a happy ending.
- [B2]
  - ~~If someone follow the main signs, they can find most places without get away from their group.~~
  - ✅ If someone follows the main signs, they can find most places without get away from their group.
- [B2]
  - ~~The kind woman who help Emily is named Lucy and she work part time at the market office.~~
  - ✅ The kind woman who helps Emily is named Lucy and she works part time at the market office.
  → kalan D2: 6 ⚠️ ISARETLENDI

## st-0119 — 5 cumle
- [B1]
  - ~~Tom is a man who like look at star from his ship.~~
  - ✅ Tom is a man who likes look at star from his ship.
- [B1]
  - ~~Their ship move toward a white spot that show a strange pattern.~~
  - ✅ Their ship moves toward a white spot that shows a strange pattern.
- [B1]
  - ~~When they approach they see a little garden that move in space with a blue light.~~
  - ✅ When they approach they see a little garden that moves in space with a blue light.
- [B1]
  - ~~After several minutes the wave pass and the ship be still.~~
  - ✅ After several minutes the wave passes and the ship is still.
- [B1]
  - ~~The little garden be in the ship room, a sign that life can develop in space.~~
  - ✅ The little garden is in the ship room, a sign that life can develop in space.
  → kalan D2: 3 ⚠️ ISARETLENDI

## st-0120 — 2 cumle
- [B1]
  - ~~Someone follow them quietly.~~
  - ✅ Someone follows them quietly.
- [B1]
  - ~~They have know that help bring success.~~
  - ✅ They have known that helps bring success.
  → kalan D2: 0 ✅

## st-0122 — 4 cumle
- [B2]
  - ~~Jim, who love his watch, feel bad that he can not buy a gift for Della hair.~~
  - ✅ Jim, who loves his watch, feels bad that he can not buy a gift for Della hair.
- [B2]
  - ~~The fact that each sold something show how much they care for each other, a good sign.~~
  - ✅ The fact that each sold something shows how much they care for each other, a good sign.
- [B2]
  - ~~The story go like a good wind that show love can be the big power, move many think.~~
  - ✅ The story goes like a good wind that shows love can be the big power, moving many things.
- [B2]
  - ~~Such kindness spreads like a gentle wind that carry the feel of love across the town.~~
  - ✅ Such kindness spreads like a gentle wind that carries the feel of love across the town.
  → kalan D2: 9 ⚠️ ISARETLENDI

  [drift-atlandi] st-0123: "Johnsy smile and feel that hope stay." -> "Johnsy smiles and feels that hope stays."
## st-0123 — 34 cumle
- [A2]
  - ~~Behrman be a good person.~~
  - ✅ Behrman is a good person.
- [B1]
  - ~~Johnsy is a young woman who live in a small place.~~
  - ✅ Johnsy is a young woman who lives in a small place.
- [B1]
  - ~~Behrman is an old man who love to draw.~~
  - ✅ Behrman is an old man who loves to draw.
- [B2]
  - ~~Johnsy be a woman who live in a small home.~~
  - ✅ Johnsy is a woman who lives in a small home.
- [B2]
  - ~~She said that she will die when the last Leaf be.~~
  - ✅ She said that she will die when the last Leaf is.
- [B2]
  - ~~Sue be a friend who feel very bad.~~
  - ✅ Sue is a friend who feels very bad.
- [B2]
  - ~~Behrman be an old man who live by the wall.~~
  - ✅ Behrman is an old man who lives by the wall.
- [B2]
  - ~~A night be long and cold.~~
  - ✅ A night was long and cold.
- [B2]
  - ~~The story be about hope and love.~~
  - ✅ The story is about hope and love.
- [B2]
  - ~~The day be and the room be.~~
  - ✅ The day was and the room was.
- [B2]
  - ~~Her health be better each night.~~
  - ✅ Her health is better each night.
- [B2]
  - ~~The Leaf be still on the wall.~~
  - ✅ The Leaf was still on the wall.
- [B2]
  - ~~Behrman, who be strong, see from the top.~~
  - ✅ Behrman, who is strong, sees from the top.
- [B2]
  - ~~He thought his act be worth the risk.~~
  - ✅ He thought his act was worth the risk.
- [B2]
  - ~~The cold be bad and the night be long.~~
  - ✅ The cold was bad and the night was long.
- [B2]
  - ~~In the dream the Leaf be good and good.~~
  - ✅ In the dream the Leaf was good and good.
- [B2]
  - ~~Sue be good to see the change.~~
  - ✅ Sue is good to see the change.
- [B2]
  - ~~The wall was old but the Leaf be new.~~
  - ✅ The wall was old but the Leaf was new.
- [B2]
  - ~~The story be share by many.~~
  - ✅ The story is shared by many.
- [B2]
  - ~~The point be that a small act can save a life.~~
  - ✅ The point is that a small act can save a life.
- [B2]
  - ~~When the season come, the wall be many Leaf.~~
  - ✅ When the season comes, the wall is many Leaf.
- [B2]
  - ~~Behrman, who be old, die but his act live on.~~
  - ✅ Behrman, who was old, died but his act lives on.
- [B2]
  - ~~His name be talk by the town.~~
  - ✅ His name is talked by the town.
- [B2]
  - ~~The wall be many Leaf now.~~
  - ✅ The wall is many Leaf now.
- [B2]
  - ~~Each Leaf be a sign of hope.~~
  - ✅ Each Leaf is a sign of hope.
- [B2]
  - ~~She also say that hope be the good strong.~~
  - ✅ She also says that hope is the good strong.
- [B2]
  - ~~The story be yet hard.~~
  - ✅ The story is yet hard.
- [B2]
  - ~~It be that a small act can change a big mind.~~
  - ✅ It is that a small act can change a big mind.
- [B2]
  - ~~It be a reminder that we all can help.~~
  - ✅ It is a reminder that we all can help.
- [B2]
  - ~~The end be a new start for Johnsy.~~
  - ✅ The end is a new start for Johnsy.
- [B2]
  - ~~She talked to the Leaf as if it be a friend.~~
  - ✅ She talked to the Leaf as if it were a friend.
- [B2]
  - ~~She thought that the Leaf be a present.~~
  - ✅ She thought that the Leaf was a present.
- [B2]
  - ~~It be a part of the town life.~~
  - ✅ It is a part of the town life.
- [B2]
  - ~~She told the town that the Leaf be a sign.~~
  - ✅ She told the town that the Leaf was a sign.
  → kalan D2: 13 ⚠️ ISARETLENDI

## st-0125 — 7 cumle
- [A1]
  - ~~Someone say he get thing from man.~~
  - ✅ Someone says he gets thing from man.
- [A2]
  - ~~He made the thing be on a table.~~
  - ✅ He made the thing is on a table.
- [B2]
  - ~~Inside the bird a Blue Carbuncle be hold by a good look during the case.~~
  - ✅ Inside the bird a Blue Carbuncle is held by a good look during the case.
- [B2]
  - ~~The Blue Carbuncle be a small thing that have be take from a rich old house.~~
  - ✅ The Blue Carbuncle is a small thing that has been taken from a rich old house.
- [B2]
  - ~~The shop man say that he have buy the bird from a trader who have a red old cover.~~
  - ✅ The shop man says that he has bought the bird from a trader who has a red old cover.
- [B2]
  - ~~The trader tell that he have receive the bird from a man who come from a far old street.~~
  - ✅ The trader tells that he has received the bird from a man who comes from a far old street.
- [B2]
  - ~~That man have a small cover and he say the bird be a gift for his child.~~
  - ✅ That man has a small cover and he says the bird is a gift for his child.
  → kalan D2: 17 ⚠️ ISARETLENDI

## st-0148 — 1 cumle
- [A1]
  - ~~Every person be glad for the winner.~~
  - ✅ Every person is glad for the winner.
  → kalan D2: 0 ✅

## st-0152 — 1 cumle
- [A1]
  - ~~Everyone see him right away.~~
  - ✅ Everyone sees him right away.
  → kalan D2: 0 ✅

## st-0168 — 2 cumle
- [A1]
  - ~~She do not know he be bad.~~
  - ✅ She does not know he is bad.
- [A1]
  - ~~Something look very different.~~
  - ✅ Something looks very different.
  → kalan D2: 0 ✅

## st-0169 — 4 cumle
- [A1]
  - ~~The man be sad.~~
  - ✅ The man is sad.
- [A1]
  - ~~They be very glad now.~~
  - ✅ They are very glad now.
- [A1]
  - ~~He be very glad.~~
  - ✅ He is very glad.
- [A1]
  - ~~The old woman be not there.~~
  - ✅ The old woman is not there.
  → kalan D2: 0 ✅

## st-0170 — 6 cumle
- [A1]
  - ~~She be very kind.~~
  - ✅ She is very kind.
- [A1]
  - ~~She be happy to help him.~~
  - ✅ She is happy to help him.
- [A1]
  - ~~He be very low on heat.~~
  - ✅ He is very low on heat.
- [A1]
  - ~~She be very good to all.~~
  - ✅ She is very good to all.
- [A1]
  - ~~She be in a tree area.~~
  - ✅ She is in a tree area.
- [A1]
  - ~~She be very happy now.~~
  - ✅ She is very happy now.
  → kalan D2: 1 ⚠️ ISARETLENDI

## st-0176 — 1 cumle
- [C1]
  - ~~Although her stepmother attempted to conceal Cinderella in the shadows, the prince insisted that every maiden in the household be given the opportunity.~~
  - ✅ Although her stepmother attempted to conceal Cinderella in the shadows, the prince insisted that every maiden in the household is given the opportunity.
  → kalan D2: 0 ✅

## st-0199 — 1 cumle
- [C1]
  - ~~Irritated by the small creature's perceived stupidity, the proud tiger demanded that he be shown the exact arrangement to prove the reality of his confinement.~~
  - ✅ Irritated by the small creature's perceived stupidity, the proud tiger demanded that he is shown the exact arrangement to prove the reality of his confinement.
  → kalan D2: 0 ✅

## st-0235 — 3 cumle
- [A1]
  - ~~Everyone feel good.~~
  - ✅ Everyone feels good.
- [A1]
  - ~~The family be very good.~~
  - ✅ The family is very good.
- [A1]
  - ~~Everyone be safe now.~~
  - ✅ Everyone is safe now.
  → kalan D2: 0 ✅

## st-0238 — 4 cumle
- [A1]
  - ~~Place be Wild Forest.~~
  - ✅ Place is Wild Forest.
- [A1]
  - ~~He be by himself.~~
  - ✅ He is by himself.
- [A1]
  - ~~They say everything be right.~~
  - ✅ They say everything is right.
- [A1]
  - ~~They be glad.~~
  - ✅ They are glad.
  → kalan D2: 3 ⚠️ ISARETLENDI

## st-0240 — 9 cumle
- [A1]
  - ~~His friend be Hugh.~~
  - ✅ His friend is Hugh.
- [A1]
  - ~~Hugh be a big man.~~
  - ✅ Hugh is a big man.
- [A1]
  - ~~Hans be good.~~
  - ✅ Hans is good.
- [A1]
  - ~~He thinks friend be important.~~
  - ✅ He thinks friend is important.
- [A1]
  - ~~He be very good to Hugh.~~
  - ✅ He is very good to Hugh.
- [A1]
  - ~~Hans be a kind friend.~~
  - ✅ Hans is a kind friend.
- [A1]
  - ~~The water be very deep.~~
  - ✅ The water is very deep.
- [A1]
  - ~~Hans be very tired now.~~
  - ✅ Hans is very tired now.
- [A1]
  - ~~They know Hugh be bad.~~
  - ✅ They know Hugh is bad.
  → kalan D2: 0 ✅

## st-0241 — 1 cumle
- [A1]
  - ~~Nobody see him go.~~
  - ✅ Nobody sees him go.
  → kalan D2: 1 ⚠️ ISARETLENDI

## st-0243 — 6 cumle
- [A1]
  - ~~She be good and kind.~~
  - ✅ She is good and kind.
- [A1]
  - ~~Her mother be not here.~~
  - ✅ Her mother is not here.
- [A1]
  - ~~She knows the time be not right.~~
  - ✅ She knows the time is not right.
- [A1]
  - ~~Everyone think the child might die.~~
  - ✅ Everyone thinks the child might die.
- [A1]
  - ~~The child know this be the right moment.~~
  - ✅ The child knows this is the right moment.
- [A1]
  - ~~The family be good again.~~
  - ✅ The family is good again.
  → kalan D2: 0 ✅

## st-0257 — 1 cumle
- [A1]
  - ~~Nothing stay after that time.~~
  - ✅ Nothing stays after that time.
  → kalan D2: 0 ✅

## st-0262 — 5 cumle
- [A1]
  - ~~The man see how kind the friend be.~~
  - ✅ The man sees how kind the friend is.
- [A1]
  - ~~They believe bad things be close.~~
  - ✅ They believe bad things are close.
- [A1]
  - ~~The man understand the friend be good.~~
  - ✅ The man understands the friend is good.
- [A1]
  - ~~There be a small play.~~
  - ✅ There is a small play.
- [A1]
  - ~~Everyone come to watch.~~
  - ✅ Everyone comes to watch.
  → kalan D2: 0 ✅

  [drift-atlandi] st-0266: "Everyone play and move." -> "Everyone plays and moves."
## st-0266 — 2 cumle
- [A1]
  - ~~Nobody know why this is true.~~
  - ✅ Nobody knows why this is true.
- [A1]
  - ~~Everyone live together.~~
  - ✅ Everyone lives together.
  → kalan D2: 1 ⚠️ ISARETLENDI

