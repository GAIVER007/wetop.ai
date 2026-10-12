#!/usr/bin/env bash
# Что держит launchd: состояние, PID, код последнего выхода, сколько раз поднимал.
#
# Ярлык launchd — не вся правда о туннеле. 17.09.2026 строки «tunnel не загружен» и «domain не загружен»
# прочитали как «туннеля нет»: на деле туннель `wetop` работал, его держала системная служба cloudflared
# от root, а адрес снаружи отвечал 200. Поднятая «на всякий случай» вторая копия ТОГО ЖЕ туннеля начала
# перехватывать часть запросов — api.wetop.ai стал отвечать через раз. Поэтому после ярлыков спрашиваем
# сам адрес и ищем живой cloudflared, кем бы он ни был запущен.
UID_N="$(id -u)"
TUNNEL_LOADED=0
for n in api web tunnel domain awake market; do
  label="kz.luxx.pms.$n"
  if out=$(launchctl print "gui/$UID_N/$label" 2>/dev/null); then
    state=$(printf '%s\n' "$out" | awk -F'= ' '/^\tstate = /{print $2; exit}')
    pid=$(printf '%s\n' "$out" | awk -F'= ' '/^\tpid = /{print $2; exit}')
    runs=$(printf '%s\n' "$out" | awk -F'= ' '/^\truns = /{print $2; exit}')
    code=$(printf '%s\n' "$out" | awk -F'= ' '/last exit code = /{print $2; exit}')
    printf '%-7s %-9s pid %-6s запусков %-4s последний выход %s\n' "$n" "${state:-?}" "${pid:--}" "${runs:-?}" "${code:--}"
    case "$n" in tunnel | domain) TUNNEL_LOADED=1 ;; esac
  else
    printf '%-7s не загружен\n' "$n"
  fi
done

# --- туннель: кто его держит на самом деле ---------------------------------------------------------
PUBLIC="${PUBLIC_API_URL:-https://api.wetop.ai}"
PIDS=""
command -v pgrep >/dev/null 2>&1 && PIDS="$(pgrep -x cloudflared 2>/dev/null | tr '\n' ' ')"
PIDS="${PIDS% }"
WHO="процессов cloudflared не видно"
[ -n "$PIDS" ] && WHO="cloudflared pid $PIDS"

if command -v curl >/dev/null 2>&1; then
  HTTP="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$PUBLIC/a/pms.js" 2>/dev/null)"
else
  HTTP=""
fi

if [ "$HTTP" = 200 ]; then
  if [ "$TUNNEL_LOADED" -eq 1 ]; then
    printf 'туннель %s → 200, %s\n' "$PUBLIC" "$WHO"
  else
    # Самый дорогой случай: снаружи всё работает, а ярлыков нет. Туннель держит не launchd этого проекта —
    # системная служба cloudflared или другая машина. install.sh domain поднимет ВТОРУЮ копию того же
    # туннеля, и Cloudflare начнёт слать часть запросов в неё.
    printf 'туннель %s → 200, но ни tunnel, ни domain не загружены: держит не launchd проекта (%s)\n' "$PUBLIC" "$WHO"
    printf '        вторую копию не поднимать — сначала найти живую: /Library/LaunchDaemons, sudo launchctl list | grep cloudflare\n'
  fi
elif [ -z "$HTTP" ]; then
  printf 'туннель %s — не проверен, нет curl\n' "$PUBLIC"
else
  if [ "$TUNNEL_LOADED" -eq 1 ]; then
    printf 'туннель %s не отвечает (%s), хотя задача загружена: смотреть ~/Library/Logs/pms-lux/{tunnel,domain}.log\n' "$PUBLIC" "${HTTP:-000}"
  else
    printf 'туннель %s не отвечает (%s), задача не загружена: %s\n' "$PUBLIC" "${HTTP:-000}" "$WHO"
  fi
fi
