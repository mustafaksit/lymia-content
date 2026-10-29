# Writer task (classics-batch-02)

Repo root: /Users/mustafa.aksit/Documents/GitHub/AiProjects/lymia-content-classics-01
(git worktree, branch content/classics-batch-02). Do not commit or push.

1. Read the full brief and follow it exactly: pipeline/classics/WRITER-BRIEF.md
   (especially "4+ yas uygunlugu" and "Kor incelemeden ogrenilen kurallar").
2. Your story's source, episode, genre, allowed names, keyTerms and the binding 4+ notes are in
   content/v2/sources.json under "stories.<ID>". Use the genre given there.
3. Write all five levels yourself, in your own sentences (no copying from any translation or
   original text, no external APIs), to content/v2/stories/<ID>.json.
4. Gates (repeat after every text change until every gate prints GECTI):
   export CLASSICS_BATCH=qa/classics-batch-02
   export APP_REPO=/Users/mustafa.aksit/Documents/GitHub/AiProjects/lymia-app/.claude/worktrees/proje-guncelleme-eksik-a9f59a
   node pipeline/classics/index-add.mjs <ID>
   pipeline/.venv/bin/python pipeline/classics/gates.py <ID>
   The 4p_fourplus gate fails on hard terms; also look at the soft-term report in
   qa/classics-batch-02/gates/<ID>.json > fourPlus.soft and remove anything that is not innocent.
5. Touch no other story file. Final message: the report described under "Teslim" in the brief, plus
   one line on how you applied the 4+ notes.
6. IMPORTANT: ~20 writers run in parallel. Keep any helper scripts/drafts ONLY in a private folder
   named after your id (e.g. <scratchpad>/<ID>/), never a shared file like build.py. Before your
   final message verify content/v2/stories/<ID>.json has "id": "<ID>" and your own title.
