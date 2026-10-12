#!/usr/bin/env bash
# Launch the release exe as a brand-new user: the real app data is moved
# aside, and the exe runs from a folder with no .env ancestor. WebView2 opens
# a remote-debugging port so scripts/qa-drive.mjs can drive the real app.
#
#   bash scripts/qa-fresh-user.sh start     # fresh profile + launch
#   bash scripts/qa-fresh-user.sh restore   # ALWAYS run afterwards
#
# Nothing is deleted: the throwaway profile is moved to a timestamped folder.
set -euo pipefail
: "${APPDATA:?APPDATA must be set}"
: "${TEMP:?TEMP must be set}"
DATA="$APPDATA/com.quillpad.app"
BACKUP="$APPDATA/com.quillpad.app.qa-backup"
RUN_DIR="$TEMP/quillpad-qa"
PORT="${QA_PORT:-9223}"

case "${1:-}" in
  start)
    if [ -e "$BACKUP" ]; then echo "backup already exists — run restore first"; exit 1; fi
    if [ -e "$DATA" ]; then mv "$DATA" "$BACKUP"; fi
    mkdir -p "$RUN_DIR"
    cp src-tauri/target/release/quillpad.exe "$RUN_DIR/Quillpad.exe"
    (cd "$RUN_DIR" && WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$PORT" ./Quillpad.exe >/dev/null 2>&1 &)
    echo "fresh profile; app launching with CDP on :$PORT"
    ;;
  relaunch)
    taskkill //IM Quillpad.exe //F >/dev/null 2>&1 || true
    sleep 1
    (cd "$RUN_DIR" && WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$PORT" ./Quillpad.exe >/dev/null 2>&1 &)
    echo "relaunched (same fresh profile)"
    ;;
  restore)
    taskkill //IM Quillpad.exe //F >/dev/null 2>&1 || true
    sleep 1
    if [ -e "$DATA" ]; then mv "$DATA" "$TEMP/quillpad-qa-profile-$(date +%Y%m%d-%H%M%S)"; fi
    if [ -e "$BACKUP" ]; then mv "$BACKUP" "$DATA"; fi
    echo "real profile restored"
    ;;
  *)
    echo "usage: $0 start|relaunch|restore"
    exit 2
    ;;
esac
