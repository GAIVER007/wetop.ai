#!/usr/bin/env bash
# Выключатель исходящего ARI в Channex НА СЕРВЕРЕ (Q-126, ADR-041; CUTOVER.md ROLLBACK, шаг 1).
# На машине владельца тот же выключатель живёт в scripts/ops/ari.sh — там launchd, здесь Docker.
#
#   scripts/ops/ari-server.sh stop     остатки и ограничения в Channex не уходят; брони продолжают приходить
#   scripts/ops/ari-server.sh start    включить и отправить накопленную очередь
#   scripts/ops/ari-server.sh status   что задано в файле и что видит запущенный API
#
# Как работает: CHANNEX_ARI=off пишется в deploy/ari.env (его подхватывает compose), служба api
# пересоздаётся, и скрипт спрашивает у САМОГО API, видит ли он выключатель — «задано в файле» это
# ещё не «процесс это видит» (урок 15.09.2026: кнопка рапортовала успех, не проверив результат).
set -u
ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SWITCH_FILE="${ARI_ENV_FILE:-$ROOT/deploy/ari.env}"
COMPOSE="${COMPOSE:-docker compose -f $ROOT/deploy/compose.yml}"
API_URL="${API_URL:-http://127.0.0.1:3001}"

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# Ответ самого API: поле ariStopped в сводке очереди. Ходим изнутри сети compose — портов наружу нет.
api_switch() {
  local body
  body=$($COMPOSE exec -T api node -e \
    "fetch('$API_URL/channels/channex/outbox').then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.log('НЕТ ОТВЕТА');process.exit(1)})" 2>/dev/null) || {
    echo 'НЕТ ОТВЕТА'
    return 1
  }
  case "$body" in
    *'"ariStopped":true'*) echo off ;;
    *'"ariStopped":false'*) echo on ;;
    *) echo "НЕПОНЯТНЫЙ ОТВЕТ" ; return 1 ;;
  esac
}

queue() {
  $COMPOSE exec -T api node -e \
    "fetch('$API_URL/channels/channex/outbox').then(r=>r.text()).then(console.log).catch(()=>console.log('нет ответа'))" 2>/dev/null
}

recreate_api() {
  $COMPOSE up -d --force-recreate api || { say "не удалось пересоздать службу api"; return 1; }
  for _ in $(seq 1 45); do
    api_switch >/dev/null 2>&1 && return 0
    sleep 2
  done
  say "API не поднялся за 90 с — смотреть: $COMPOSE logs --tail=50 api"
  return 1
}

case "${1:-status}" in
  stop)
    mkdir -p "$(dirname "$SWITCH_FILE")"
    printf 'CHANNEX_ARI=off\n' > "$SWITCH_FILE"
    say "CHANNEX_ARI=off записан в $SWITCH_FILE, пересоздаю службу api"
    recreate_api || exit 1
    v=$(api_switch)
    if [ "$v" != "off" ]; then
      say "ОШИБКА: API отвечает «$v» — ARI НЕ остановлен. Проверить env_file в deploy/compose.yml"
      exit 1
    fi
    say "исходящий ARI остановлен; очередь: $(queue)"
    ;;
  start)
    : > "$SWITCH_FILE"
    say "выключатель снят в $SWITCH_FILE, пересоздаю службу api"
    recreate_api || exit 1
    v=$(api_switch)
    if [ "$v" = "off" ]; then
      say "ОШИБКА: API всё ещё видит CHANNEX_ARI=off — проверить .env и deploy/ari.env"
      exit 1
    fi
    say "исходящий ARI включён, отправляю накопленное"
    $COMPOSE exec -T api node -e \
      "fetch('$API_URL/channels/channex/outbox/flush',{method:'POST'}).then(r=>r.text()).then(console.log)" 2>/dev/null
    say "после полного отката перед возвратом каналов — полная выгрузка: POST /channels/channex/sync"
    ;;
  status)
    echo "файл: $(([ -f "$SWITCH_FILE" ] && cat "$SWITCH_FILE") || echo 'нет')"
    echo "API сейчас: CHANNEX_ARI=$(api_switch)"
    echo "очередь: $(queue)"
    ;;
  *)
    echo "usage: scripts/ops/ari-server.sh stop|start|status"
    exit 2
    ;;
esac
