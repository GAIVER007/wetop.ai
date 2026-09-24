#!/usr/bin/env bash
# Пробное восстановление копии рабочей базы — Q-073, инструкция docs/ops/backups.md.
#
# Копия (scripts/ops/db-backup.sh) разворачивается в новую базу на отдельном сервере PostgreSQL и сверяется: все ли
# таблицы копии встали и сколько в них строк. Рабочую базу скрипт не трогает: сервер для пробы — RESTORE_CHECK_URL,
# и он обязан быть на этой машине (127.0.0.1, localhost, ::1 или сокет); проба создаёт и удаляет свою базу.
#
# Почему не просто pg_restore: копия одной схемы public начинается с CREATE SCHEMA public, а в новой базе схема уже
# есть — pg_restore падает на первой же строке («schema "public" already exists»; найдено первой пробой 24.09.2026).
# Поэтому схема и её комментарий пропускаются по оглавлению копии. А btree_gist ставится до таблиц: копия одной схемы
# расширений не несёт, а исключающие ограничения на него опираются.
#
#   RESTORE_CHECK_URL=postgresql://postgres@127.0.0.1:55499/postgres scripts/ops/db-restore-check.sh /root/backups/wetop-….dump
#
# RESTORE_CHECK_URL — простой адрес служебной базы сервера для пробы, без параметров после «?»
# (по умолчанию локальная база автотестов, npm run db:local).
set -euo pipefail

fail() {
  echo "restore-check: $1" >&2
  exit "${2:-1}"
}
mask() { sed -E 's#(://[^:/@[:space:]]*:)[^@[:space:]]*@#\1***@#g'; }

dump="${1:-}"
[ -n "$dump" ] && [ -f "$dump" ] || fail "укажите файл копии: scripts/ops/db-restore-check.sh /root/backups/wetop-….dump" 2
admin="${RESTORE_CHECK_URL:-postgresql://postgres@127.0.0.1:55432/postgres}"
case "$admin" in *\?*) fail "RESTORE_CHECK_URL — простой адрес без параметров после «?»" 2 ;; esac

# Только сервер на этой машине: так проба не может уйти в рабочую базу
host="$(printf '%s' "$admin" | sed -nE 's#^[a-z]+://([^@/]*@)?(\[[^]]*\]|[^:/]*).*#\2#p')"
case "$host" in
  '' | 127.0.0.1 | localhost | '[::1]' | ::1) ;;
  *) fail "сервер для пробы не на этой машине ($host): пробу делают на отдельной локальной PostgreSQL, не на рабочей базе" 2 ;;
esac

db="wetop_restore_check_$$"
target="${admin%/*}/$db"
list="$(mktemp)"
errors="$(mktemp)"
cleanup() {
  psql "$admin" -qc "DROP DATABASE IF EXISTS $db" >/dev/null 2>&1 || true
  rm -f "$list" "$errors"
}
trap cleanup EXIT

psql "$admin" -qv ON_ERROR_STOP=1 -c "CREATE DATABASE $db" >/dev/null 2>"$errors" ||
  { mask <"$errors" >&2; fail "не удалось создать базу для пробы" 2; }
psql "$target" -qv ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS btree_gist' >/dev/null 2>"$errors" ||
  { mask <"$errors" >&2; fail "на сервере для пробы нет расширения btree_gist (пакет contrib)" 2; }

pg_restore --list "$dump" | grep -vE ' SCHEMA - public | COMMENT - SCHEMA public ' >"$list"
if ! pg_restore --no-owner --no-privileges --exit-on-error --use-list="$list" --dbname="$target" "$dump" 2>"$errors"; then
  mask <"$errors" >&2
  fail "копия $(basename "$dump") не восстановилась — сообщение выше" 1
fi

expected="$(grep -c ' TABLE DATA ' "$list" || true)"
counts="$(printf '%s\n' "select format('select %L, count(*) from public.%I', tablename, tablename) from pg_tables where schemaname = 'public' order by tablename \\gexec" |
  psql "$target" -At -v ON_ERROR_STOP=1 -f -)"
tables="$(printf '%s\n' "$counts" | grep -c '|' || true)"
rows="$(printf '%s\n' "$counts" | awk -F'|' '{ s += $2 } END { print s + 0 }')"
[ "$tables" -eq "$expected" ] || fail "восстановлено таблиц $tables, а в копии $expected" 1

# Контрольные числа объекта (CLAUDE.md §6), если такие таблицы есть в копии
control=""
for table in inventory_units reservations _prisma_migrations; do
  n="$(printf '%s\n' "$counts" | awk -F'|' -v t="$table" '$1 == t { print $2 }')"
  [ -n "$n" ] && control="$control, $table: $n"
done
echo "restore-check: $(basename "$dump") восстановлена — таблиц $tables из $expected, строк $rows$control"
