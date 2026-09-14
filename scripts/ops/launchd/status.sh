#!/usr/bin/env bash
# Что держит launchd: состояние, PID, код последнего выхода, сколько раз поднимал.
UID_N="$(id -u)"
for n in api web tunnel domain awake exely-sync; do
  label="kz.luxx.pms.$n"
  if out=$(launchctl print "gui/$UID_N/$label" 2>/dev/null); then
    state=$(printf '%s\n' "$out" | awk -F'= ' '/^\tstate = /{print $2; exit}')
    pid=$(printf '%s\n' "$out" | awk -F'= ' '/^\tpid = /{print $2; exit}')
    runs=$(printf '%s\n' "$out" | awk -F'= ' '/^\truns = /{print $2; exit}')
    code=$(printf '%s\n' "$out" | awk -F'= ' '/last exit code = /{print $2; exit}')
    printf '%-7s %-9s pid %-6s запусков %-4s последний выход %s\n' "$n" "${state:-?}" "${pid:--}" "${runs:-?}" "${code:--}"
  else
    printf '%-7s не загружен\n' "$n"
  fi
done
