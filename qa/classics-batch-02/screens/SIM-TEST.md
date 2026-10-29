# Classics batch-02: Simulator test (2026-10-29)

Device: iPhone 16 Pro sim, iOS 18.5 (0C044F90-4E3D-4052-96F7-753DF20B369A). Dev build on Metro :8082. Content: http://localhost:8787/content (app reads `/content/v2`).
Procedure per row: deep link `lymia://story/<id>/read?level=<L>` → check the title and level chip → "Sesi indir" → play → after about 3–5 s confirm a karaoke highlight in sentence 1 and that the control shows pause → pause.
Screenshots: `<id>-<LEVEL>.png` in this folder.

## Reader + audio (40/40 PASS)

| id | level | result | note |
|---|---|---|---|
| st-0283 | A1 | PASS | Three Musketeers; highlight on 'He', audio playing (pause shown) |
| st-0283 | A2 | PASS | highlight on 'eighteen', audio playing |
| st-0283 | B1 | PASS | highlight on 'proud', audio playing |
| st-0283 | B2 | PASS | highlight on 'spring', audio playing |
| st-0283 | C1 | PASS | highlight on 'April', audio playing |
| st-0292 | A1 | PASS | Hound of the Baskervilles; highlight on 'Holmes', audio playing |
| st-0292 | A2 | PASS | highlight on 'Sherlock', audio playing |
| st-0292 | B1 | PASS | highlight on 'and', audio playing |
| st-0292 | B2 | PASS | highlight on 'autumn', audio playing |
| st-0292 | C1 | PASS | highlight on 'morning', audio playing |
| st-0298 | A1 | PASS | Pride and Prejudice; highlight on 'Mr', audio playing |
| st-0298 | A2 | PASS | highlight on 'Mr', audio playing |
| st-0298 | B1 | PASS | highlight on 'Mr', audio playing |
| st-0298 | B2 | PASS | highlight on 'and', audio playing |
| st-0298 | C1 | PASS | highlight on 'Longbourn', audio playing |
| st-0305 | A1 | PASS | Black Beauty; highlight on 'horse', audio playing |
| st-0305 | A2 | PASS | highlight on 'name', audio playing |
| st-0305 | B1 | PASS | highlight on 'name', audio playing |
| st-0305 | B2 | PASS | highlight on 'name', audio playing |
| st-0305 | C1 | PASS | highlight on 'name', audio playing |
| st-0309 | A1 | PASS | Five Weeks in a Balloon; highlight on 'Samuel', audio playing |
| st-0309 | A2 | PASS | highlight on 'Doctor', audio playing |
| st-0309 | B1 | PASS | highlight on 'Doctor', audio playing |
| st-0309 | B2 | PASS | highlight on 'One', audio playing |
| st-0309 | C1 | PASS | highlight on 'cold', audio playing |
| st-0313 | A1 | PASS | King Midas and the Golden Touch; highlight on 'Midas', audio playing |
| st-0313 | A2 | PASS | highlight on 'ago', audio playing |
| st-0313 | B1 | PASS | highlight on 'ago', audio playing |
| st-0313 | B2 | PASS | highlight on 'upon', audio playing |
| st-0313 | C1 | PASS | highlight on 'once', audio playing |
| st-0318 | A1 | PASS | Nutcracker and the Mouse King; highlight on 'was', audio playing |
| st-0318 | A2 | PASS | highlight on 'Christmas', audio playing |
| st-0318 | B1 | PASS | highlight on 'Christmas', audio playing |
| st-0318 | B2 | PASS | highlight on 'Christmas', audio playing |
| st-0318 | C1 | PASS | highlight on 'Christmas', audio playing |
| st-0322 | A1 | PASS | Five Children and It; highlight on 'children', audio playing |
| st-0322 | A2 | PASS | highlight on 'children', audio playing |
| st-0322 | B1 | PASS | highlight on 'summer', audio playing |
| st-0322 | B2 | PASS | highlight on 'summer', audio playing |
| st-0322 | C1 | PASS | highlight on 'children', audio playing |

In every row the highlight is on word 2 (or word 1) of sentence 1, and the text differs per level as expected (no level shows another level's text). Every download finished in under 1 s from localhost.

## Quiz (3/3 PASS)

| file | result | note |
|---|---|---|
| quiz-st-0298-A2.png | PASS | 3 questions (Pride and Prejudice) → "Test sonucu" result screen, 3/3, +45 XP |
| quiz-st-0313-B2.png | PASS | 3 questions (Midas) → result screen 3/3, +45 XP |
| quiz-st-0322-C1.png | PASS | 3 questions (Psammead) → result screen 3/3, +45 XP |

## Library search: PASS after relaunch (library-search.png)

- First attempt failed: the app had been running since 16:11 with the 210-story catalog in memory. `fetchIndex` runs only at startup or on reconnect, and contentVersion was deliberately left at 25.
- Retest (coordinator, 22:21): terminated and relaunched the app (`xcrun simctl terminate/launch` + dev-client URL). The app re-fetched `content/v2/index.json` (250 stories). Searching "Musketeers" shows "The Three Musketeers and the..." with the "Yeni" badge and the book placeholder (cover pending), with no wrong cover. The field shows the text twice because the simulator's text tool pasted twice; that is a test-harness artifact.
- Conclusion: no app bug. New stories appear after a cold start. In production the contentVersion bump at publish handles the cache.

## Other notes

- The simulator tool's `text` action pastes via the clipboard. It opened an iOS edit menu (Yapıştır/Otomatik Doldur, i.e. Paste/AutoFill), but no permission alert appeared. After that, all typing was done by tapping on-screen keyboard keys.
- When the search query changes, the empty state briefly flashes before results arrive (debounce). This is cosmetic: an empty query showed "Burada henüz hikaye yok" for about 1 s before cards appeared.
