#!/usr/bin/env bash
# Автовыкладка стойки на сервер — ADR-080, инструкция docs/deploy.md §1д.
#
# Сервер сам забирает обновления: раз в две минуты (cron) смотрит ветку выкладки на GitHub и, если она ушла вперёд,
# пересобирает api и web тем же `up -d --build`, что и руками (§1а). Ни GitHub, ни агенту входить на сервер не нужно.
# Выкладывается ветка `release`, а не `main`: в `main` сливается и непроверенное, `release` перематывают только на
# коммит, прошедший все наборы.
#
# Сам не выкладывает, а пишет дежурным и ждёт человека, когда:
#   - в клоне есть локальные правки (их нельзя молча затереть);
#   - новая вершина не продолжает текущую (историю переписали — разбирать руками);
#   - в обновлении есть новые миграции: боевую миграцию делает владелец (AGENTS.md §15).
# Отказ по одной вершине сообщается один раз; следующий коммит в ветке проверяется заново.
#
# Выложил — проверяет: /health API, /login стойки (200) и что страницы без входа не падают (не 5xx). Не прошло —
# возвращает прежний коммит и прежний образ, поднимает их и пишет дежурным.
#
#   scripts/ops/auto-deploy.sh                        одна проверка (так его зовёт cron)
#   scripts/ops/auto-deploy.sh --migrations-applied <вершина>
#                                                     владелец применил миграции вершины, на которой был отказ, —
#                                                     выложить ровно её без проверки миграций; остальные проверки и откат
#                                                     остаются. Ушёл release дальше — отказ: у новой вершины свои миграции
#
# DEPLOY_REPO        клон на сервере (/root/wetop)
# DEPLOY_BRANCH      ветка выкладки (release)
# DEPLOY_STATE_DIR   состояние между запусками (/var/lib/wetop-deploy)
# DEPLOY_IMAGE       образ api и web (pms-lux)
# DEPLOY_HEALTH_WAIT сколько секунд ждать, пока новые контейнеры ответят (180); DEPLOY_HEALTH_STEP — шаг опроса (5)
# DEPLOY_NOTIFY=off  не писать в Telegram (тесты)
# TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — из окружения или .env клона; в журнал и сообщения не попадают
set -euo pipefail
# cron даёт скупой PATH: системные каталоги дописываются в конец, свои (и подставные в тестах) остаются первыми
export PATH="${PATH:+$PATH:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

REPO="${DEPLOY_REPO:-/root/wetop}"
BRANCH="${DEPLOY_BRANCH:-release}"
STATE="${DEPLOY_STATE_DIR:-/var/lib/wetop-deploy}"
IMAGE="${DEPLOY_IMAGE:-pms-lux}"
WAIT="${DEPLOY_HEALTH_WAIT:-180}"
STEP="${DEPLOY_HEALTH_STEP:-5}"
ENV_FILE="$REPO/.env"
APPLIED=0
APPLIED_SHA=""
if [ "${1:-}" = --migrations-applied ]; then
  APPLIED=1
  APPLIED_SHA="${2:-}"
fi

# git pull меняет и этот файл, а bash читает скрипт по ходу исполнения: работаем с копией
if [ -z "${AUTO_DEPLOY_COPY:-}" ]; then
  export AUTO_DEPLOY_SELF="$0" # в подсказках — сам скрипт, а не временная копия
  copy="$(mktemp)"
  cp "$0" "$copy"
  AUTO_DEPLOY_COPY="$copy" exec bash "$copy" "$@"
fi
trap 'rm -f "$AUTO_DEPLOY_COPY"' EXIT

say() { printf '%s auto-deploy: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Значение ключа из .env без вывода на экран — как в db-backup.sh
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

notify() {
  say "$1"
  [ "${DEPLOY_NOTIFY:-on}" = off ] && return 0
  local token chats
  token="${TELEGRAM_BOT_TOKEN:-$(env_value TELEGRAM_BOT_TOKEN)}"
  chats="${TELEGRAM_CHAT_ID:-$(env_value TELEGRAM_CHAT_ID)}"
  [ -n "$token" ] && [ -n "$chats" ] || return 0
  for chat in $(printf '%s' "$chats" | tr ',' ' '); do
    # Адрес с токеном — через stdin, а не аргументом: аргументы процесса видит любой через `ps` (аудит 25.09)
    printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
      curl -fsS -o /dev/null --max-time 15 -X POST --config - \
        --data-urlencode "chat_id=${chat}" --data-urlencode "text=WETOP, выкладка: $1" ||
      say 'Telegram не принял сообщение'
  done
}

mkdir -p "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || exit 0 # прошлый запуск ещё собирает образ

cd "$REPO"
git fetch --quiet origin "$BRANCH"
target="$(git rev-parse "origin/$BRANCH")"
# Что выложено — по записи удачной выкладки, а не по клону: клон переключается до сборки, и прерванный запуск оставлял
# его на новой вершине при прежних контейнерах — следующий молча считал всё выложенным (аудит 26.09, С-67).
[ -s "$STATE/deployed" ] || git rev-parse HEAD >"$STATE/deployed"
current="$(cat "$STATE/deployed")"
short() { git rev-parse --short=8 "$1"; }

[ "$target" != "$current" ] || exit 0
refused_at="$(cat "$STATE/refused" 2>/dev/null || true)"
# Эту вершину уже отказались выкладывать — сказали один раз, ждём следующий коммит или человека
[ "$APPLIED" = 1 ] || [ "$refused_at" != "$target" ] || exit 0

refuse() {
  printf '%s\n' "$target" >"$STATE/refused"
  notify "$(short "$target") не выложен: $1. На сервере по-прежнему $(short "$current")."
  exit 1
}

# Флаг владельца — про ту вершину, на которой был отказ (или названную им), а не про ту, что стоит в release сейчас:
# пока он применял миграции A, release мог уйти на B со своими миграциями (аудит 25.09, С-1).
# Вершину флаг называет всегда: без неё бралась последняя отказанная, а cron мог уже отказать и следующей — тогда
# выкладывалась вершина, чьи миграции никто не применял (проверка исправлений 26.09).
if [ "$APPLIED" = 1 ]; then
  [[ "$APPLIED_SHA" =~ ^[0-9a-f]{7,40}$ ]] ||
    refuse "--migrations-applied без вершины не принимается — назовите вершину, чьи миграции применены: ${AUTO_DEPLOY_SELF:-$0} --migrations-applied $(short "$target")"
  expected="$APPLIED_SHA"
  if [ "${target#"$expected"}" = "$target" ]; then
    refuse "--migrations-applied относится к $(short "${refused_at:-$current}" 2>/dev/null || echo "${expected:-?}"), а release уже на $(short "$target") — проверьте миграции новой вершины и запустите ${AUTO_DEPLOY_SELF:-$0} --migrations-applied $(short "$target")"
  fi
fi

[ -z "$(git status --porcelain --untracked-files=no)" ] ||
  refuse "в $REPO есть локальные правки (git status) — разберите их, автовыкладка ждёт"
git merge-base --is-ancestor "$current" "$target" ||
  refuse "новая вершина $BRANCH не продолжает текущую — история переписана, нужна выкладка руками"
migrations="$(git diff --name-only "$current" "$target" -- packages/database/prisma/migrations | sed 's#/[^/]*$##' | sort -u)"
[ -z "$migrations" ] || [ "$APPLIED" = 1 ] ||
  refuse "в обновлении миграции ($(printf '%s' "$migrations" | tr '\n' ' ')) — их применяет владелец (AGENTS.md §15), затем на сервере: ${AUTO_DEPLOY_SELF:-$0} --migrations-applied $(short "$target")"

compose=(docker compose -f deploy/compose.yml)
[ -f deploy/compose.hostinger.yml ] && compose+=(-f deploy/compose.hostinger.yml)

healthy() {
  local deadline=$((SECONDS + WAIT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if "${compose[@]}" exec -T api wget -qO- http://127.0.0.1:3001/health 2>/dev/null | grep -q '"status":"ok"' &&
      "${compose[@]}" exec -T web node -e "
        const pages = ['/login', '/today', '/chessboard', '/reservations'];
        Promise.all(pages.map((p) => fetch('http://127.0.0.1:3000' + p, { redirect: 'manual' }).then((r) => [p, r.status])))
          .then((all) => process.exit(all[0][1] === 200 && all.every(([, s]) => s < 500) ? 0 : 1))
          .catch(() => process.exit(1));" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$STEP"
  done
  return 1
}

# Точка отката: прежний коммит и прежний образ под своим именем
previous_tag="$IMAGE:rollback-$(short "$current")"
docker image tag "$IMAGE:latest" "$previous_tag" 2>/dev/null || previous_tag=""
printf '%s\n' "$current" >"$STATE/previous"

say "выкладываю $(short "$target") поверх $(short "$current")"
started=$SECONDS
git checkout --quiet -B "$BRANCH" "$target"
if "${compose[@]}" up -d --build api web && healthy; then
  printf '%s\n' "$target" >"$STATE/deployed"
  rm -f "$STATE/refused"
  notify "$(short "$target") выложен за $((SECONDS - started)) с: $(git log -1 --format=%s "$target")"
  exit 0
fi

# Не встало — назад на прежний коммит и прежний образ
git checkout --quiet -B "$BRANCH" "$current"
if [ -n "$previous_tag" ]; then
  docker image tag "$previous_tag" "$IMAGE:latest"
  "${compose[@]}" up -d api web
else
  "${compose[@]}" up -d --build api web
fi
printf '%s\n' "$target" >"$STATE/refused"
if healthy; then
  notify "$(short "$target") не прошёл проверку после сборки — возвращён $(short "$current"), стойка работает. Журнал: /var/log/wetop-deploy.log"
else
  notify "$(short "$target") не прошёл проверку, и откат на $(short "$current") тоже не ответил — нужна помощь человека сейчас"
fi
exit 1
