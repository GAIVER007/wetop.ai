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
#   перезапускается (`kickstart -k`) и проверяется, что запущенный процесс действительно видит выключатель.
#   ВНИМАНИЕ: `launchctl setenv` не переживает перезагрузку машины — после перезагрузки ARI снова включён.
#
#   docker (сервер, plans/server-kz-2026-09-17.md). Выключатель кладётся файлом `deploy/ari.env`, который
#   compose читает как необязательный env_file, и контейнер API пересоздаётся. Это **переживает перезагрузку**:
#   файл на месте — ARI выключен, файла нет — включён.
#
# При полном откате сначала отключаются каналы в Channex (шаг 2), тогда включившийся ARI до OTA не доходит.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="${API_LABEL:-kz.luxx.pms.api}"
API_URL="${API_URL:-http://127.0.0.1:3001}"
API_PORT="${API_PORT:-3001}"
DOMAIN="gui/$(id -u)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO/deploy/compose.yml}"
ARI_ENV="$(dirname "$COMPOSE_FILE")/ari.env"

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
dc() { docker compose -f "$COMPOSE_FILE" "$@"; }

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
      local v
      v=$(dc exec -T api printenv CHANNEX_ARI 2>/dev/null | tr -d '\r\n')
      echo "${v:-не задана}"
      ;;
    *)
      echo "не знаю, где запущен API"
      return 1
      ;;
  esac
}

wait_api() {
  # Живость меряем /health: он публичный и трогает базу, поэтому отвечает и с включённым AUTH_REQUIRED=1,
  # и честно молчит, когда соединения пула мертвы.
  for _ in $(seq 1 45); do
    [ "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$API_URL/health")" = "200" ] && return 0
    sleep 2
  done
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
      wait_api || { say "API не поднялся за 90 с — смотреть: docker compose -f $COMPOSE_FILE logs api"; return 1; }
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
    docker) printf 'CHANNEX_ARI=off\n' > "$ARI_ENV" ;;
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
      if [ -f "$ARI_ENV" ]; then echo "файл $ARI_ENV: $(cat "$ARI_ENV")"; else echo "файла $ARI_ENV нет — ARI включён"; fi
      ;;
    *) echo "машина неизвестна" ;;
  esac
}

queue() { curl -s -m 20 "$API_URL/channels/channex/outbox"; }

case "${1:-status}" in
  stop)
    [ "$MODE" = none ] && { say "не знаю, где запущен API: нет ни задачи launchd $LABEL, ни $COMPOSE_FILE"; exit 1; }
    set_switch_off
    say "CHANNEX_ARI=off задан ($MODE), перезапускаю API"
    restart_api || exit 1
    v=$(running_switch)
    if [ "$v" != "off" ]; then
      say "ОШИБКА: API запущен, но выключатель в процессе = «$v» — ARI НЕ остановлен"
      exit 1
    fi
    say "исходящий ARI остановлен: остатки и ограничения в Channex не уходят; очередь: $(queue)"
    ;;
  start)
    [ "$MODE" = none ] && { say "не знаю, где запущен API: нет ни задачи launchd $LABEL, ни $COMPOSE_FILE"; exit 1; }
    clear_switch
    say "CHANNEX_ARI снят ($MODE), перезапускаю API"
    restart_api || exit 1
    v=$(running_switch)
    if [ "$v" = "off" ]; then
      say "ОШИБКА: API всё ещё видит CHANNEX_ARI=off — проверить .env и настройки задачи"
      exit 1
    fi
    say "исходящий ARI включён, отправляю накопленное: $(curl -s -m 60 -X POST "$API_URL/channels/channex/outbox/flush")"
    say "после полного отката перед возвратом каналов сделать полную выгрузку: curl -s -X POST '$API_URL/channels/channex/sync'"
    ;;
  status)
    echo "машина: $MODE"
    stored_switch
    echo "API сейчас: CHANNEX_ARI=$(running_switch)"
    echo "очередь: $(queue)"
    ;;
  *)
    echo "usage: scripts/ops/ari.sh stop|start|status"
    exit 2
    ;;
esac
