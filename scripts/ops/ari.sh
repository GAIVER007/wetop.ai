#!/usr/bin/env bash
# Выключатель исходящего ARI в Channex — одна команда (Q-126, ADR-041; CUTOVER.md ROLLBACK, полный откат, шаг 1).
#
#   scripts/ops/ari.sh stop     остатки и ограничения из PMS в Channex не уходят ни одним путём; брони продолжают приходить
#   scripts/ops/ari.sh start    включить и сразу отправить накопленную очередь
#   scripts/ops/ari.sh status   что задано на машине и с чем реально работает API
#
# Скрипт работает на обеих машинах и сам понимает, где он (принудительно — ARI_MODE=launchd|docker):
#
#   launchd (Mac владельца). CHANNEX_ARI=off задаётся задачам пользователя (`launchctl setenv`), API
#   перезапускается (`kickstart -k`) и проверяется, что запущенный процесс действительно видит выключатель
#   (`ps eww`). ВНИМАНИЕ: `launchctl setenv` не переживает перезагрузку машины — после перезагрузки ARI снова включён.
#
#   docker (сервер, plans/server-kz-2026-09-17.md). Выключатель кладётся файлом `deploy/ari.env`, который
#   compose читает необязательным `env_file`, и контейнер API пересоздаётся. Это **переживает перезагрузку**:
#   файл на месте — ARI выключен, файла нет — включён. Портов наружу у compose нет, поэтому всё общение с API
#   идёт изнутри контейнера (`compose exec api node -e fetch(...)`), а выключатель спрашивается у САМОГО API —
#   поле `ariStopped` в сводке очереди: «задано в файле» ещё не значит «процесс это видит» (урок 15.09.2026,
#   рапорт без проверки). Механика ветки Docker слита 18.09.2026 из scripts/ops/ari-server.sh параллельной сессии.
#
# При полном откате сначала отключаются каналы в Channex (шаг 2), тогда включившийся ARI до OTA не доходит.
#
# Переменные для тестов и нестандартных стендов: COMPOSE — команда compose целиком (умолчание
# `docker compose -f <COMPOSE_FILE>`), ARI_ENV_FILE — файл выключателя, API_URL, API_LABEL, API_PORT.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="${API_LABEL:-kz.luxx.pms.api}"
API_URL="${API_URL:-http://127.0.0.1:3001}"
API_PORT="${API_PORT:-3001}"
DOMAIN="gui/$(id -u)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO/deploy/compose.yml}"
# Наложение Hostinger (сеть и метки прокси) — как в автовыкладке: без него пересозданный API выпадал из сети прокси
# (аудит 26.09, С-66)
COMPOSE_OVERLAY="$(dirname "$COMPOSE_FILE")/compose.hostinger.yml"
if [ -z "${COMPOSE:-}" ]; then
  COMPOSE="docker compose -f $COMPOSE_FILE"
  [ -f "$COMPOSE_OVERLAY" ] && COMPOSE="$COMPOSE -f $COMPOSE_OVERLAY"
fi
ARI_ENV="${ARI_ENV_FILE:-$(dirname "$COMPOSE_FILE")/ari.env}"

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
# shellcheck disable=SC2086  # COMPOSE — команда со своими аргументами, разбиение по словам намеренное
dc() { $COMPOSE "$@"; }

# Где живёт API. Задача launchd важнее: на Mac разработчика может стоять и docker, но боевой API держит launchd.
mode() {
  if [ -n "${ARI_MODE:-}" ]; then echo "$ARI_MODE"; return; fi
  if command -v launchctl >/dev/null 2>&1 && launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    echo launchd
    return
  fi
  if command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE_FILE" ]; then
    echo docker
    return
  fi
  echo none
}
MODE="$(mode)"

# Изнутри контейнера api: тело ответа API по адресу $1 (портов наружу нет). Пусто и код 1 — нет ответа или не 2xx.
# Замок API в боевом образе включён (ADR-095), поэтому запрос идёт со служебным ключом. Ключ берётся из окружения
# самого контейнера (`process.env`) — на хосте его нет, и в строку запуска (`ps`) он не попадает (аудит 26.09, С-66).
in_api() {
  dc exec -T api node -e \
    "fetch('$API_URL$1',{method:'${2:-GET}',headers:{'x-wetop-service-key':process.env.SERVICE_API_KEY||''}}).then(r=>r.ok?r.text():Promise.reject(r.status)).then(t=>process.stdout.write(t)).catch(()=>process.exit(1))" 2>/dev/null
}

# Значение CHANNEX_ARI в процессе, который на самом деле обслуживает запросы. Не в настройках и не в файле:
# plist и env_file могут говорить одно, а живой процесс работать с другим — ради этого проверка и заведена.
running_switch() {
  case "$MODE" in
    launchd)
      local pid v
      pid=$(lsof -nP -tiTCP:"$API_PORT" -sTCP:LISTEN 2>/dev/null | head -1)
      [ -n "$pid" ] || { echo "API не запущен"; return 1; }
      v=$(ps eww -p "$pid" -o command= 2>/dev/null | tr ' ' '\n' | grep -a '^CHANNEX_ARI=' | head -1 | cut -d= -f2)
      echo "${v:-не задана}"
      ;;
    docker)
      local body
      body=$(in_api /channels/channex/outbox) || { echo "НЕТ ОТВЕТА"; return 1; }
      case "$body" in
        *'"ariStopped":true'*) echo off ;;
        *'"ariStopped":false'*) echo on ;;
        *) echo "НЕПОНЯТНЫЙ ОТВЕТ"; return 1 ;;
      esac
      ;;
    *)
      echo "не знаю, где запущен API"
      return 1
      ;;
  esac
}

wait_api() {
  case "$MODE" in
    launchd)
      # Живость меряем /health: он публичный и трогает базу, поэтому отвечает и с включённым AUTH_REQUIRED=1
      for _ in $(seq 1 45); do
        [ "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$API_URL/health")" = "200" ] && return 0
        sleep 2
      done
      ;;
    docker)
      # Портов наружу нет — ждём, пока API изнутри контейнера ответит сводкой очереди
      for _ in $(seq 1 45); do
        running_switch >/dev/null 2>&1 && return 0
        sleep 2
      done
      ;;
  esac
  return 1
}

restart_api() {
  case "$MODE" in
    launchd)
      launchctl kickstart -k "$DOMAIN/$LABEL" || {
        say "не удалось перезапустить $LABEL (задача launchd не загружена?)"
        return 1
      }
      sleep 3
      wait_api || { say "API не поднялся за 90 с — смотреть ~/Library/Logs/pms-lux/api.log"; return 1; }
      ;;
    docker)
      dc up -d --force-recreate api || { say "не удалось пересоздать контейнер api"; return 1; }
      wait_api || { say "API не поднялся за 90 с — смотреть: $COMPOSE logs --tail=50 api"; return 1; }
      ;;
    *)
      say "не знаю, где запущен API: нет ни задачи launchd $LABEL, ни $COMPOSE_FILE"
      return 1
      ;;
  esac
}

set_switch_off() {
  case "$MODE" in
    launchd) launchctl setenv CHANNEX_ARI off ;;
    docker) mkdir -p "$(dirname "$ARI_ENV")"; printf 'CHANNEX_ARI=off\n' > "$ARI_ENV" ;;
  esac
}

clear_switch() {
  case "$MODE" in
    launchd) launchctl unsetenv CHANNEX_ARI ;;
    docker) rm -f "$ARI_ENV" ;;
  esac
}

stored_switch() {
  case "$MODE" in
    launchd) echo "launchd: CHANNEX_ARI=$(launchctl getenv CHANNEX_ARI 2>/dev/null || true)" ;;
    docker)
      if [ -s "$ARI_ENV" ]; then echo "файл $ARI_ENV: $(cat "$ARI_ENV")"; else echo "файла $ARI_ENV нет — ARI включён"; fi
      ;;
    *) echo "машина неизвестна" ;;
  esac
}

# Mac: прямой запрос с хоста. Ключ, если задан в окружении, идёт через --config из stdin, а не аргументом (`ps`).
api_curl() {
  if [ -n "${SERVICE_API_KEY:-}" ]; then
    printf 'header = "x-wetop-service-key: %s"\n' "$SERVICE_API_KEY" | curl -s --config - "$@"
  else
    curl -s "$@"
  fi
}

queue() {
  case "$MODE" in
    docker) in_api /channels/channex/outbox || echo "нет ответа" ;;
    *) api_curl -m 20 "$API_URL/channels/channex/outbox" ;;
  esac
}

flush() {
  case "$MODE" in
    docker) in_api /channels/channex/outbox/flush POST || echo "нет ответа" ;;
    *) api_curl -m 60 -X POST "$API_URL/channels/channex/outbox/flush" ;;
  esac
}

case "${1:-status}" in
  stop)
    [ "$MODE" = none ] && { say "не знаю, где запущен API: нет ни задачи launchd $LABEL, ни $COMPOSE_FILE"; exit 1; }
    set_switch_off
    say "CHANNEX_ARI=off задан ($MODE), перезапускаю API"
    restart_api || exit 1
    # `|| true` и умолчание: running_switch возвращает ненулевой код, когда API не ответил, а bash 3.2
    # на macOS в этом случае оставлял v незаданным — при `set -u` скрипт падал с «v: unbound variable»
    # вместо внятного «ARI НЕ остановлен» (поймано прогоном на машине владельца 20.09.2026).
    # Кавычки здесь простые намеренно: многобайтные « » рядом с $v тот же bash 3.2 разбирает как часть имени.
    v="$(running_switch || true)"
    v="${v:-нет ответа}"
    if [ "$v" != "off" ]; then
      say "ОШИБКА: API запущен, но выключатель в процессе = '$v' — ARI НЕ остановлен"
      exit 1
    fi
    say "исходящий ARI остановлен: остатки и ограничения в Channex не уходят; очередь: $(queue)"
    ;;
  start)
    [ "$MODE" = none ] && { say "не знаю, где запущен API: нет ни задачи launchd $LABEL, ни $COMPOSE_FILE"; exit 1; }
    clear_switch
    say "CHANNEX_ARI снят ($MODE), перезапускаю API"
    restart_api || exit 1
    v="$(running_switch || true)"
    v="${v:-нет ответа}"
    if [ "$v" = "off" ]; then
      say "ОШИБКА: API всё ещё видит CHANNEX_ARI=off — проверить .env и настройки задачи"
      exit 1
    fi
    say "исходящий ARI включён, отправляю накопленное: $(flush)"
    say "после полного отката перед возвратом каналов сделать полную выгрузку: POST $API_URL/channels/channex/sync"
    ;;
  status)
    echo "машина: $MODE"
    stored_switch
    echo "API сейчас: CHANNEX_ARI=$(running_switch || true)"
    echo "очередь: $(queue)"
    ;;
  *)
    echo "usage: scripts/ops/ari.sh stop|start|status"
    exit 2
    ;;
esac
