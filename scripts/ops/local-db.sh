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
# Нет PostgreSQL в системе (22.09.2026: на Mac владельца ни Homebrew, ни Postgres.app) — скрипт сам берёт
# готовую сборку из npm (@embedded-postgres/<платформа>, PostgreSQL 16) в .local-pg/ рядом с кодом: один раз,
# ~60 МБ, в git не едет. Версия — PMS_LOCAL_PG_VERSION; в package.json пакет не нужен, образ сервера не растёт.
# PMS_LOCAL_PG_EMBEDDED=1 — брать сборку из npm, даже если PostgreSQL в системе есть (так этот путь проверяют).
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

# PMS_LOCAL_PG_DIR — куда класть сборку из npm: папка проекта бывает общей для Mac и Linux (Cowork, 23.09.2026),
# и Linux-машине удобнее держать свою сборку у себя, не трогая сборку владельца
EMBEDDED_DIR="${PMS_LOCAL_PG_DIR:-$ROOT/.local-pg}"
EMBEDDED_VERSION="${PMS_LOCAL_PG_VERSION:-16.14.0-beta.17}"

# Имя сборки под эту машину: darwin-arm64, darwin-x64, linux-x64, linux-arm64
embedded_platform() {
  local os arch
  case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) return 1 ;; esac
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) return 1 ;; esac
  echo "$os-$arch"
}

bin() {
  local dir platform
  # Сборка из npm — только под эту машину: чужая (darwin-arm64 в общей папке на Linux) тоже «исполняемая»,
  # но падает с Exec format error. Платформа неизвестна — как раньше, любая найденная
  local candidates=("$EMBEDDED_DIR"/node_modules/@embedded-postgres/*/native/bin)
  if platform="$(embedded_platform)"; then
    candidates=("$EMBEDDED_DIR/node_modules/@embedded-postgres/$platform/native/bin")
  fi
  [ "${PMS_LOCAL_PG_EMBEDDED:-0}" = 1 ] ||
    candidates=("$(dirname "$(command -v pg_ctl 2>/dev/null || echo /nonexistent)")" /usr/lib/postgresql/*/bin /usr/local/pgsql/bin "${candidates[@]}")
  for dir in "${candidates[@]}"; do
    [ -x "$dir/pg_ctl" ] && { echo "$dir"; return 0; }
  done
  if ! platform="$(embedded_platform)"; then
    echo "local-db: PostgreSQL не найдена, а для $(uname -s)/$(uname -m) готовой сборки в npm нет — поставьте сервер (Linux: postgresql, macOS: brew install postgresql@16)" >&2
    return 1
  fi
  echo "local-db: PostgreSQL в системе нет — скачиваю сборку @embedded-postgres/$platform@$EMBEDDED_VERSION в $EMBEDDED_DIR (один раз, ~60 МБ)" >&2
  mkdir -p "$EMBEDDED_DIR"
  # свой манифест: без него npm поднимается до корня проекта и кладёт сборку в общий node_modules
  [ -f "$EMBEDDED_DIR/package.json" ] || printf '{ "name": "pms-local-pg", "private": true }\n' > "$EMBEDDED_DIR/package.json"
  if ! ( cd "$EMBEDDED_DIR" && npm install --prefix "$EMBEDDED_DIR" --no-save --no-package-lock --no-audit --no-fund --silent "@embedded-postgres/$platform@$EMBEDDED_VERSION" >/dev/null ); then
    echo "local-db: сборку PostgreSQL скачать не удалось — проверьте сеть или поставьте сервер (macOS: brew install postgresql@16)" >&2
    return 1
  fi
  dir="$EMBEDDED_DIR/node_modules/@embedded-postgres/$platform/native/bin"
  [ -x "$dir/pg_ctl" ] && { echo "$dir"; return 0; }
  echo "local-db: сборка скачана, но pg_ctl в ней не найден" >&2
  return 1
}

# initdb и postgres отказываются работать от root: под root запускаем их от пользователя postgres
as_owner() {
  if [ "$(id -u)" = 0 ] && id -u postgres >/dev/null 2>&1; then
    su -s /bin/bash postgres -c "$1"
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
  # База: через psql/createdb, когда они есть рядом с pg_ctl (системная PostgreSQL; их же подставляет
  # tests/unit/local-db-start.test.ts), иначе через pg из node_modules — в сборке из npm только серверные программы
  if [ -x "$b/psql" ]; then
    "$b/psql" -h 127.0.0.1 -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" \
      | grep -q 1 || "$b/createdb" -h 127.0.0.1 -p "$PORT" -U postgres "$DBNAME"
  else
  ( cd "$ROOT" && node -e '
    const { Client } = require("pg");
    const [url, name] = process.argv.slice(1);
    (async () => {
      const c = new Client({ connectionString: url });
      await c.connect();
      const r = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
      if (!r.rowCount) await c.query(`CREATE DATABASE "${name}"`);
      await c.end();
    })().catch((e) => { console.error("local-db: база не создалась —", e.message); process.exit(1); });
  ' "postgresql://postgres@127.0.0.1:$PORT/postgres" "$DBNAME" )
  fi
  ( cd "$ROOT" && DATABASE_URL="$URL" npm run --silent migrate:deploy -w @pms/database >/dev/null )
  # Схема автотестов (ADR-042) — тем же кодом, что и перед прогоном на dev-БД
  ( cd "$ROOT" && DATABASE_URL="$URL" npm run --silent test:schema >/dev/null )
  # public нужен локальным скриптам. pms_test уже заполнен test:schema выше:
  # второй seed-local добавляет другие проживания на те же ячейки и падает по overlap.
  ( cd "$ROOT" && DATABASE_URL="$URL" DATABASE_SCHEMA="" npx --yes tsx tests/tools/seed-local.ts >/dev/null )
  echo "База поднята. Прогон: DATABASE_URL='$URL' npm run test:record -- integration"
}

case "${1:-start}" in
  start) start ;;
  stop) as_owner "'$(bin)/pg_ctl' -D '$PGDATA' stop" >/dev/null 2>&1 || true; echo "остановлена" ;;
  reset) as_owner "'$(bin)/pg_ctl' -D '$PGDATA' stop" >/dev/null 2>&1 || true; rm -rf "$PGDATA"; start ;;
  url) echo "$URL" ;;
  *) echo "local-db: start | stop | reset | url" >&2; exit 2 ;;
esac
