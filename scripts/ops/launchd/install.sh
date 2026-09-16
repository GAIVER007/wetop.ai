#!/usr/bin/env bash
# Внешний сторож процессов (срез 11, план §4, ADR-028). Сторож системы живёт внутри API и не может заметить
# собственную смерть — поэтому API, стойку, туннель и «не спать» держит launchd: процесс упал → поднят через 15 с,
# Mac перезагрузился → всё поднимается при входе пользователя.
#
#   scripts/ops/launchd/install.sh [api] [web] [tunnel|domain] [awake]   без аргументов — все четыре;
#                                                                  domain вместо tunnel, если есть ~/.cloudflared/wetop.yml
#   domain — постоянный туннель wetop.ai (plans/wetop-domain-2026-09-14.md §6): app.wetop.ai за Cloudflare Access и
#   только публичные пути API на api.wetop.ai. Вместе с быстрым туннелем (tunnel) не ставится: тот открывает всё API
#   и перерегистрирует webhook на свой адрес — сначала uninstall.sh tunnel.
#   scripts/ops/launchd/install.sh exely-sync                      автосинхронизация из Exely раз в 5 мин (ADR-032);
#                                                                  только явно: на день двойного ввода — uninstall.sh exely-sync
#   scripts/ops/launchd/install.sh --takeover ...                  остановить уже запущенные вручную процессы
#   scripts/ops/launchd/install.sh --dry ...                       только собрать и проверить plist во временной папке
#   scripts/ops/launchd/status.sh                                  что запущено
#   scripts/ops/launchd/uninstall.sh [имена]                       снять
#
# awake — `caffeinate -is`: Mac не засыпает, пока задача работает (экран гаснет как обычно). Это пользовательский
# процесс, системные настройки энергосбережения не меняются; снимается uninstall.sh awake.
# Перезапуск API после правки кода: `launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.api` или просто убить процесс —
# launchd поднимет его на новом коде через 15 с. Журналы: ~/Library/Logs/pms-lux/<имя>.log
# Стойка идёт на production-сборке `next start` (ADR-034, память Mac): правка в apps/web видна только после
# `npm run build -w apps/web && launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.web`.
#
# Путь к папке вшивается в plist абсолютно (WorkingDirectory). Переименовали или перенесли папку проекта —
# launchd не может сделать chdir и молча не поднимает ни одну службу: `scripts/ops/repo-sync.sh --relink`
# переустанавливает их на новую папку (16.09.2026, «Pms Lux» → «WETOP»).
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
    api|web|tunnel|domain|awake|exely-sync) NAMES+=("$a") ;;
    *) echo "неизвестно: $a (есть api, web, tunnel, domain, awake, exely-sync, --takeover, --dry)"; exit 2 ;;
  esac
done
DOMAIN_CONFIG="$HOME/.cloudflared/wetop.yml"
if [ ${#NAMES[@]} -eq 0 ]; then
  if [ -f "$DOMAIN_CONFIG" ]; then NAMES=(api web domain awake); else NAMES=(api web tunnel awake); fi
fi
CLOUDFLARED="$(PATH="$PATH_ENV" command -v cloudflared || true)"
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
    <key>PATH</key><string>$(xml "$PATH_ENV")</string>${EXTRA_ENV:+
$EXTRA_ENV}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><$keep/>
  <key>ThrottleInterval</key><integer>15</integer>${START_INTERVAL:+
  <key>StartInterval</key><integer>$START_INTERVAL</integer>}
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
    # production-сборка (ADR-034): обёртка на node собирает, если сборки нет, и запускает next start
    web) CMD=("$NODE" scripts/ops/launchd/web-start.mjs) ;;
    # bash не читает файл сам (запрет macOS) — текст скрипта ему отдаёт node через stdin
    tunnel) CMD=(/bin/bash -c "\"$NODE\" -e \"process.stdout.write(require('fs').readFileSync('scripts/ops/channex-tunnel.sh'))\" | /bin/bash -s") ;;
    awake) CMD=(/usr/bin/caffeinate -is) ;;
    # постоянный туннель: адреса и правила — в ~/.cloudflared/wetop.yml (образец scripts/ops/cloudflared-wetop.example.yml)
    domain) CMD=("${CLOUDFLARED:-cloudflared}" tunnel --no-autoupdate --config "$DOMAIN_CONFIG" run) ;;
    # одним процессом: node с загрузчиком tsx, без npm и sh (ADR-032)
    exely-sync) CMD=("$NODE" --import tsx scripts/imports/src/cli-sync-day.ts --auto) ;;
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
  # Ждём ответа node: `preflight-ok` или его отказ EPERM. Строку bash «getcwd … Operation not permitted»
  # не считаем отказом — bash в папку не пускают всегда, а node при свопе отвечает через несколько секунд
  for _ in $(seq 1 30); do
    grep -a -q 'preflight-ok\|EPERM' "$log" && break
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
    domain) pgrep -f 'cloudflared tunnel .*wetop.yml run' 2>/dev/null ;;
    exely-sync) pgrep -f 'cli-sync-day.ts --auto' 2>/dev/null ;;
  esac
}

# awake и domain папку проекта не читают (caffeinate; cloudflared берёт конфиг из ~/.cloudflared)
needs_repo() { [ "$1" != awake ] && [ "$1" != domain ]; }
REPO_OK=1
for n in "${NAMES[@]}"; do
  if needs_repo "$n"; then can_read_repo || REPO_OK=0; break; fi
done

for n in "${NAMES[@]}"; do
  label="kz.luxx.pms.$n"
  echo "• $n"
  if needs_repo "$n" && [ "$REPO_OK" -eq 0 ]; then echo "  пропущен: нет доступа к папке проекта"; continue; fi
  # Быстрый и постоянный туннели вместе не работают: быстрый открывает всё API и уводит webhook на свой адрес
  if [ "$n" = domain ]; then
    [ "$DRY" -eq 1 ] || [ -f "$DOMAIN_CONFIG" ] || { echo "  пропущен: нет $DOMAIN_CONFIG (образец scripts/ops/cloudflared-wetop.example.yml)"; continue; }
    [ "$DRY" -eq 1 ] || [ -n "$CLOUDFLARED" ] || { echo "  пропущен: cloudflared не найден в PATH"; continue; }
    if [ "$DRY" -eq 0 ] && launchctl print "gui/$UID_N/kz.luxx.pms.tunnel" >/dev/null 2>&1; then
      echo "  пропущен: работает быстрый туннель — сначала scripts/ops/launchd/uninstall.sh tunnel"; continue
    fi
  fi
  if [ "$n" = tunnel ] && [ "$DRY" -eq 0 ] && launchctl print "gui/$UID_N/kz.luxx.pms.domain" >/dev/null 2>&1; then
    echo "  пропущен: работает постоянный туннель wetop.ai — быстрый открыл бы всё API без входа"; continue
  fi
  # Сухой прогон загруженную задачу не снимает. После bootout ждём, пока launchd снимет задачу
  # (иначе bootstrap: «5: Input/output error») и старый процесс отпустит порт (иначе он принимается
  # за «запущенный вручную») — в обоих случаях задача оставалась снятой
  if [ "$DRY" -eq 0 ] && launchctl print "gui/$UID_N/$label" >/dev/null 2>&1; then
    launchctl bootout "gui/$UID_N/$label" 2>/dev/null
    for _ in $(seq 1 20); do
      launchctl print "gui/$UID_N/$label" >/dev/null 2>&1 || [ -n "$(occupied_by "$n")" ] || break
      sleep 1
    done
  fi
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
  # службы держатся постоянно; exely-sync — прогон раз в 5 минут (владелец 13.09.2026), между прогонами процесса нет;
  # прогон, не успевший закончиться к следующему старту, launchd второй раз не запускает
  START_INTERVAL=""; keep=true; EXTRA_ENV=""
  # Session pooler Supabase — 15 клиентов на проект. Прогон синхронизации последовательный, ему хватает одного;
  # с пулом по умолчанию (5) поверх API он переполнял пулер, и запросы стойки падали в 500 (15.09.2026).
  [ "$n" = exely-sync ] && {
    START_INTERVAL=300
    keep=false
    EXTRA_ENV="    <key>DATABASE_POOL_MAX</key><string>1</string>"
  }
  write_plist "$AGENTS/$label.plist" "$label" "$LOGS/$n.log" "$keep" "${CMD[@]}"
  if [ "$DRY" -eq 1 ]; then echo "  $AGENTS/$label.plist собран и проверен (plutil), не загружен"; continue; fi
  loaded=0
  for _ in 1 2 3 4 5; do
    launchctl bootstrap "gui/$UID_N" "$AGENTS/$label.plist" 2>/dev/null && { loaded=1; break; }
    sleep 2
  done
  if [ "$loaded" -eq 1 ]; then
    echo "  загружен, журнал $LOGS/$n.log"
  else
    echo "  ✗ НЕ ЗАГРУЖЕН — служба стоит. Повторить: launchctl bootstrap gui/$UID_N $AGENTS/$label.plist"
  fi
done
