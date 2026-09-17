#!/usr/bin/env bash
# Локальная база для интеграционных тестов: своя PostgreSQL рядом с кодом, без dev-БД и пулера.
#
# Зачем. Интеграционные тесты доказывают то, что проверяет сама база: запрет овербукинга, CHECK на
# гражданство, частичный уникальный индекс неисправностей, прямой SQL журнала. До сих пор их можно
# было прогнать только на машине владельца: единственная база — dev в Сингапуре, Session pooler
# Supabase даёт 15 клиентов на проект, а ключ к ней агенту закрыт (SECURITY.md §3). Своя пустая база
# снимает и то и другое: прогон идёт за девять секунд и ничего чужого не трогает.
#
# Что внутри: PostgreSQL из системного пакета, каталог в TMPDIR, порт 55432, миграции проекта и
# вымышленный объект (ADR-010) в схемах public и pms_test — тестам нужен объект и единица «1».
#
#   scripts/ops/local-db.sh start   — поднять, накатить миграции, засеять; печатает DATABASE_URL
#   scripts/ops/local-db.sh stop    — остановить
#   scripts/ops/local-db.sh reset   — снести каталог и поднять заново
#   scripts/ops/local-db.sh url     — напечатать строку подключения (для eval в своей оболочке)
#
# Настоящие данные объекта сюда не попадают: база пустая, заполняют её сами тесты.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGDATA="${PMS_LOCAL_PGDATA:-${TMPDIR:-/tmp}/pms-local-db}"
PORT="${PMS_LOCAL_PGPORT:-55432}"
DBNAME="pmslocal"
URL="postgresql://postgres@127.0.0.1:${PORT}/${DBNAME}"

bin() {
  local dir
  for dir in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin "$(dirname "$(command -v pg_ctl 2>/dev/null || echo /nonexistent)")"; do
    [ -x "$dir/pg_ctl" ] && { echo "$dir"; return 0; }
  done
  echo "local-db: PostgreSQL не найдена — поставьте сервер (Linux: postgresql, macOS: brew install postgresql@16)" >&2
  return 1
}

# initdb и postgres отказываются работать от root: под root запускаем их от пользователя postgres
as_owner() {
  if [ "$(id -u)" = 0 ] && id -u postgres >/dev/null 2>&1; then
    su postgres -c "$1"
  else
    bash -c "$1"
  fi
}

start() {
  local b; b="$(bin)"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    [ "$(id -u)" = 0 ] && id -u postgres >/dev/null 2>&1 && chown -R postgres "$PGDATA"
    as_owner "'$b/initdb' -D '$PGDATA' -U postgres --auth=trust" >/dev/null
  fi
  if ! as_owner "'$b/pg_ctl' -D '$PGDATA' status" >/dev/null 2>&1; then
    as_owner "'$b/pg_ctl' -D '$PGDATA' -l '$PGDATA/server.log' -o '-p $PORT -k $PGDATA' start" >/dev/null
    sleep 1
  fi
  "$b/psql" -h 127.0.0.1 -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" \
    | grep -q 1 || "$b/createdb" -h 127.0.0.1 -p "$PORT" -U postgres "$DBNAME"
  ( cd "$ROOT" && DATABASE_URL="$URL" npm run --silent migrate:deploy -w @pms/database >/dev/null )
  # Схема автотестов (ADR-042) — тем же кодом, что и перед прогоном на dev-БД
  ( cd "$ROOT" && DATABASE_URL="$URL" npm run --silent test:schema >/dev/null )
  # Тестам нужен объект и единица «1»: в public для скриптов и в pms_test, где работают тесты
  ( cd "$ROOT" && DATABASE_URL="$URL" DATABASE_SCHEMA="" npx --yes tsx tests/tools/seed-local.ts >/dev/null )
  ( cd "$ROOT" && DATABASE_URL="$URL" DATABASE_SCHEMA="pms_test" npx --yes tsx tests/tools/seed-local.ts >/dev/null )
  echo "База поднята. Прогон: DATABASE_URL='$URL' npm run test:record -- integration"
}

case "${1:-start}" in
  start) start ;;
  stop) as_owner "'$(bin)/pg_ctl' -D '$PGDATA' stop" >/dev/null 2>&1 || true; echo "остановлена" ;;
  reset) as_owner "'$(bin)/pg_ctl' -D '$PGDATA' stop" >/dev/null 2>&1 || true; rm -rf "$PGDATA"; start ;;
  url) echo "$URL" ;;
  *) echo "local-db: start | stop | reset | url" >&2; exit 2 ;;
esac
