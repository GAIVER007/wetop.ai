#!/usr/bin/env bash
# Внешний сторож процессов (срез 11, план §4, ADR-028). Сторож системы живёт внутри API и не может заметить
# собственную смерть — поэтому API, стойку, туннель и «не спать» держит launchd: процесс упал → поднят через 15 с,
# Mac перезагрузился → всё поднимается при входе пользователя.
#
#   scripts/ops/launchd/install.sh [api] [web] [tunnel] [awake]   без аргументов — все четыре
#   scripts/ops/launchd/install.sh --takeover ...                  остановить уже запущенные вручную процессы
#   scripts/ops/launchd/install.sh --dry ...                       только собрать и проверить plist во временной папке
#   scripts/ops/launchd/status.sh                                  что запущено
#   scripts/ops/launchd/uninstall.sh [имена]                       снять
#
# awake — `caffeinate -is`: Mac не засыпает, пока задача работает (экран гаснет как обычно). Это пользовательский
# процесс, системные настройки энергосбережения не меняются; снимается uninstall.sh awake.
# Перезапуск API после правки кода: `launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.api` или просто убить процесс —
# launchd поднимет его на новом коде через 15 с. Журналы: ~/Library/Logs/pms-lux/<имя>.log
#
# Доступ к папке проекта. macOS не даёт процессам launchd читать ~/Desktop, ~/Documents и ~/Downloads без
# разрешения (проверено 13.09.2026: `ls` видит имена, `head` и `bash script.sh` получают «Operation not permitted»,
# а node читает — у него разрешение уже есть). Поэтому api и web запускаются через node, а скрипт туннеля bash
# получает на вход от node, не читая файл сам. Перед тем как трогать запущенные вручную процессы, скрипт проверяет
# доступ пробной задачей: иначе --takeover остановил бы работающий API, а launchd не смог бы его поднять.
set -u
cd "$(dirname "$0")/../../.."
REPO="$(pwd)"
UID_N="$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/pms-lux"
NODE="$HOME/.local/bin/node"
NPM_CLI="$(dirname "$(readlink -f "$HOME/.local/bin/npm")")/npm-cli.js"
PATH_ENV="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
TAKEOVER=0
DRY=0
NAMES=()
for a in "$@"; do
  case "$a" in
    --takeover) TAKEOVER=1 ;;
    --dry) DRY=1 ;;
    api|web|tunnel|awake) NAMES+=("$a") ;;
    *) echo "неизвестно: $a (есть api, web, tunnel, awake, --takeover, --dry)"; exit 2 ;;
  esac
done
[ ${#NAMES[@]} -eq 0 ] && NAMES=(api web tunnel awake)
[ "$DRY" -eq 1 ] && AGENTS="$(mktemp -d)"
mkdir -p "$AGENTS" "$LOGS"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

# write_plist <файл> <label> <журнал> <keepalive:true|false> <аргументы...>
write_plist() {
  local file=$1 label=$2 log=$3 keep=$4; shift 4
  local args=""
  for x in "$@"; do args="$args    <string>$(xml "$x")</string>
"; done
  cat > "$file" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
$args  </array>
  <key>WorkingDirectory</key><string>$(xml "$REPO")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(xml "$PATH_ENV")</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><$keep/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$(xml "$log")</string>
  <key>StandardErrorPath</key><string>$(xml "$log")</string>
</dict>
</plist>
PL
  plutil -lint "$file" >/dev/null
}

# Команда задачи по имени (массив CMD)
command_for() {
  case "$1" in
    api) CMD=("$NODE" "$NPM_CLI" run start -w apps/api) ;;
    web) CMD=("$NODE" "$NPM_CLI" run dev -w apps/web) ;;
    # bash не читает файл сам (запрет macOS) — текст скрипта ему отдаёт node через stdin
    tunnel) CMD=(/bin/bash -c "\"$NODE\" -e \"process.stdout.write(require('fs').readFileSync('scripts/ops/channex-tunnel.sh'))\" | /bin/bash -s") ;;
    awake) CMD=(/usr/bin/caffeinate -is) ;;
  esac
}

# Пробная задача тем же способом запуска: процесс launchd читает файл проекта?
can_read_repo() {
  [ "$DRY" -eq 1 ] && return 0
  local label="kz.luxx.pms.preflight" dir log
  dir="$(mktemp -d)"; log="$LOGS/preflight.log"; : > "$log"
  write_plist "$dir/$label.plist" "$label" "$log" false /bin/bash -c \
    "\"$NODE\" -e \"require('fs').readFileSync('apps/api/package.json'); process.stdout.write('echo preflight-ok')\" | /bin/bash -s"
  launchctl bootout "gui/$UID_N/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_N" "$dir/$label.plist"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    grep -a -q 'preflight-ok\|Operation not permitted\|EPERM' "$log" && break
    sleep 1
  done
  launchctl bootout "gui/$UID_N/$label" 2>/dev/null || true
  grep -a -q 'preflight-ok' "$log" && return 0
  cat <<MSG
  ✗ macOS не пускает процессы launchd в папку проекта ($REPO). Запущенные вручную процессы не тронуты.
    Сделать один из двух вариантов (владелец):
      1) Системные настройки → Конфиденциальность и безопасность → Полный доступ к диску → «+» →
         добавить $(readlink -f "$NODE" 2>/dev/null || echo "$NODE"); затем повторить install.sh;
      2) перенести проект из «Рабочего стола» в папку вне Desktop/Documents/Downloads (например ~/pms-lux).
    Журнал проверки: $log
MSG
  return 1
}

# Порт или процесс уже заняты не launchd — два API на одном порту не живут
occupied_by() {
  case "$1" in
    api) lsof -tiTCP:3001 -sTCP:LISTEN 2>/dev/null ;;
    web) lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null ;;
    tunnel) pgrep -f 'scripts/ops/channex-tunnel.sh|cloudflared tunnel --url' 2>/dev/null ;;
  esac
}

REPO_OK=1
for n in "${NAMES[@]}"; do
  if [ "$n" != awake ]; then can_read_repo || REPO_OK=0; break; fi
done

for n in "${NAMES[@]}"; do
  label="kz.luxx.pms.$n"
  echo "• $n"
  if [ "$n" != awake ] && [ "$REPO_OK" -eq 0 ]; then echo "  пропущен: нет доступа к папке проекта"; continue; fi
  launchctl print "gui/$UID_N/$label" >/dev/null 2>&1 && launchctl bootout "gui/$UID_N/$label" 2>/dev/null
  pids="$( [ "$DRY" -eq 1 ] || occupied_by "$n" | tr '\n' ' ')"
  if [ -n "${pids// /}" ]; then
    if [ "$TAKEOVER" -eq 0 ]; then
      echo "  уже запущен вручную (PID $pids). Повторите с --takeover, чтобы launchd взял его на себя"
      continue
    fi
    echo "  останавливаю ручной процесс $pids — дальше его держит launchd"
    kill $pids 2>/dev/null; sleep 3
  fi
  command_for "$n"
  write_plist "$AGENTS/$label.plist" "$label" "$LOGS/$n.log" true "${CMD[@]}"
  if [ "$DRY" -eq 1 ]; then echo "  $AGENTS/$label.plist собран и проверен (plutil), не загружен"; continue; fi
  launchctl bootstrap "gui/$UID_N" "$AGENTS/$label.plist" && echo "  загружен, журнал $LOGS/$n.log"
done
