#!/usr/bin/env bash
# Публичный адрес для webhook Channex на время разработки: быстрый туннель Cloudflare + регистрация webhook в PMS + сторож.
# Быстрые туннели Cloudflare живут недолго и умирают молча («Unauthorized: Tunnel not found») — 11.09.2026 это случилось
# трижды за день. Скрипт поднимает туннель, ждёт, пока имя появится в DNS, регистрирует webhook через API PMS,
# проверяет пробным вызовом из Channex и дальше раз в 30 с следит; при смерти туннеля — поднимает новый и перерегистрирует.
# Постоянное решение — именованный туннель или хостинг (Q-070); до него запускать этот скрипт на машине с API.
#
# 11.09.2026, 19:14 UTC — первый перезапуск после смерти туннеля не перерегистрировал webhook: общий журнал усекался,
# старый cloudflared дописывал в него свои последние строки по прежнему смещению, файл получал дыру из NUL, grep считал
# его бинарным и вместо адреса печатал «Binary file … matches». Эта строка попадала в файл адреса, API отвергал
# регистрацию («callback_url должен начинаться с https://»), и сторож пересоздавал туннель каждые ~4,5 минуты.
# Исправлено: у каждого туннеля свой журнал, старый процесс дожидается завершения, журнал читается с `grep -a`,
# адрес проверяется по форме до записи и регистрации.
#
# Запуск:  scripts/ops/channex-tunnel.sh            (API на http://localhost:3001; иначе API_URL=... )
# Остановка: Ctrl+C — туннель гасится, регистрация в Channex остаётся (укажет на мёртвый адрес — до следующего запуска
# PMS доберёт брони опросом ленты и покажет «webhook под подозрением» в /channels).
set -u
API_URL="${API_URL:-http://localhost:3001}"
API_PORT="${API_PORT:-3001}"
CLOUDFLARED="${CLOUDFLARED:-$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")}"
STATE_DIR="${STATE_DIR:-${TMPDIR:-/tmp}/pms-channex-tunnel}"
mkdir -p "$STATE_DIR"
LOG=""
URL_FILE="$STATE_DIR/url"
PID=""

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null; say "туннель остановлен"; exit 0; }
trap cleanup INT TERM

tunnel_url_from_log() {
  # -a: журнал может содержать NUL и байты вне UTF-8, без -a grep печатает «Binary file … matches» вместо адреса
  grep -a -o -E 'https://[a-z0-9-]+\.trycloudflare\.com' "$1" 2>/dev/null | head -1
}

tunnel_revoked() { [ -n "$LOG" ] && grep -a -q 'Tunnel not found' "$LOG" 2>/dev/null; }

start_tunnel() {
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null
    wait "$PID" 2>/dev/null
    PID=""
  fi
  : > "$URL_FILE"
  # Свой файл журнала на каждый туннель: старый процесс не должен дописывать в журнал нового. Храним пять последних.
  LOG="$STATE_DIR/cloudflared.$(date -u +%Y%m%dT%H%M%SZ).$$.log"
  for old in $(ls -t "$STATE_DIR"/cloudflared.*.log 2>/dev/null | tail -n +6); do rm -f "$old"; done
  "$CLOUDFLARED" tunnel --url "http://localhost:$API_PORT" --no-autoupdate >"$LOG" 2>&1 &
  PID=$!
  local url=""
  for _ in $(seq 1 30); do
    url=$(tunnel_url_from_log "$LOG")
    [ -n "$url" ] && break
    sleep 1
  done
  case "$url" in
    https://*.trycloudflare.com) ;;
    *) say "cloudflared не выдал адрес (получено: «$url»), см. $LOG"; return 1 ;;
  esac
  echo "$url" > "$URL_FILE"
  say "туннель: $url"
  # Имя появляется в DNS не сразу; Channex откажет «invalid host», пока его нет
  local host=${url#https://}
  for _ in $(seq 1 24); do
    if dig +short @1.1.1.1 "$host" 2>/dev/null | grep -q '^[0-9]'; then break; fi
    sleep 5
  done
  register "$url"
}

register() {
  local url=$1 body
  body=$(printf '{"callbackUrl":"%s/channels/channex/webhook"}' "$url")
  for _ in $(seq 1 6); do
    local reg
    reg=$(curl -s -m 30 -X POST -H 'content-type: application/json' -d "$body" "$API_URL/channels/channex/webhook/register")
    if printf '%s' "$reg" | grep -q '"active":true'; then
      say "webhook зарегистрирован: $reg"
      local t
      t=$(curl -s -m 40 -X POST -H 'content-type: application/json' -d "$body" "$API_URL/channels/channex/webhook/test")
      if printf '%s' "$t" | grep -q '"statusCode":200'; then say "пробный вызов Channex → PMS 200"; return 0; fi
      say "пробный вызов не прошёл: $t"
    else
      say "регистрация не прошла: $reg"
    fi
    sleep 10
  done
  return 1
}

alive() {
  # Процесс жив, сервер не отозвал туннель, и адрес отвечает (через IP Cloudflare — локальный DNS может кэшировать NXDOMAIN)
  kill -0 "$PID" 2>/dev/null || return 1
  tunnel_revoked && return 1
  local url host code
  url=$(cat "$URL_FILE" 2>/dev/null) || return 1
  case "$url" in https://*.trycloudflare.com) ;; *) return 1 ;; esac
  host=${url#https://}
  code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' --resolve "$host:443:104.16.230.132" "$url/channels/channex/webhook/status")
  [ "$code" = "200" ]
}

start_tunnel
fails=0
while true; do
  sleep 30
  if alive; then fails=0; continue; fi
  fails=$((fails + 1))
  say "проверка не прошла ($fails)"
  if [ "$fails" -ge 2 ] || tunnel_revoked; then
    say "туннель умер — поднимаю новый"
    start_tunnel || say "не удалось поднять туннель, попробую через 30 с"
    fails=0
  fi
done
