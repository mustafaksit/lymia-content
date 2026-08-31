# Kalite Teshis Raporu — 200 Hikaye

Taranan: 200 hikaye. Yontem: kural-tabanli heuristik (yuksek recall, bir miktar yanlis-pozitif olabilir; ozellikle DESEN 1 semantik oldugu icin insan/LLM dogrulamasi gerektirir).

## Ozet

| Desen | Etkilenen hikaye | 
|---|---|
| 1 — Birebir ceviri / anlamsal hata (heuristik) | 2 |
| 2 — Eksik fiil cekimi (bare "be", 3.tekil -s) | 63 |
| 3 — B1 zorla sart cumlesi (if+will) | 0 |
| 4 — Paragraf/cumle tekrari | 30 |
| 5 — Kesik/eksik metin | 1 |

## DESEN 1 — Birebir ceviri / anlamsal hata

Etkilenen: **2** hikaye.

### st-0124 — After Twenty Years
- **A1** — "new woman/man" (young olmali?): `The new man`
- **A2** — "new woman/man" (young olmali?): `the new man`, `The new man`
- **B2** — "new woman/man" (young olmali?): `the new man`, `The new man`

### st-0217 — The Third Ingredient
- **B2** — "new woman/man" (young olmali?): `a new woman`
- **C1** — "new woman/man" (young olmali?): `the new woman`

## DESEN 2 — Eksik fiil cekimi

Etkilenen: **63** hikaye.

### st-0008 — The Happy Prince, and Other Tales
- **A1** (1 bulgu): `child, "Be`
- **B1** (1 bulgu): `said, "Be`
- **C1** (1 bulgu): `whispered, "Be`

### st-0024 — The Midnight Library Key
- **A1** (1 bulgu): `that tell`

### st-0033 — The Saturday Explorers
- **B1** (1 bulgu): `Nothing like`
- **B2** (1 bulgu): `Nothing like`

### st-0047 — The Missing Key
- **C1** (1 bulgu): `that keep`

### st-0088 — The Library Note
- **C1** (1 bulgu): `that have`

### st-0097 — Love on Sunny Island
- **C1** (1 bulgu): `that love`

### st-0104 — The Lost Island Quest
- **A2** (1 bulgu): `that work`
- **B1** (1 bulgu): `that work`
- **B2** (1 bulgu): `that work`

### st-0106 — The Starship Garden
- **C1** (1 bulgu): `that hope`

### st-0109 — The Signal in the Dark
- **A1** (1 bulgu): `that hope`
- **B1** (3 bulgu): `who watch`, `that help`, `that hope`
- **B2** (2 bulgu): `that hope`, `who watch`
- **C1** (1 bulgu): `that hope`

### st-0113 — The Music at the Market
- **A1** (1 bulgu): `that help`
- **B1** (1 bulgu): `that sell`
- **B2** (1 bulgu): `that sell`

### st-0117 — Lost in the Market
- **B1** (2 bulgu): `that turn`, `that keep`
- **B2** (3 bulgu): `that turn`, `that keep`, `that ask`
- **C1** (1 bulgu): `that read`

### st-0119 — The Garden Without Soil
- **A2** (1 bulgu): `that need`
- **B2** (2 bulgu): `that look`, `that need`

### st-0121 — Lily's Lost Bike
- **B2** (1 bulgu): `that help`

### st-0122 — The Gift of the Magi
- **A2** (1 bulgu): `that love`
- **B1** (1 bulgu): `that love`
- **B2** (1 bulgu): `that love`
- **C1** (1 bulgu): `that love`

### st-0123 — The Last Leaf
- **B1** (1 bulgu): `that hope`
- **B2** (2 bulgu): `that hope`, `that love`
- **C1** (2 bulgu): `that hope`, `that love`

### st-0124 — After Twenty Years
- **B1** (2 bulgu): `that have`, `that call`

### st-0125 — The Adventure of the Blue Carbuncle
- **B1** (1 bulgu): `that help`

### st-0126 — The Red-Headed League
- **B2** (3 bulgu): `who sit`, `that need`, `camera be`

### st-0130 — The North Wind and the Sun
- **B2** (1 bulgu): `actions be`
- **C1** (1 bulgu): `approach be`

### st-0131 — The Goose That Laid the Golden Eggs
- **B2** (1 bulgu): `that come`
- **C1** (1 bulgu): `that come`

### st-0132 — The Town Mouse and the Country Mouse
- **A1** (1 bulgu): `happy be`

### st-0134 — The Wolf in Sheep's Clothing
- **B2** (1 bulgu): `Nothing like`

### st-0135 — The Milkmaid and Her Pail
- **C1** (1 bulgu): `errors be`

### st-0136 — The Bundle of Sticks
- **B1** (1 bulgu): `who hear`

### st-0137 — The Crow and the Pitcher
- **B2** (1 bulgu): `that show`

### st-0144 — The Celebrated Jumping Frog
- **B2** (1 bulgu): `that teach`
- **C1** (1 bulgu): `that teach`

### st-0145 — The Open Road
- **B2** (1 bulgu): `that hope`

### st-0149 — The Lion and the Mouse
- **B2** (4 bulgu): `everyone find`, `days be`, `that love`, `life be`
- **C1** (3 bulgu): `who stand`, `days be`, `life be`

### st-0150 — The Boy Who Cried Wolf
- **C1** (1 bulgu): `longer be`

### st-0155 — How the Camel Got His Hump
- **B2** (2 bulgu): `everyone feel`, `that help`
- **C1** (1 bulgu): `longer be`

### st-0156 — Rip Van Winkle
- **A2** (1 bulgu): `someone call`
- **B1** (1 bulgu): `someone call`
- **B2** (1 bulgu): `someone call`

### st-0161 — Belling the Cat
- **C1** (1 bulgu): `cat be`

### st-0164 — The Frog Prince
- **C1** (1 bulgu): `he be`

### st-0165 — The Fisherman and His Wife
- **C1** (1 bulgu): `she be`

### st-0170 — The Star Money
- **B1** (1 bulgu): `that love`

### st-0173 — The Nightingale
- **C1** (1 bulgu): `animal be`

### st-0177 — Sleeping Beauty (Brier Rose)
- **B1** (1 bulgu): `everyone feel`

### st-0180 — The Tale of Squirrel Nutkin
- **B2** (1 bulgu): `someone like`

### st-0186 — How the Whale Got His Throat
- **B2** (1 bulgu): `Nothing like`
- **C1** (1 bulgu): `Nothing like`

### st-0188 — How the Rhinoceros Got His Skin
- **B2** (1 bulgu): `who come`
- **C1** (1 bulgu): `who watch`

### st-0190 — Aladdin and the Wonderful Lamp
- **B2** (1 bulgu): `that love`

### st-0193 — The Fisherman and the Genie
- **A1** (1 bulgu): `body be`

### st-0197 — Issun-boshi (One-Inch Boy)
- **A1** (1 bulgu): `something like`

### st-0205 — The Firebird
- **B2** (1 bulgu): `that help`

### st-0209 — The Gingerbread Man
- **B2** (1 bulgu): `something like`

### st-0212 — The Three Little Pigs
- **B2** (1 bulgu): `that come`
- **C1** (1 bulgu): `won't be`

### st-0217 — The Third Ingredient
- **A2** (1 bulgu): `that help`
- **C1** (1 bulgu): `something like`

### st-0222 — The Country of the Blind
- **C1** (1 bulgu): `day be`

### st-0227 — Aepyornis Island
- **B2** (1 bulgu): `that love`

### st-0233 — A Little Princess (tek epizod)
- **B2** (1 bulgu): `that love`

### st-0237 — Treasure Island (tek epizod)
- **B1** (1 bulgu): `that walk`

### st-0238 — Wind in the Willows: The Wild Wood (epizod)
- **B1** (1 bulgu): `that help`
- **B2** (2 bulgu): `nothing like`, `that help`

### st-0241 — The Remarkable Rocket
- **B1** (1 bulgu): `who come`

### st-0242 — The Star-Child (tek epizod)
- **B2** (1 bulgu): `that love`

### st-0251 — Androcles and the Lion
- **A1** (1 bulgu): `something speak`
- **C1** (1 bulgu): `lion be`

### st-0253 — The Talkative Tortoise
- **B2** (1 bulgu): `everyone find`
- **C1** (1 bulgu): `who hear`

### st-0256 — The Wise Little Girl
- **B2** (1 bulgu): `she be`
- **C1** (1 bulgu): `child be`

### st-0260 — The Mitten
- **B2** (1 bulgu): `that live`

### st-0263 — The Velveteen Rabbit
- **A2** (1 bulgu): `that love`
- **B2** (1 bulgu): `That love`

### st-0266 — The Twelve Dancing Princesses
- **A1** (1 bulgu): `Everyone play`

### st-0268 — Chicken Little (Henny Penny)
- **B2** (1 bulgu): `trouble, be`

### st-0269 — The Three Wishes
- **B2** (1 bulgu): `that love`

### st-0272 — The Peddler of Swaffham
- **B2** (1 bulgu): `dream be`

## DESEN 3 — B1 zorla sart cumlesi

Tespit **YOK**. ✅

## DESEN 4 — Paragraf/cumle tekrari

Etkilenen: **30** hikaye.

### st-0008 — The Happy Prince, and Other Tales
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) "swallow," says the prince.
- **A2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) "swallow, swallow, little swallow," said the prince.
- **B1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) "swallow, swallow, little swallow," said the prince.

### st-0012 — Alice's Adventures in Wonderland
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) alice feels very bad now.
- **B2** (tekrar cumle: 12, ardisik ayni paragraf: 0): (2x) she did not know what to do. | (2x) she always remembered the man.

### st-0013 — The Adventures of Tom Sawyer, Complete
- **B2** (tekrar cumle: 2, ardisik ayni paragraf: 0): (2x) they learned about friendship and being true to each other. | (2x) it will continue to be told for many years to come.

### st-0014 — A Christmas Carol in Prose; Being a Ghost Story of Christmas
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) he does not like christmas.
- **B1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) scrooge looked at him coldly.

### st-0020 — The Slow Mirror
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) ben can not close the eyes.

### st-0084 — The Island Not on the Map
- **A2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) they felt good about the trip.

### st-0091 — The Desert Map
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) they study the paper again.

### st-0120 — The Wall Beyond the River
- **A2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) they will meet new people.
- **B2** (tekrar cumle: 23, ardisik ayni paragraf: 0): (2x) max and his friend had grown closer. | (2x) they had become better friends.

### st-0121 — Lily's Lost Bike
- **B1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) she thinks the day is good.

### st-0122 — The Gift of the Magi
- **A2** (tekrar cumle: 3, ardisik ayni paragraf: 0): (2x) both will walk hand in hand. | (2x) the true present is love.
- **B1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) they are ready for the next day.

### st-0124 — After Twenty Years
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) he says the say is still good.

### st-0125 — The Adventure of the Blue Carbuncle
- **A1** (tekrar cumle: 2, ardisik ayni paragraf: 0): (2x) blue carbuncle is in thing. | (2x) if man do not keep blue carbuncle.

### st-0126 — The Red-Headed League
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) the open will let a person take money.

### st-0133 — The Dog and His Reflection
- **B2** (tekrar cumle: 12, ardisik ayni paragraf: 0): (2x) good friends and family matter more than extra wealth. | (2x) if we keep our minds open, we will grow wiser each day.

### st-0141 — Rikki-Tikki-Tavi
- **B1** (tekrar cumle: 7, ardisik ayni paragraf: 0): (2x) he has won many fights since he arrived here. | (2x) he always stayed near the people he had come to love.

### st-0150 — The Boy Who Cried Wolf
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) the people hear his sound.

### st-0169 — Rapunzel
- **A2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) the girl dropped her long hair down.
- **B2** (tekrar cumle: 50, ardisik ayni paragraf: 0): (2x) long ago, a young girl with long hair lived in a high tower. | (2x) she had no door, so she stayed inside all day long.

### st-0173 — The Nightingale
- **B2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) death sat near him while dark shadows filled the large room.

### st-0186 — How the Whale Got His Throat
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) the home stays in the part.

### st-0187 — The Cat That Walked by Himself
- **B1** (tekrar cumle: 20, ardisik ayni paragraf: 0): (2x) long ago, the world was wild and new. | (2x) all animals were wild, and each animal walked by himself.

### st-0209 — The Gingerbread Man
- **B2** (tekrar cumle: 7, ardisik ayni paragraf: 0): (2x) he ran past an old man who was working in the garden. | (2x) he made a loud sound that he was too fast for anyone.

### st-0212 — The Three Little Pigs
- **B1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) the second brother agreed.

### st-0215 — Witches' Loaves
- **B2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) she would not assume she knew what was best for them.

### st-0220 — The Man with the Twisted Lip
- **A2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) he worked in the city each day.

### st-0232 — The Secret Garden (tek epizod)
- **A1** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) he puts water on the land.
- **B2** (tekrar cumle: 1, ardisik ayni paragraf: 0): (2x) no other person came to this quiet corner of the world.

### st-0238 — Wind in the Willows: The Wild Wood (epizod)
- **A2** (tekrar cumle: 4, ardisik ayni paragraf: 0): (2x) his friends stayed close to him. | (2x) he looked at their faces.

### st-0252 — The Monkey's Heart
- **A1** (tekrar cumle: 9, ardisik ayni paragraf: 0): (2x) once, one little person lives near water. | (2x) a big person watches him every day.

### st-0255 — The Crane and the Crab
- **B1** (tekrar cumle: 7, ardisik ayni paragraf: 0): (2x) many animals lived near the water in that part of the world. | (2x) the pool was clear and full of life every single morning.

### st-0268 — Chicken Little (Henny Penny)
- **A1** (tekrar cumle: 3, ardisik ayni paragraf: 0): (2x) she lives in a small house. | (2x) she says the top is down.

### st-0271 — The Lion and the Statue
- **A2** (tekrar cumle: 20, ardisik ayni paragraf: 0): (2x) once, a man and a big animal walked along a road. | (2x) both people had great power.

## DESEN 5 — Kesik/eksik metin

Etkilenen: **1** hikaye.

### st-0215 — Witches' Loaves
- **C1** (1 cumle): … Martha's mouth went dry. "I-I only thought-"

