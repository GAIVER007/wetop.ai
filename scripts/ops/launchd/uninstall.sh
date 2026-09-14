#!/usr/bin/env bash
# Снять задачи launchd сторожа процессов (см. install.sh). Без аргументов — все службы (оба варианта туннеля).
set -u
UID_N="$(id -u)"
NAMES=("$@")
[ ${#NAMES[@]} -eq 0 ] && NAMES=(api web tunnel domain awake)
for n in "${NAMES[@]}"; do
  label="kz.luxx.pms.$n"
  launchctl bootout "gui/$UID_N/$label" 2>/dev/null && echo "• $label снят" || echo "• $label не был загружен"
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done
