#!/bin/bash
# Проверка миграций на чистом PostgreSQL: ложатся ли они на пустую базу и возвращает ли down.sql схему назад.
#
# Зачем: рабочая схема живёт на Supabase, а по Q-112 база переезжает на сервер в Казахстане — там будет
# обычный PostgreSQL. Скрипт отвечает на три вопроса заранее: (1) применяется ли вся цепочка миграций
# на голой базе, (2) описывает ли `schema.prisma` ровно эту базу (`prisma migrate diff`; 24.09.2026 они
# разошлись на таблицах v1.6 — reports/schema-drift-2026-09-24.md), (3) для каждой миграции — совпадает ли
# схема после `migration.sql` + `down.sql` со схемой до неё, снимок в снимок (`pg_dump -s`).
#
# Запуск (нужен локальный PostgreSQL 16 с расширением btree_gist и `npm ci` — для CLI Prisma):
#   MIGRATION_CHECK_URL=postgresql://pms@127.0.0.1:5433/postgres scripts/ops/check-migrations.sh
#
# Скрипт создаёт и удаляет базы `_mig_before` и `_mig_after`, поэтому работает только с локальным адресом:
# рабочую базу он не тронет, даже если подсунуть её строку подключения. DATABASE_URL не читается намеренно.
#
# Отложенные миграции (docs/ops/migrations-held.md, разбор 01.10.2026 п. 4): папка `migrations-held` рядом с цепочкой.
# `prisma migrate deploy` их не видит, поэтому они не уедут на рабочую базу раньше кода; здесь они проверяются так же,
# как цепочка: `schema.prisma` сверяется с базой «цепочка + отложенные», откат каждой отложенной проверяется поверх
# всей цепочки, снимок в снимок.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS="$ROOT/packages/database/prisma/migrations"
HELD="$ROOT/packages/database/prisma/migrations-held"
URL="${MIGRATION_CHECK_URL:-}"

if [ -z "$URL" ]; then
  echo "MIGRATION_CHECK_URL не задан. Пример: postgresql://pms@127.0.0.1:5433/postgres" >&2; exit 2
fi
case "$URL" in
  *@127.0.0.1:*|*@localhost:*|*@127.0.0.1/*|*@localhost/*) ;;
  *) echo "MIGRATION_CHECK_URL ведёт не на localhost — скрипт создаёт и удаляет базы, на чужой сервер не пойдёт" >&2; exit 2 ;;
esac

BASE_URL="${URL%/*}"
ADMIN="$URL"
PSQL=(psql -q -v ON_ERROR_STOP=1)
PG_DUMP="$(command -v pg_dump || echo /usr/lib/postgresql/16/bin/pg_dump)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# bash 3.2 (macOS) не знает mapfile: без него список выходил пустым, а итог — «RESULT: OK» (26.09.2026)
MIGS=()
while IFS= read -r dir; do MIGS+=("$dir"); done < <(ls -d "$MIGRATIONS"/*/ | sort)
if [ "${#MIGS[@]}" -eq 0 ]; then echo "RESULT: FAIL (миграций не найдено в $MIGRATIONS)"; exit 1; fi
HELD_MIGS=()
if [ -d "$HELD" ]; then
  while IFS= read -r dir; do [ -n "$dir" ] && HELD_MIGS+=("$dir"); done < <(ls -d "$HELD"/*/ 2>/dev/null | sort)
fi
# Полный список: цепочка, затем отложенные. Отложенная с именем из цепочки: ошибка: Prisma считала бы её применённой.
ALL=("${MIGS[@]}")
for held in "${HELD_MIGS[@]+"${HELD_MIGS[@]}"}"; do
  for mig in "${MIGS[@]}"; do
    if [ "$(basename "$held")" = "$(basename "$mig")" ]; then
      echo "RESULT: FAIL (отложенная $(basename "$held") повторяет имя из цепочки)"; exit 1
    fi
  done
  ALL+=("$held")
done
fails=0

snapshot() { # $1 — база; снимок схемы без комментариев и разовых ключей pg_dump
  # Колонки внутри CREATE TABLE — без порядка и хвостовых запятых: down.sql после DROP COLUMN возвращает колонку
  # в конец таблицы, поставить её на прежнее место PostgreSQL не умеет (миграция …031, 28.09.2026). Типы, NOT NULL,
  # умолчания, индексы и ограничения по-прежнему сравниваются строка в строку.
  "$PG_DUMP" -s "$BASE_URL/$1" | grep -vE '^--|^.restrict |^.unrestrict ' | awk '
    /^CREATE TABLE .*\($/ { print; inside = 1; n = 0; next }
    inside && /^\);?$/ {
      for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++) if (cols[j] < cols[i]) { t = cols[i]; cols[i] = cols[j]; cols[j] = t }
      for (i = 1; i <= n; i++) print cols[i]
      print; inside = 0; next
    }
    inside { sub(/,$/, ""); cols[++n] = $0; next }
    { print }'
}

drift() { # schema.prisma против базы из всех миграций; иначе следующий `prisma migrate dev` впишет разницу в чужую миграцию
  # Адрес — только временная _mig_after: DIRECT_URL задан явно, иначе prisma.config.ts дочитал бы его из .env
  local prisma="$ROOT/packages/database/node_modules/.bin/prisma" rc
  if [ ! -x "$prisma" ]; then
    echo "FAIL schema.prisma не с чем сверить: нет CLI Prisma (сначала npm ci)"; return 1
  fi
  (cd "$ROOT/packages/database" && DIRECT_URL="$BASE_URL/_mig_after" DATABASE_URL="$BASE_URL/_mig_after" \
    "$prisma" migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code --script \
    > "$TMP/drift.sql" 2> "$TMP/drift.err")
  rc=$?
  case $rc in
    0) echo "ok   schema.prisma описывает ровно ту базу, что строят миграции" ;;
    2) echo "FAIL schema.prisma расходится с миграциями — prisma migrate dev вписал бы:"
       grep -vE '^--|^$|^Loaded Prisma config' "$TMP/drift.sql" | head -10 | sed 's/^/       /'; return 1 ;;
    *) echo "FAIL prisma migrate diff не выполнился: $(grep -v '^Loaded Prisma config' "$TMP/drift.err" | tail -1)"; return 1 ;;
  esac
}

build() { # $1, база, $2, сколько миграций применить (из ALL: сначала цепочка, потом отложенные)
  "${PSQL[@]}" "$ADMIN" -c "DROP DATABASE IF EXISTS $1" >/dev/null 2>&1
  "${PSQL[@]}" "$ADMIN" -c "CREATE DATABASE $1" >/dev/null || return 1
  "${PSQL[@]}" "$BASE_URL/$1" -c "CREATE EXTENSION IF NOT EXISTS btree_gist" >/dev/null || return 1
  local i
  for ((i = 0; i < $2; i++)); do
    if ! "${PSQL[@]}" "$BASE_URL/$1" -f "${ALL[$i]}/migration.sql" > "$TMP/apply.log" 2>&1; then
      echo "  не применилась $(basename "${ALL[$i]}"): $(tail -1 "$TMP/apply.log")"; return 1
    fi
  done
}

echo "Миграций: ${#MIGS[@]}, отложенных (migrations-held): ${#HELD_MIGS[@]}"
if build _mig_after "${#MIGS[@]}"; then
  echo "ok   вся цепочка легла на пустую базу"
  if [ "${#HELD_MIGS[@]}" -eq 0 ]; then
    drift || fails=$((fails + 1))
  elif build _mig_after "${#ALL[@]}"; then
    echo "ok   отложенные легли поверх цепочки"
    drift || fails=$((fails + 1))
  else
    echo "FAIL отложенные миграции не применились поверх цепочки"; fails=$((fails + 1))
  fi
else
  echo "FAIL цепочка не применилась на пустую базу"; fails=$((fails + 1))
fi

for ((n = 0; n < ${#ALL[@]}; n++)); do
  name="$(basename "${ALL[$n]}")"
  [ "$n" -lt "${#MIGS[@]}" ] || name="$name (отложенная)"
  if [ ! -f "${ALL[$n]}/down.sql" ]; then
    echo "FAIL $name — down.sql нет, откатить нечем"; fails=$((fails + 1)); continue
  fi
  build _mig_before "$n" || { echo "FAIL $name (подготовка)"; fails=$((fails + 1)); continue; }
  snapshot _mig_before > "$TMP/before.sql"
  build _mig_after $((n + 1)) || { echo "FAIL $name (подготовка)"; fails=$((fails + 1)); continue; }
  if ! "${PSQL[@]}" "$BASE_URL/_mig_after" -f "${ALL[$n]}/down.sql" > "$TMP/down.log" 2>&1; then
    echo "FAIL $name — down.sql не выполнился: $(tail -1 "$TMP/down.log")"; fails=$((fails + 1)); continue
  fi
  snapshot _mig_after > "$TMP/after.sql"
  if diff -q "$TMP/before.sql" "$TMP/after.sql" >/dev/null; then
    echo "ok   $name — откат вернул схему в прежнее состояние"
  else
    echo "FAIL $name — после отката схема отличается:"
    diff "$TMP/before.sql" "$TMP/after.sql" | grep '^[<>]' | head -10 | sed 's/^/       /'
    fails=$((fails + 1))
  fi
done

"${PSQL[@]}" "$ADMIN" -c "DROP DATABASE IF EXISTS _mig_before" >/dev/null 2>&1
"${PSQL[@]}" "$ADMIN" -c "DROP DATABASE IF EXISTS _mig_after" >/dev/null 2>&1
if [ "$fails" -eq 0 ]; then echo "RESULT: OK"; else echo "RESULT: FAIL ($fails)"; fi
exit $(( fails > 0 ? 1 : 0 ))
