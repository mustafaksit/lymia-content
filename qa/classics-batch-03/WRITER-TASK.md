# Writer task (classics-batch-03)

Repo root: /Users/mustafa.aksit/Documents/GitHub/AiProjects/lymia-content-classics-01
(git worktree, branch content/classics-batch-03). Do not commit or push.

1. Read the full brief and follow it exactly: pipeline/classics/WRITER-BRIEF.md
   (especially "4+ yas uygunlugu", "Kor incelemeden ogrenilen kurallar" and the new
   "4c cekirdek kapsam" rule).
2. Your story's source, episode, genre, allowed names, keyTerms and the binding 4+ notes are in
   content/v2/sources.json under "stories.<ID>". Use the genre and the title given there exactly.
3. Write all five levels yourself, in your own sentences (no copying from any translation or
   original text, no external APIs), to content/v2/stories/<ID>.json.
4. A1-A2 vocabulary (NEW, a hard gate in this batch): apart from proper names and the first five
   keyTerms in sources.json, every word in A1 must come from NGSL-500 (+ supplemental list) and
   every word in A2 from NGSL-1000. Targets: A1 core >= 0.92, A2 core >= 0.95 (gate 4c). The lists
   are wordlists/ngsl-500.txt, wordlists/ngsl-1000.txt and wordlists/ngsl-supplemental.txt; check
   rarer words against them while drafting. When 4c fails, its message lists the off-list words
   with counts: replace each with a listed simple word or rebuild the sentence. Keep the English
   natural: a real A1 learner must be able to follow every sentence without a dictionary.
5. Gates (repeat after every text change until every gate prints GECTI):
   export CLASSICS_BATCH=qa/classics-batch-03
   export APP_REPO=/Users/mustafa.aksit/Documents/GitHub/AiProjects/lymia-app
   node pipeline/classics/index-add.mjs <ID>
   pipeline/.venv/bin/python pipeline/classics/gates.py <ID>
   The 4p_fourplus gate fails on hard terms; also look at the soft-term report in
   qa/classics-batch-03/gates/<ID>.json > fourPlus.soft and remove anything that is not innocent.
6. Touch no other story file. Final message: the report described under "Teslim" in the brief, plus
   one line on how you applied the 4+ notes and the final A1/A2 core coverage values.
7. IMPORTANT: several writers run in parallel. Keep any helper scripts/drafts ONLY in a private
   folder named after your id (e.g. <scratchpad>/<ID>/), never a shared file like build.py. Before
   your final message verify content/v2/stories/<ID>.json has "id": "<ID>" and the exact title
   from sources.json.
8. Use plain ASCII letters in the story text: write "Skane", "Arsene", "Utgard" (no å, è, ö). Karaoke counts
   only [A-Za-z] tokens, so an accented letter splits one word into two and breaks the highlight.
