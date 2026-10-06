#!/usr/bin/env bash
# Восстановление рабочей базы из копии: ступень 2 отката (CUTOVER.md, «Откат»; ADR-137). Запускает только владелец.
#
#   scripts/ops/db-restore-prod.sh <копия wetop-….dump> --yes-replace-production
#
# Заменяет схему public рабочей базы содержимым копии db-backup.sh: всё, что записано после копии, пропадает. Перед
# запуском: стойка в ручном режиме, API и web остановлены, свежая копия повреждённой базы снята ($BACKUP).
#
# Почему не просто pg_restore (проверено на копии схемы 02.10.2026, reports/mentor-review-2026-10-02/):
#   1. копия начинается с CREATE SCHEMA public, а схема в базе есть: эти записи оглавления пропускаются;
#   2. копия снята без прав (--no-privileges), а таблицы при восстановлении создаются заново и получают права
#      по умолчанию: роль стойки wetop_app получала бы полный доступ к users (хеши паролей), password_resets,
#      channel_outbox и ещё семи таблицам, то есть откат молча снимал бы SEC-1b (286 лишних прав). Поэтому после
#      данных повторяются по порядку все миграции, которые выдают или отзывают права (в тексте вне комментариев
#      есть GRANT или REVOKE): они повторяемы, и итоговые права совпадают с рабочими до последнего столбца.
# Данные и права идут ОДНОЙ транзакцией: упало что угодно, и база осталась как была.
#
# RESTORE_DATABASE_URL  куда восстанавливать; иначе BACKUP_DATABASE_URL, DIRECT_URL, DATABASE_URL из окружения или
#                       ENV_FILE (.env корня), как в db-backup.sh. Нужна роль владельца таблиц (postgres), не wetop_app
# RESTORE_MIGRATIONS_DIR  папка миграций (packages/database/prisma/migrations клона): из неё берутся миграции прав
# На сервере без клиента PostgreSQL скрипт запускают в образе postgres:17 (docs/ops/backups.md, «Восстановление»).
set -euo pipefail
export PATH="${PATH:+$PATH:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
MIGRATIONS="${RESTORE_MIGRATIONS_DIR:-$ROOT/packages/database/prisma/migrations}"

fail() {
  echo "db-restore-prod: $1" >&2
  exit "${2:-1}"
}

dump="${1:-}"
[ -n "$dump" ] || fail "какую копию: scripts/ops/db-restore-prod.sh <wetop-….dump> --yes-replace-production" 2
[ "${2:-}" = --yes-replace-production ] ||
  fail "рабочая база будет заменена копией $(basename "$dump"), всё записанное после неё пропадёт. Подтверждение: второй аргумент --yes-replace-production" 2
[ -r "$dump" ] || fail "копия не читается: $dump" 2
[ -d "$MIGRATIONS" ] || fail "нет папки миграций $MIGRATIONS (RESTORE_MIGRATIONS_DIR)" 2

# Значение ключа из .env без вывода на экран, как в db-backup.sh
env_value() {
  [ -f "$ENV_FILE" ] || return 0
  local line
  line="$(grep -E "^(export[[:space:]]+)?$1=" "$ENV_FILE" | tail -n 1 || true)"
  [ -n "$line" ] || return 0
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

url="${RESTORE_DATABASE_URL:-}"
[ -n "$url" ] || url="${BACKUP_DATABASE_URL:-}"
[ -n "$url" ] || url="$(env_value BACKUP_DATABASE_URL)"
[ -n "$url" ] || url="$(env_value DIRECT_URL)"
[ -n "$url" ] || url="$(env_value DATABASE_URL)"
[ -n "$url" ] || fail "нет строки подключения: RESTORE_DATABASE_URL или BACKUP_DATABASE_URL / DIRECT_URL в $ENV_FILE" 2

# Параметры Prisma, которых не понимает libpq, срезаются (как в db-backup.sh)
if [[ "$url" == *\?* ]]; then
  query="$(printf '%s' "${url#*\?}" | tr '&' '\n' |
    grep -vE '^(pgbouncer|connection_limit|pool_timeout|schema|statement_cache_size|socket_timeout)=' | paste -sd '&' - || true)"
  url="${url%%\?*}${query:+?$query}"
fi

# Пароль не аргументом, а в PGPASSWORD (аргументы процесса видит любой через `ps`), как в db-backup.sh
conn="$url"
export PGPASSWORD=""
if [[ "$url" =~ ^([A-Za-z][A-Za-z0-9+.-]*://[^:/@]+):([^@]*)@(.*)$ ]]; then
  conn="${BASH_REMATCH[1]}@${BASH_REMATCH[3]}"
  raw="${BASH_REMATCH[2]//\\/\\\\}"
  PGPASSWORD="$(printf '%b' "${raw//%/\\x}")"
fi

command -v pg_restore >/dev/null && command -v psql >/dev/null ||
  fail "нужны pg_restore и psql 17: на сервере запускать в образе postgres:17 (docs/ops/backups.md)" 2

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mask() { sed -E 's#(://[^:/@[:space:]]*:)[^@[:space:]]*@#\1***@#g' "$1" >&2; }

pg_restore --list "$dump" >"$work/toc" 2>"$work/err" || {
  mask "$work/err"
  fail "это не копия pg_dump в формате custom: $(basename "$dump")"
}
tables="$(grep -c ' TABLE DATA ' "$work/toc" || true)"
[ "${tables:-0}" -gt 0 ] || fail "в копии нет ни одной таблицы с данными: восстанавливать нечего" 1
grep -vE ' SCHEMA - public | COMMENT - SCHEMA public ' "$work/toc" >"$work/list"

# Миграции прав: повторно выполняются только чистые миграции прав. Смешанную schema-миграцию
# с CREATE/ALTER/DROP и встроенным GRANT нельзя запускать после pg_restore: объекты уже восстановлены из копии.
# Отступ внутри DO-блока отличает вложенный DDL от верхнеуровневого DDL миграции.
regrants=()
while IFS= read -r file; do
  regrants+=("$file")
done < <(find "$MIGRATIONS" -mindepth 2 -maxdepth 2 -name migration.sql | sort |
  while IFS= read -r f; do
    body="$(grep -vE '^[[:space:]]*--' "$f")"
    printf '%s\n' "$body" | grep -qwE 'GRANT|REVOKE' || continue
    printf '%s\n' "$body" | grep -qE '^(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)[[:space:]]' && continue
    printf '%s\n' "$f"
  done)
[ "${#regrants[@]}" -gt 0 ] || fail "в $MIGRATIONS нет ни одной миграции прав: не та папка" 2

# Одна транзакция: данные копии (с удалением прежних объектов), затем права. ON_ERROR_STOP откатывает всё.
{
  pg_restore --clean --if-exists --no-owner --no-privileges --use-list="$work/list" --file=- "$dump"
  # pg_restore обнуляет search_path, а миграции прав берут схему из current_schema()
  printf '\nSET search_path TO public;\n'
  for f in "${regrants[@]}"; do
    printf '\n-- права: %s\n' "$(basename "$(dirname "$f")")"
    cat "$f"
    printf '\n'
  done
} >"$work/restore.sql" 2>"$work/err" || {
  mask "$work/err"
  fail "pg_restore не прочитал копию: рабочая база не тронута"
}

if ! psql "$conn" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$work/restore.sql" >/dev/null 2>"$work/err"; then
  mask "$work/err"
  fail "восстановление не прошло и откатилось целиком: рабочая база как была (сообщение выше)" 1
fi

# Проверка после: роль стойки не видит хешей паролей, число таблиц с данными как в копии
check="$(psql "$conn" -X -At -v ON_ERROR_STOP=1 -c "SELECT
  CASE WHEN to_regrole('wetop_app') IS NULL OR to_regclass('public.users') IS NULL THEN 'нет'
       WHEN has_table_privilege('wetop_app', 'public.users', 'SELECT') THEN 'открыто'
       ELSE 'закрыто' END" 2>"$work/err")" || {
  mask "$work/err"
  fail "данные восстановлены, но проверка прав не выполнилась: API не запускать, проверить права руками (docs/ops/rls.md)" 1
}
[ "$check" != 'открыто' ] ||
  fail "данные восстановлены, но wetop_app читает таблицу users целиком: API не запускать, повторить миграции прав" 1

names="$(for f in "${regrants[@]}"; do basename "$(dirname "$f")" | cut -d_ -f1 | tail -c 4; done | paste -sd ' ' -)"
echo "db-restore-prod: $(basename "$dump") восстановлена, таблиц с данными в копии: $tables; права повторены миграциями: $names"
