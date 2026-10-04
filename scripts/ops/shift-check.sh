#!/usr/bin/env bash
# Сверка смены в ноль: брони, деньги, остатки по ночам (двойная смена, plans/double-shift-2026-10-06.md).
#
#   scripts/ops/shift-check.sh [таблица.csv] [--date ГГГГ-ММ-ДД] [--from ЧЧ:ММ] [--to ЧЧ:ММ]
#
# Без файла таблица читается с клавиатуры: в Google Таблице выделить всё (Cmd+A), скопировать (Cmd+C), здесь
# вставить (Cmd+V) и нажать Ctrl+D. Без --date день смены сегодняшний по Алматы, без --to окно до текущей минуты.
#
# Сверяет API изнутри своего контейнера: служебный ключ и ключ Channex остаются в окружении контейнера, на хост не
# выходят. Журнал расхождений лежит на сервере вне клона: $SHIFT_DIR/<день>/discrepancies.csv (по умолчанию
# /root/wetop-shift). Новые расхождения дописываются туда же и печатаются строками для Google Таблицы. Таблица смены
# живёт на диске только пока идёт сверка: в ней могут быть имена гостей.
#
# Код выхода: 0 в ноль, 1 расхождения, 2 ошибка запуска, 3 расхождений нет, но сверено не всё.
# Для тестов и других стендов: COMPOSE (команда compose целиком), COMPOSE_FILE, SHIFT_DIR.
set -euo pipefail
umask 077

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHIFT_DIR="${SHIFT_DIR:-/root/wetop-shift}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO/deploy/compose.yml}"
# Наложение Hostinger, как у автовыкладки и ari.sh: без него exec найдёт не тот проект
COMPOSE_OVERLAY="$(dirname "$COMPOSE_FILE")/compose.hostinger.yml"
if [ -z "${COMPOSE:-}" ]; then
  COMPOSE="docker compose -f $COMPOSE_FILE"
  [ -f "$COMPOSE_OVERLAY" ] && COMPOSE="$COMPOSE -f $COMPOSE_OVERLAY"
fi
MARKER='#=== журнал расхождений ==='

fail() {
  echo "shift-check: $1" >&2
  exit 2
}

table=""
day=""
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --date | --from | --to)
      [ $# -ge 2 ] || fail "после $1 нужно значение"
      [ "$1" = --date ] && day="$2"
      args+=("$1" "$2")
      shift 2
      ;;
    -h | --help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    -*) fail "не знаю ключ $1 (есть --date, --from, --to)" ;;
    *)
      [ -z "$table" ] || fail "таблица одна, а передано два файла: $table и $1"
      table="$1"
      shift
      ;;
  esac
done

# День смены по Алматы (UTC+5 без перехода на летнее время, как confirmationNumber в @pms/domain)
[ -n "$day" ] || day="$(date -u -d '+5 hours' +%F 2>/dev/null || date -u -v+5H +%F)"
[[ "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "день смены: нужно ГГГГ-ММ-ДД, а не «$day»"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [ -n "$table" ]; then
  [ -r "$table" ] || fail "таблица не читается: $table"
  cp "$table" "$work/table"
else
  [ -t 0 ] && echo "Вставьте таблицу смены (в Google Таблице: выделить всё, скопировать) и нажмите Ctrl+D:" >&2
  cat >"$work/table"
fi
grep -q '[^[:space:]]' "$work/table" || fail "таблица смены пустая"

log_dir="$SHIFT_DIR/$day"
log="$log_dir/discrepancies.csv"
mkdir -p "$log_dir"
{
  cat "$work/table"
  printf '\n%s\n' "$MARKER"
  [ ! -f "$log" ] || cat "$log"
} >"$work/input"

set +e
# shellcheck disable=SC2086  # COMPOSE: команда со своими аргументами, разбиение по словам намеренное
$COMPOSE exec -T -w /app api node --import tsx scripts/reconciliation/src/cli-shift-check.ts \
  ${args[@]+"${args[@]}"} <"$work/input" >"$work/rows"
code=$?
set -e

if [ -s "$work/rows" ]; then
  cat "$work/rows" >>"$log"
  echo "журнал расхождений дописан: $log" >&2
else
  echo "журнал расхождений: $log (новых строк нет)" >&2
fi
exit "$code"
