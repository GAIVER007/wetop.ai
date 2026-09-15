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
# 13.09.2026, учения сторожа (API остановлен на 7 минут) — два отказа, воспроизведены `channex-tunnel-drill.ts`:
# (1) новый туннель поднялся, пока API лежал, шесть регистраций отвергнуты, скрипт сдался, а когда API вернулся, проверка
# «туннель жив» проходила и регистрацию больше никто не повторял: webhook в Channex пять минут указывал на мёртвый адрес.
# (2) проверка ходит через туннель в API, поэтому лежащий API выглядел как мёртвый туннель, и скрипт пересоздавал здоровые
# туннели, каждый раз меняя адрес. Исправлено: сначала проверяется сам API (локально); пока он лежит, туннель не трогается.
# Неудачная регистрация отличается от неудачного туннеля и повторяется на следующей проверке. Кроме того, раз в несколько
# проверок скрипт сверяет адрес, зарегистрированный в Channex, с адресом туннеля и перерегистрирует при расхождении;
# недоступный статус расхождением не считается.
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
CHECK_EVERY="${CHECK_EVERY:-30}"        # секунд между проверками
REGISTER_TRIES="${REGISTER_TRIES:-6}"   # попыток регистрации подряд
REGISTER_PAUSE="${REGISTER_PAUSE:-10}"  # секунд между попытками
VERIFY_EVERY="${VERIFY_EVERY:-4}"       # сверять регистрацию в Channex каждые N успешных проверок (~2 мин)
# Путь, который отвечает без обращения к Channex: проверка API и туннеля не должна зависеть от чужого сервиса
HEALTH_PATH="${HEALTH_PATH:-/inventory/summary}"

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
  # 0 — туннель поднят и webhook зарегистрирован; 2 — туннель поднят, регистрация не прошла (повторит главный цикл)
  register "$url" || return 2
}

register() {
  local url=$1 body
  body=$(printf '{"callbackUrl":"%s/channels/channex/webhook"}' "$url")
  for _ in $(seq 1 "$REGISTER_TRIES"); do
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
    sleep "$REGISTER_PAUSE"
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
  code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' --resolve "$host:443:104.16.230.132" "$url$HEALTH_PATH")
  [ "$code" = "200" ]
}

api_up() {
  # API отвечает напрямую, без туннеля. Если нет — туннель ни при чём, пересоздавать его бессмысленно
  [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$API_URL$HEALTH_PATH")" = "200" ]
}

registered_url() {
  # Адрес webhook, зарегистрированный в Channex сейчас (пусто — не зарегистрирован).
  # Код 1 — статус недоступен (API или Channex не ответили): сравнивать не с чем, это не расхождение.
  local resp code body
  resp=$(curl -s -m 30 -w '\n%{http_code}' "$API_URL/channels/channex/webhook/status") || return 1
  code=$(printf '%s' "$resp" | tail -n 1)
  [ "$code" = "200" ] || return 1
  body=$(printf '%s' "$resp" | sed '$d')
  printf '%s' "$body" | grep -a -q '"registered":' || return 1
  printf '%s' "$body" | grep -a -o -E '"callbackUrl":"https://[^"]*"' | head -1 | sed -E 's/^"callbackUrl":"(.*)"$/\1/'
  return 0
}

ensure_registered() {
  local url have
  url=$(cat "$URL_FILE" 2>/dev/null)
  case "$url" in https://*.trycloudflare.com) ;; *) return 1 ;; esac
  if ! have=$(registered_url); then
    say "статус webhook недоступен — сверю регистрацию на следующей проверке"
    return 1
  fi
  [ "$have" = "$url/channels/channex/webhook" ] && return 0
  say "в Channex webhook указывает на «${have:-не зарегистрирован}», туннель — $url: перерегистрирую"
  register "$url"
}

# Постоянный адрес важнее быстрого туннеля. 15.09.2026, после посадки домена: запуск этого скрипта поднял
# одноразовый туннель, перерегистрировал на него webhook Channex и умер — webhook снова указывал в никуда,
# брони шли только опросом ленты. Спрашиваем у API, задан ли PUBLIC_API_URL, и отказываемся работать.
permanent_api_url() {
  local body
  body=$(curl -s -m 10 "$API_URL/channels/channex/webhook/status") || return 1
  printf '%s' "$body" | grep -a -o -E '"expectedUrl":"https://[^"]*"' | head -1 |
    sed -E 's/^"expectedUrl":"(.*)"$/\1/'
}
if [ "${ALLOW_QUICK_TUNNEL:-0}" != "1" ] && permanent=$(permanent_api_url) && [ -n "$permanent" ]; then
  case "$permanent" in
    https://*.trycloudflare.com*) ;;
    *)
      say "у PMS задан постоянный адрес ($permanent): быстрый туннель увёл бы на себя webhook Channex — отказ"
      say "если быстрый туннель всё же нужен: ALLOW_QUICK_TUNNEL=1 $0"
      exit 3
      ;;
  esac
fi

need_register=0
start_tunnel
case $? in
  0) ;;
  2) say "туннель поднят, но webhook не зарегистрирован — повторю на следующей проверке"; need_register=1 ;;
  *) say "не удалось поднять туннель — повторю через ${CHECK_EVERY} с" ;;
esac
fails=0
checks=0
api_was_down=0
while true; do
  sleep "$CHECK_EVERY"
  if ! api_up; then
    if [ "$api_was_down" -eq 0 ]; then say "API не отвечает — туннель не трогаю, жду API"; api_was_down=1; fi
    fails=0
    continue
  fi
  if [ "$api_was_down" -eq 1 ]; then
    say "API снова отвечает — сверяю регистрацию webhook"
    api_was_down=0
    need_register=1
  fi
  if alive; then
    fails=0
    checks=$((checks + 1))
    if [ "$need_register" -eq 1 ] || [ $((checks % VERIFY_EVERY)) -eq 0 ]; then
      if ensure_registered; then need_register=0; else need_register=1; fi
    fi
    continue
  fi
  fails=$((fails + 1))
  say "проверка не прошла ($fails)"
  if [ "$fails" -ge 2 ] || tunnel_revoked; then
    say "туннель умер — поднимаю новый"
    start_tunnel
    case $? in
      0) need_register=0 ;;
      2) say "туннель поднят, но webhook не зарегистрирован — повторю на следующей проверке"; need_register=1 ;;
      *) say "не удалось поднять туннель — повторю через ${CHECK_EVERY} с" ;;
    esac
    fails=0
  fi
done
