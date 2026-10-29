#!/bin/bash
# Vocab v2 otomatik sürücü (bekçi). Gemini günlük kotası açıldığında (LaunchAgent
# ~10:15 TR, uyanışta da) B'yi tamamlar, sonra C->D->E (full build) ve validate.py.
# Kilitli + resumable + loglu. Bitince .vocab-complete bayrağı -> sonraki koşular no-op.
# Manuel de çalıştırılabilir:  bash pipeline/vocab/auto-run.sh
set -u
REPO="/Users/mustafa.aksit/Documents/AiProjects/lymia-content"
NODE="/opt/homebrew/bin/node"
PY="$REPO/pipeline/vocab/.venv-vocab/bin/python"
cd "$REPO" || exit 1
CACHE="$REPO/pipeline/vocab/cache"
LOG="$CACHE/auto-run.log"
LOCK="$CACHE/.auto-run.lock"
DONE="$CACHE/.vocab-complete"

exec >> "$LOG" 2>&1
echo "==== $(date '+%F %T %Z') auto-run ===="
[ -f "$DONE" ] && { echo "zaten tamam (.vocab-complete) -> çık"; exit 0; }
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "kilit aktif ($(cat "$LOCK")) -> zaten çalışıyor, çık"; exit 0
fi
echo $$ > "$LOCK"; trap 'rm -f "$LOCK"' EXIT

cnt() { ls "$CACHE/stage-B" 2>/dev/null | wc -l | tr -d ' '; }

# --- Faz 1: Aşama B'yi tamamla (kota bitince çıkar, cache korunur) ---
before=$(cnt)
"$NODE" pipeline/vocab/build-vocab.mjs build --all --only-b --probe
after=$(cnt)
none=$("$NODE" -e 'try{const s=JSON.parse(require("fs").readFileSync(process.argv[1]));process.stdout.write(String(s.senseDist&&s.senseDist.none!=null?s.senseDist.none:1))}catch(e){process.stdout.write("1")}' "$CACHE/b-stats.json")
echo "B fazı: cache $before -> $after ; none=$none"
if [ "$none" != "0" ] && [ "$after" -gt "$before" ]; then
  echo "B eksik ama bu pencerede ilerledi (kota) -> sonraki pencerede devam"; exit 0
fi
# none>0 ama ilerleme yok = ya kota hiç yoktu (full build de kotada düşer, sorun değil)
# ya da kalanlar genuine-null. Her iki halde full pipeline'a geçmek güvenli.

# --- Faz 2: full pipeline (B cache -> C -> D -> E) ---
"$NODE" pipeline/vocab/build-vocab.mjs build --all; rc=$?
echo "full build rc=$rc"
[ "$rc" != "0" ] && { echo "full build başarısız (kota olabilir) -> sonraki pencere"; exit 0; }

# --- Faz 3: doğrulama ---
"$PY" pipeline/vocab/validate.py; echo "validate rc=$?"

touch "$DONE"
echo "==== $(date '+%F %T') VOCAB TAMAM -> .vocab-complete ===="
