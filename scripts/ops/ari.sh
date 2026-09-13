#!/usr/bin/env bash
# Выключатель исходящего ARI в Channex — одна команда (Q-126, ADR-038; CUTOVER.md ROLLBACK, полный откат, шаг 1).
#
#   scripts/ops/ari.sh stop     остатки и ограничения из PMS в Channex не уходят ни одним путём; брони продолжают приходить
#   scripts/ops/ari.sh start    включить и сразу отправить накопленную очередь
#   scripts/ops/ari.sh status   что задано для launchd и с чем реально работает API
#
# Как работает: переменная CHANNEX_ARI=off задаётся для задач launchd пользователя (`launchctl setenv`), API под launchd
# перезапускается (`kickstart -k`, ~5–10 с) и проверяется, что запущенный процесс действительно видит выключатель.
# ВНИМАНИЕ: `launchctl setenv` не переживает перезагрузку машины — после перезагрузки ARI снова включён. При полном откате
# сначала отключаются каналы в Channex (шаг 2), тогда включившийся ARI до OTA не доходит.
set -u
LABEL="${API_LABEL:-kz.luxx.pms.api}"
API_URL="${API_URL:-http://127.0.0.1:3001}"
API_PORT="${API_PORT:-3001}"
DOMAIN="gui/$(id -u)"

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

running_switch() {
  # Значение CHANNEX_ARI в окружении процесса, который держит порт API (только эта переменная, остальные не печатаются)
  local pid
  pid=$(lsof -nP -tiTCP:"$API_PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  [ -n "$pid" ] || { echo "API не запущен"; return 1; }
  local v
  v=$(ps eww -p "$pid" -o command= 2>/dev/null | tr ' ' '\n' | grep -a '^CHANNEX_ARI=' | head -1 | cut -d= -f2)
  echo "${v:-не задана}"
}

wait_api() {
  for _ in $(seq 1 45); do
    [ "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$API_URL/inventory/summary")" = "200" ] && return 0
    sleep 2
  done
  return 1
}

restart_api() {
  launchctl kickstart -k "$DOMAIN/$LABEL" || { say "не удалось перезапустить $LABEL (задача launchd не загружена?)"; return 1; }
  sleep 3
  wait_api || { say "API не поднялся за 90 с — смотреть ~/Library/Logs/pms-lux/api.log"; return 1; }
}

queue() { curl -s -m 20 "$API_URL/channels/channex/outbox"; }

case "${1:-status}" in
  stop)
    launchctl setenv CHANNEX_ARI off
    say "CHANNEX_ARI=off задан для launchd, перезапускаю API"
    restart_api || exit 1
    v=$(running_switch)
    if [ "$v" != "off" ]; then
      say "ОШИБКА: API запущен, но выключатель в процессе = «$v» — ARI НЕ остановлен"
      exit 1
    fi
    say "исходящий ARI остановлен: остатки и ограничения в Channex не уходят; очередь: $(queue)"
    ;;
  start)
    launchctl unsetenv CHANNEX_ARI
    say "CHANNEX_ARI снят для launchd, перезапускаю API"
    restart_api || exit 1
    v=$(running_switch)
    if [ "$v" = "off" ]; then
      say "ОШИБКА: API всё ещё видит CHANNEX_ARI=off — проверить .env и plist задачи"
      exit 1
    fi
    say "исходящий ARI включён, отправляю накопленное: $(curl -s -m 60 -X POST "$API_URL/channels/channex/outbox/flush")"
    say "после полного отката перед возвратом каналов сделать полную выгрузку: curl -s -X POST '$API_URL/channels/channex/sync'"
    ;;
  status)
    echo "launchd: CHANNEX_ARI=$(launchctl getenv CHANNEX_ARI 2>/dev/null || true)"
    echo "API сейчас: CHANNEX_ARI=$(running_switch)"
    echo "очередь: $(queue)"
    ;;
  *)
    echo "usage: scripts/ops/ari.sh stop|start|status"
    exit 2
    ;;
esac
