#!/usr/bin/env bash
# Ночная уборка рабочих копий агента Hermes (решения владельца 18.10 и 19.10.2026). Ставится на сервер как
# /usr/local/sbin/hermes-workspace-prune, cron 15 3 * * *, журнал /var/log/hermes-workspace-prune.log (docs/deploy.md §1е).
#
# Hermes на том же сервере заводит копию проекта под каждую задачу и не удаляет её; диск доходил до 97 %, и вставала
# автовыкладка. Три шага:
#  1. Копии-репозитории (каталог первого уровня с .git), где HERMES_STALE_HOURS часов не менялся ни один файл вне .git
#     и где нет процессов Hermes, сохраняются в $HERMES_BACKUPS/workspace-<дата>/<копия> (бандл неотправленных веток
#     и отцепленного HEAD, tracked.patch, untracked.tgz, status.txt, head.txt) и удаляются: рабочее дерево через
#     `git worktree remove --force --force`, отдельный клон через rm. Не удалось сохранить, копия остаётся.
#     Никогда не трогаются: wetop-audit-main, клоны, к которым привязаны рабочие деревья, каталоги без .git
#     (*-pg, *-evidence) и репозитории глубже первого уровня.
#  2. В оставшихся копиях, простоявших HERMES_IDLE_MINUTES минут, убираются node_modules и .next* (пересобираются).
#  3. worktree prune, кэш сборки Docker, бэкапы workspace-* старше HERMES_BACKUP_DAYS дней.
#
#   hermes-workspace-prune.sh             убрать
#   hermes-workspace-prune.sh --dry-run   только показать, что убралось бы (ничего не пишет)
#
# HERMES_WORKSPACE      каталог копий (/srv/hermes/workspace)
# HERMES_USER           пользователь агента (hermes): его процессы защищают копию
# HERMES_MAIN           основной клон, никогда не удаляется (wetop-audit-main)
# HERMES_BACKUPS        куда сохранять копии перед удалением (/root/hermes-backups)
# HERMES_STALE_HOURS    сколько часов копия без изменений, чтобы её удалить (48)
# HERMES_IDLE_MINUTES   сколько минут без изменений, чтобы убрать кэши (360)
# HERMES_BACKUP_DAYS    сколько дней хранить бэкапы (30)
set -euo pipefail
ROOT="${HERMES_WORKSPACE:-/srv/hermes/workspace}"
AGENT="${HERMES_USER:-hermes}"
MAIN="${HERMES_MAIN:-wetop-audit-main}"
BACKUPS="${HERMES_BACKUPS:-/root/hermes-backups}"
STALE=$(( ${HERMES_STALE_HOURS:-48} * 60 ))
IDLE="${HERMES_IDLE_MINUTES:-360}"
KEEP_DAYS="${HERMES_BACKUP_DAYS:-30}"
DRY=0
[ "${1:-}" = --dry-run ] && DRY=1
cd "$ROOT"
# копии принадлежат hermes, а скрипт идёт от root; без optional locks git не перепишет индекс копии от root
g() { git -c safe.directory='*' --no-optional-locks "$@"; }
say() { echo "$([ "$DRY" = 1 ] && echo '[dry-run] ')$*"; }

# копии, где сейчас работает агент: рабочий каталог, открытый файл или аргументы процесса внутри копии
busy="$(for p in $(pgrep -u "$AGENT" 2>/dev/null || true); do
  readlink "/proc/$p/cwd" 2>/dev/null || true
  ls -l "/proc/$p/fd" 2>/dev/null || true
  tr '\0' '\n' 2>/dev/null < "/proc/$p/cmdline" || true
done | grep -o "$ROOT/[^/ ]*" | sed 's#.*/##' | sort -u || true)"
is_busy() { grep -qxF -- "$1" <<<"$busy"; }
# недавно менялся ли файл вне .git (и вне кэшей, если передан второй аргумент)
recent() {
  local skip=(-name .git)
  [ "${2:-}" = caches ] && skip+=(-o -name node_modules -o -name '.next*')
  [ -n "$(find "$1" -xdev \( "${skip[@]}" \) -prune -o -type f -mmin "-$3" -print -quit 2>/dev/null)" ]
}

# что из копии $1 может быть не отправлено: у рабочего дерева HEAD и его ветка (остальные ветки живут в основном
# клоне и не удаляются), у клона ещё и все ветки
refs_of() {
  local ref
  echo HEAD
  ref="$(g -C "$1" symbolic-ref -q HEAD || true)"
  [ -n "$ref" ] && echo "$ref"
  [ -d "$1/.git" ] && echo --branches
  return 0
}

# сохранить копию $1 (полный путь) в каталог $2; каждая ошибка возвращает 1 (set -e внутри `if` не действует)
backup() {
  local src="$1" dst="$2" refs r
  refs=(); while IFS= read -r r; do refs+=("$r"); done < <(refs_of "$src")
  mkdir -p "$dst" || return 1
  echo "$(basename "$src") $(g -C "$src" rev-parse HEAD) $(g -C "$src" symbolic-ref -q --short HEAD || true)" > "$dst/head.txt" || return 1
  if [ "$(g -C "$src" rev-list --count "${refs[@]}" --not --remotes)" -gt 0 ]; then
    g -C "$src" bundle create "$dst/unpushed.bundle" "${refs[@]}" --not --remotes 2>/dev/null || return 1
    g -C "$src" bundle verify "$dst/unpushed.bundle" >/dev/null 2>&1 || return 1
  fi
  g -C "$src" diff --binary HEAD > "$dst/tracked.patch" || return 1
  (cd "$src" && g ls-files -z --others --exclude-standard | tar --null -T - -czf "$dst/untracked.tgz") || return 1
  g -C "$src" status --short --branch > "$dst/status.txt" || return 1
}

# 1. несвежие копии-репозитории
day="$BACKUPS/workspace-$(date -u +%Y%m%d)"
mains=("$ROOT/$MAIN")
removed=0
gone=""
for dir in "$ROOT"/*/; do
  copy="$(basename "$dir")"
  path="$ROOT/$copy"
  [ -e "$path/.git" ] || continue
  [ "$copy" = "$MAIN" ] && continue
  if is_busy "$copy"; then say "занята процессом $AGENT: $copy"; continue; fi
  if recent "$path" "" "$STALE"; then continue; fi
  if [ -d "$path/.git" ]; then
    kind=клон
    if [ -n "$(ls -A "$path/.git/worktrees" 2>/dev/null)" ]; then say "к клону привязаны рабочие деревья, оставлен: $copy"; continue; fi
  else
    kind="рабочее дерево"
    owner="$(dirname "$(g -C "$path" rev-parse --path-format=absolute --git-common-dir)")"
  fi
  dst="$day/$copy"
  [ -e "$dst" ] && dst="$dst-$(date -u +%H%M%S)"
  size="$(du -xsm "$path" | cut -f1)"
  if [ "$DRY" = 1 ]; then
    refs=(); while IFS= read -r r; do refs+=("$r"); done < <(refs_of "$path")
    unpushed="$(g -C "$path" rev-list --count "${refs[@]}" --not --remotes 2>/dev/null || echo '?')"
    changed="$(g -C "$path" status --porcelain 2>/dev/null | wc -l)"
    say "удалилась бы ($kind, ${size} МБ, неотправленных коммитов $unpushed, изменённых файлов $changed): $copy → $dst"
    removed=$((removed + size)); gone+="$copy"$'\n'; continue
  fi
  if ! backup "$path" "$dst"; then
    echo "не удалось сохранить, копия оставлена: $copy"; continue
  fi
  if [ "$kind" = клон ]; then
    rm -rf -- "$path"
  else
    g -C "$owner" worktree remove --force --force "$path" || { echo "worktree remove не прошёл: $copy"; continue; }
    mains+=("$owner")
  fi
  echo "удалена ($kind, ${size} МБ), сохранена в $dst: $copy"
  removed=$((removed + size))
done
[ "$DRY" = 1 ] || for m in $(printf '%s\n' "${mains[@]}" | sort -u); do g -C "$m" worktree prune || true; done

# 2. кэши в оставшихся копиях
freed=0
while IFS= read -r cache; do
  copy="${cache#./}"
  copy="${copy%%/*}"
  is_busy "$copy" && continue
  grep -qxF -- "$copy" <<<"$gone" && continue
  # недавность только по файлам вне кэшей: сама уборка меняет даты каталогов
  recent "$copy" caches "$IDLE" && continue
  size="$(du -xsk "$cache" | cut -f1)"
  if [ "$DRY" = 1 ]; then
    echo "убралось бы: $cache (${size} КБ)"
  else
    rm -rf -- "$cache"
    echo "убрано: $cache (${size} КБ)"
  fi
  freed=$((freed + size))
done < <(find . -xdev -mindepth 2 -maxdepth 5 -type d \( -name node_modules -o -name .next -o -name '.next-*' \) -prune -print)

# 3. Docker и старые бэкапы
[ "$DRY" = 1 ] || docker builder prune -f >/dev/null 2>&1 || true
while IFS= read -r old; do
  say "старый бэкап удалён: $old"
  [ "$DRY" = 1 ] || rm -rf -- "$old"
done < <(find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -name 'workspace-*' -mtime "+$KEEP_DAYS" 2>/dev/null)

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) hermes-workspace-prune: $([ "$DRY" = 1 ] && echo 'убралось бы' || echo 'освобождено') копии $removed МБ, кэши $((freed / 1024)) МБ"
