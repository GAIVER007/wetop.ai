#!/usr/bin/env bash
# Ночная копия рабочей базы — Q-073, инструкция docs/ops/backups.md.
#
# Организация Supabase на бесплатном плане, а ежедневные бэкапы Supabase делает только с плана Pro (документация
# Supabase, «Database Backups»). С 19.09.2026 рабочая база с бронями объекта не копировалась вовсе: единственный
# снимок — дамп до очистки на той же машине, что стойка (проверка SECURITY.md 24.09.2026, §8).
#
# Скрипт снимает pg_dump в формате custom схемы public — таблицы, данные и журнал миграций; схема автотестов pms_test
# не входит. Копия проверяется pg_restore --list, кладётся с правами 600, копии старше срока удаляются. Строка
# подключения не печатается: в ней пароль, а сообщение pg_dump об ошибке проходит через маску.
#
# После проверенной копии скрипт пишет статус для сторожа стойки (ADR-078): $BACKUP_DIR/status/last.json — время, имя,
# размер и число таблиц. Упавшая или отвергнутая копия статус не трогает: сторож видит последнюю удачную и через
# 26 часов поднимает неисправность «ночной копии базы нет».
#
#   scripts/ops/db-backup.sh
#
# BACKUP_DIR        куда класть копии (/root/backups)
# BACKUP_KEEP_DAYS  сколько суток хранить (14)
# BACKUP_DATABASE_URL  откуда снимать: из окружения или из ENV_FILE (.env корня); иначе DIRECT_URL, затем DATABASE_URL
#                   оттуда же. Параметры Prisma (pgbouncer, connection_limit, schema…) срезаются: pg_dump на них падает
#
# На сервере без клиента PostgreSQL скрипт запускают в образе postgres:17 (docs/ops/backups.md): смонтированы только он
# сам, .env и папка копий — поэтому он не опирается на расположение клона.
# BACKUP_MIN_PG     не старше какой версии pg_dump (17: Supabase на PostgreSQL 17, pg_dump 16 её не снимет)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
MIN_PG="${BACKUP_MIN_PG:-17}"

fail() {
  echo "db-backup: $1" >&2
  exit "${2:-1}"
}

case "$KEEP_DAYS" in '' | *[!0-9]*) fail "BACKUP_KEEP_DAYS — целое число суток, а не «$KEEP_DAYS»" 2 ;; esac
[ "$KEEP_DAYS" -ge 1 ] || fail "BACKUP_KEEP_DAYS — хотя бы 1 сутки" 2

# Значение ключа из .env без вывода на экран: последняя строка KEY=… (можно с export), кавычки снимаются
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

url="${BACKUP_DATABASE_URL:-}"
[ -n "$url" ] || url="$(env_value BACKUP_DATABASE_URL)"
[ -n "$url" ] || url="$(env_value DIRECT_URL)"
[ -n "$url" ] || url="$(env_value DATABASE_URL)"
[ -n "$url" ] || fail "нет строки подключения: BACKUP_DATABASE_URL или DIRECT_URL / DATABASE_URL в $ENV_FILE" 2

# Параметры, которые понимает Prisma, но не libpq: с ними pg_dump отвечает «invalid URI query parameter»
if [[ "$url" == *\?* ]]; then
  query="$(printf '%s' "${url#*\?}" | tr '&' '\n' |
    grep -vE '^(pgbouncer|connection_limit|pool_timeout|schema|statement_cache_size|socket_timeout)=' | paste -sd '&' - || true)"
  url="${url%%\?*}${query:+?$query}"
fi

major="$(pg_dump --version 2>/dev/null | sed -nE 's/^pg_dump \(PostgreSQL\) ([0-9]+).*/\1/p' | head -n 1 || true)"
[ -n "$major" ] || fail "pg_dump не найден: нужен клиент PostgreSQL $MIN_PG (docs/ops/server-setup-2026-09-18.md §2.1)" 2
[ "$major" -ge "$MIN_PG" ] ||
  fail "pg_dump $major старше базы: нужен $MIN_PG или новее, иначе он откажется снимать копию (docs/ops/server-setup-2026-09-18.md §2.1)" 2

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/wetop-$(date -u +%Y%m%dT%H%M%SZ).dump"
partial="$file.partial"
status_dir="$BACKUP_DIR/status"
status_partial="$status_dir/last.json.partial"
errors="$(mktemp)"
trap 'rm -f "$partial" "$errors" "$status_partial"' EXIT

# Пароль — не аргументом: аргументы процесса видит любой через `ps`, пока копия снимается (аудит 25.09). Он уходит
# в PGPASSWORD (переменные процесса видит только его владелец), раскодированным из %XX, а адрес — без него.
conn="$url"
pgpass=""
if [[ "$url" =~ ^([A-Za-z][A-Za-z0-9+.-]*://[^:/@]+):([^@]*)@(.*)$ ]]; then
  conn="${BASH_REMATCH[1]}@${BASH_REMATCH[3]}"
  pgpass="$(printf '%b' "${BASH_REMATCH[2]//%/\\x}")"
fi

# Пароль в сообщении pg_dump (адрес вида postgresql://user:pass@host) заменяется на ***
if ! PGPASSWORD="$pgpass" pg_dump --format=custom --schema=public --no-owner --no-privileges --file="$partial" "$conn" 2>"$errors"; then
  sed -E 's#(://[^:/@[:space:]]*:)[^@[:space:]]*@#\1***@#g' "$errors" >&2
  fail "pg_dump не снял копию — сообщение выше; прежние копии не тронуты" 1
fi

tables="$(pg_restore --list "$partial" 2>/dev/null | grep -c ' TABLE DATA ' || true)"
[ "${tables:-0}" -gt 0 ] || fail "в копии нет ни одной таблицы с данными — копия не принята, прежние не тронуты" 1
chmod 600 "$partial"
mv "$partial" "$file"

# Статус для сторожа (ADR-078). В контейнер API монтируется только папка status, только на чтение, а API там работает
# под node, не root: папка 755, файл 644. Поэтому в статусе нет ни адреса базы, ни пароля — только время и копия.
mkdir -p "$status_dir"
chmod 755 "$status_dir"
printf '{"at":"%s","file":"%s","bytes":%s,"tables":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$file")" \
  "$(wc -c <"$file" | tr -d ' ')" "$tables" >"$status_partial"
chmod 644 "$status_partial"
mv "$status_partial" "$status_dir/last.json"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'wetop-*.dump' -mtime "+$KEEP_DAYS" -print -delete |
  while read -r old; do echo "db-backup: удалена копия старше $KEEP_DAYS сут.: $(basename "$old")"; done

count="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'wetop-*.dump' | wc -l | tr -d ' ')"
echo "db-backup: $(basename "$file") — $(du -h "$file" | cut -f1), таблиц с данными: $tables; копий в $BACKUP_DIR: $count"
