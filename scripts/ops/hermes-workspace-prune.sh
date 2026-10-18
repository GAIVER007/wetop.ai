#!/usr/bin/env bash
# Ночная уборка пересобираемых кэшей в рабочих копиях агента Hermes (решение владельца 18.10.2026).
#
# Hermes на том же сервере заводит копию проекта под каждую задачу и не удаляет её; за двое суток копий стало больше
# сотни, диск дважды подходил к 97 % и вставала автовыкладка. Скрипт убирает только то, что пересобирается одной
# установкой зависимостей: папки node_modules и .next* в копиях, где ни один файл не менялся HERMES_IDLE_MINUTES
# минут и где сейчас нет процессов Hermes (рабочий каталог или открытый файл). Исходники, .git, отчёты, базы и
# сами копии не трогает. Затем чистит неиспользуемый кэш сборки Docker.
#
#   hermes-workspace-prune.sh             убрать
#   hermes-workspace-prune.sh --dry-run   только показать, что убралось бы
#
# HERMES_WORKSPACE      каталог копий (/srv/hermes/workspace)
# HERMES_USER           пользователь агента (hermes): его процессы защищают копию
# HERMES_IDLE_MINUTES   сколько минут копия должна простоять без изменений файлов (360)
set -euo pipefail
ROOT="${HERMES_WORKSPACE:-/srv/hermes/workspace}"
AGENT="${HERMES_USER:-hermes}"
IDLE="${HERMES_IDLE_MINUTES:-360}"
DRY=0
[ "${1:-}" = --dry-run ] && DRY=1
cd "$ROOT"

# копии, где сейчас работает агент: его рабочий каталог или открытый файл внутри копии
busy="$(for p in $(pgrep -u "$AGENT" 2>/dev/null || true); do
  readlink "/proc/$p/cwd" 2>/dev/null || true
  ls -l "/proc/$p/fd" 2>/dev/null || true
done | grep -o "$ROOT/[^/ ]*" | sed 's#.*/##' | sort -u || true)"

freed=0
while IFS= read -r cache; do
  copy="${cache#./}"
  copy="${copy%%/*}"
  grep -qxF -- "$copy" <<<"$busy" && continue
  # недавность только по файлам вне кэшей: сама уборка меняет даты каталогов
  [ -z "$(find "$copy" -xdev -type f -mmin "-$IDLE" -not -path '*/node_modules/*' -not -path '*/.next*' -print -quit 2>/dev/null)" ] || continue
  size="$(du -xsk "$cache" | cut -f1)"
  if [ "$DRY" = 1 ]; then
    echo "убралось бы: $cache (${size} КБ)"
  else
    rm -rf -- "$cache"
    echo "убрано: $cache (${size} КБ)"
  fi
  freed=$((freed + size))
done < <(find . -xdev -mindepth 2 -maxdepth 5 -type d \( -name node_modules -o -name .next -o -name '.next-*' \) -prune -print)

[ "$DRY" = 1 ] || docker builder prune -f >/dev/null 2>&1 || true
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) hermes-workspace-prune: $([ "$DRY" = 1 ] && echo 'убралось бы' || echo 'освобождено') $((freed / 1024)) МБ"
