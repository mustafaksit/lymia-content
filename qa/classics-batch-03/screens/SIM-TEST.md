# Classics batch-03: Simulator test (2026-10-30)

Device: iPhone 16 Pro sim, iOS 18.5 (0C044F90-4E3D-4052-96F7-753DF20B369A). Dev build `com.mustafaaksit.lymia` 1.1.3. Content: http://localhost:8787/content (app reads `/content/v2`, audio from `/content/audio`).
Procedure per row: `lymia:///` → deep link `lymia://story/<id>/read?level=<L>` → check the title and level chip → "Sesi indir" (88,817) → play (101,817) → about 1–2 s later confirm a karaoke highlight in sentence 1 and that the control shows pause (screenshot) → pause.
Screenshots: `<id>-<LEVEL>.png` in this folder. The http server log confirmed each row's `audio/<lvl>/<id>.mp3` + `.timings.json` → 200.

## Setup note (important)

- The running Metro :8082 (main checkout, `release/1.1` @ 0773e79) has no `EXPO_PUBLIC_CONTENT_ROOT` override, so the app was reading the **jsDelivr CDN**. st-0323 was empty on first open (no story on the CDN yet). The http log showed only `index.json` / `v2/stories/st-0323.json` calls from earlier sessions.
- Fix (no app/content source changed): extracted `fix/1.2-story-card-cover-recycling` (includes the content root override, 80c1caf) to the scratchpad with `git archive`, using the `node_modules` from the `proje-guncelleme-eksik-a9f59a` worktree (1.1.3 deps match: sentry, notifications, …). Started **Metro :8083** with `EXPO_PUBLIC_CONTENT_ROOT=http://localhost:8787/content`. The sim's `RCT_jsLocation` was temporarily set to `localhost:8083` and **restored to `localhost:8082`** after the test.
- After that every request went to localhost:8787 (index, stories, audio, timings, covers).

## Reader + audio (50/50 PASS)

| id | level | result | note |
|---|---|---|---|
| st-0323 | A1 | PASS | Swiss Family Robinson; highlight on 'mother' (sentence 2; see note), pause shown |
| st-0323 | A2 | PASS | highlight on 'their', pause shown |
| st-0323 | B1 | PASS | highlight on 'family', pause shown |
| st-0323 | B2 | PASS | highlight on 'sold', pause shown |
| st-0323 | C1 | PASS | highlight on 'months', pause shown |
| st-0327 | A1 | PASS | William Tell; highlight on 'Switzerland', pause shown |
| st-0327 | A2 | PASS | highlight on 'Tell', pause shown |
| st-0327 | B1 | PASS | highlight on 'Switzerland', pause shown |
| st-0327 | B2 | PASS | highlight on 'mountains', pause shown |
| st-0327 | C1 | PASS | highlight on 'Switzerland', pause shown |
| st-0332 | A1 | PASS | A Case of Identity; highlight on 'Street', pause shown |
| st-0332 | A2 | PASS | highlight on 'sat', pause shown |
| st-0332 | B1 | PASS | highlight on 'Sherlock', pause shown |
| st-0332 | B2 | PASS | highlight on 'sitting', pause shown |
| st-0332 | C1 | PASS | highlight on 'no', pause shown |
| st-0338 | A1 | PASS | The Stolen Bacillus; highlight on 'and', pause shown |
| st-0338 | A2 | PASS | highlight on 'London', pause shown |
| st-0338 | B1 | PASS | highlight on 'quiet', pause shown |
| st-0338 | B2 | PASS | highlight on 'tall', pause shown |
| st-0338 | C1 | PASS | highlight on 'his', pause shown |
| st-0341 | A1 | PASS | Northanger Abbey; highlight on 'years', pause shown |
| st-0341 | A2 | PASS | highlight on 'years', pause shown |
| st-0341 | B1 | PASS | highlight on 'old', pause shown |
| st-0341 | B2 | PASS | highlight on 'seventeen', pause shown |
| st-0341 | C1 | PASS | highlight on 'seventeen', pause shown |
| st-0364 | A1 | PASS | King Thrushbeard; highlight on 'princess', pause shown |
| st-0364 | A2 | PASS | highlight on 'princess', pause shown |
| st-0364 | B1 | PASS | highlight on 'who', pause shown |
| st-0364 | B2 | PASS | highlight on 'beauty', pause shown |
| st-0364 | C1 | PASS | highlight on 'more', pause shown |
| st-0365 | A1 | PASS | The Swineherd; highlight on 'country', pause shown |
| st-0365 | A2 | PASS | highlight on 'small', pause shown |
| st-0365 | B1 | PASS | highlight on 'a' ("who had a"), pause shown |
| st-0365 | B2 | PASS | highlight on 'kingdom', pause shown |
| st-0365 | C1 | PASS | highlight on 'little', pause shown |
| st-0368 | A1 | PASS | Diamonds and Toads; highlight on 'girls', pause shown |
| st-0368 | A2 | PASS | highlight on 'daughters', pause shown |
| st-0368 | B1 | PASS | highlight on 'with', pause shown |
| st-0368 | B2 | PASS | highlight on 'daughters', pause shown |
| st-0368 | C1 | PASS | highlight on 'daughters', pause shown |
| st-0370 | A1 | PASS | The Bamboo Cutter's Daughter; highlight on 'his', pause shown |
| st-0370 | A2 | PASS | highlight on 'and', pause shown |
| st-0370 | B1 | PASS | highlight on 'lived', pause shown |
| st-0370 | B2 | PASS | highlight on 'lived', pause shown |
| st-0370 | C1 | PASS | highlight on 'at', pause shown |
| st-0372 | A1 | PASS | The Frog Princess; highlight on 'sons', pause shown |
| st-0372 | A2 | PASS | highlight on 'with', pause shown |
| st-0372 | B1 | PASS | highlight on 'had', pause shown |
| st-0372 | B2 | PASS | highlight on 'ago', pause shown |
| st-0372 | C1 | PASS | highlight on 'certain', pause shown |

The title and level chip were correct in all 50 rows. The text differs per level as expected (no level shows another level's text). Every download finished in under 1 s from localhost, with no errors.

Note on st-0323 A1: in the first attempt the screenshot was taken about 4 s after play, and the highlight was on 'had' in **sentence 3** (A1 sentences are short, so playback had passed sentence 1). After a back-skip and replay, the highlight on 'mother' in sentence 2 ("The family had a father, a mother and four sons") was captured in sync with the audio. This is a timing issue only, not a sync bug. For all other rows the screenshot was taken about 1–2 s after play, and the highlight is on word 2–7 of sentence 1.

## Quiz (3/3 PASS)

| file | result | note |
|---|---|---|
| quiz-st-0327-A2.png | PASS | "Hikayeyi bitirdim" (I finished the story) → "3 soruluk mini test" (3-question mini test) → "Test sonucu" (test result) **2/3, +20 XP**. Q1 "Bow to his hat" was marked correct (teal). Q2 was **deliberately answered wrong** with "Gessler": red outline, and the correct "Walter" was highlighted (text: Walter says "I know you can do it."). Q3 "The men could not control the boat" was marked correct (text: "Gessler's men could not control the boat. So Gessler told his men to free Tell's hands."). The marking matches the text. |
| quiz-st-0365-B2.png | PASS | 3/3, **+45 XP**. Q1 "He cried like a child" (text: "...sang so sweetly that the old Emperor cried like a child"). Q2 "Ten kisses from her ladies" (text: "Ask him if he will take ten kisses from my ladies instead"). Q3 "The swineherd looked so splendid as a prince" (text: "...looking so splendid that the princess had to curtsy"). All marked correct and all match the text. |
| quiz-st-0372-C1.png | PASS | 3/3, **+45 XP**. Q1 "She was born wiser than he was" (text: "Vasilisa was born wiser than Koschei ... turned her into a frog"). Q2 "The egg" (the pike brought "the egg held gently in its mouth"). Q3 "It should be used only on great feast days" (text: "shall be spread out only on the greatest of feast days"). All marked correct and all match the text. |

- I checked the answer keys of all 9 questions against the level text in `content/v2/stories/<id>.json`: all are correct, and the distractors do not appear in the text.
- Correct-answer fill color = level color (A2 teal, B2 purple, C1 pink). Wrong = red outline + the correct option highlighted.
- The first "Hikayeyi bitirdim" showed a "Günlük hatırlatma ister misin?" (Want a daily reminder?) sheet; I answered "Şimdi değil" (Not now, so no setting changed).
- The cover area on the result card is empty (cover pending), consistent with the batch's covers being `-pending`.

## Library search: PASS (library-search.png)

- The "Kütüphane" (Library) tab was opened with `lymia:///library`. Searching "Swineherd" → one result: **The Swineherd**, "Yeni" (New) badge, Klasik · 3 dk, book placeholder (cover pending, no wrong cover).
- The new catalog was loaded at the earlier cold start (Metro 8083 + override), so no extra relaunch was needed to fix stale catalog data.
- However, after the third quiz (st-0372 C1 result screen → `lymia:///` → `lymia:///library`), **touch input stopped working**. Taps on the tab bar, search field and chips, and swipes on the grid, produced no response. Deep-link navigation still worked. After terminate/launch and the dev-client URL, touch worked again and the search was done. I could not tell whether this was an app bug (for example a transparent overlay left on screen after the result screen) or a simulator input glitch. **Worth reproducing**: quiz result screen → leave via deep link → try to tap.

## Other notes

- The "Open debugger to view warnings" toast appears after launch (dev build; the warning is "Sentry.wrap was called before Sentry.init"). It is not an app error.
- A 404 for `covers/<id>-pending.webp` is expected (covers not imported yet). StoryCard shows the placeholder.
- Metro :8083 (scratchpad) is still running. The app's current session uses it. `RCT_jsLocation` was restored to 8082, so the next launch goes to 8082.
