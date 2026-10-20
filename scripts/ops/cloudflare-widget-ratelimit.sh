#!/usr/bin/env bash
# Лимит на краю Cloudflare для чата ИИ-помощника: assistant.wetop.ai/widget/* (аудит 30.09.2026 §5, ADR не нужен —
# правило внешней панели; инструкция и проверка: docs/ops/cloudflare-widget-ratelimit.md).
#
# Бот сам считает реплики (60 в час на посетителя и на IP, `widget_messages_per_hour`), но делает это уже у себя, через
# Redis: поток запросов с одного адреса всё равно доходит до бота и до счётчика. Это правило отсекает поток раньше, на
# краю Cloudflare, грубо и дёшево: больше CF_RL_REQUESTS запросов за CF_RL_PERIOD секунд с одного IP на четыре
# записывающих пути виджета — блок на CF_RL_TIMEOUT секунд. GET-пути (widget.js, опрос /widget/messages) в правило не
# входят: их частоту задаёт сам виджет, и человек их не вызывает чаще.
#
# Умолчания — под план Free зоны: одно правило на зону, период и блок только 10 с, в выражении только путь (поле Host
# доступно с Pro — тогда CF_RL_HOST). Другие хосты зоны путей /widget/* не имеют (стойка — /, API — /w/* и /a/*), поэтому
# правило по пути на деле касается только помощника.
#
#   scripts/ops/cloudflare-widget-ratelimit.sh status    что сейчас стоит в фазе http_ratelimit зоны (только чтение)
#   scripts/ops/cloudflare-widget-ratelimit.sh apply     поставить или обновить своё правило (чужие не трогаются)
#   scripts/ops/cloudflare-widget-ratelimit.sh remove    снять своё правило (откат)
#
# CLOUDFLARE_API_TOKEN   токен API с правами Zone → Zone WAF: Edit и Zone → Zone: Read на зону wetop.ai; только в
#                        окружении или в ENV_FILE (.env клона), в журнал и в аргументы процессов не попадает
# CLOUDFLARE_ZONE_ID     номер зоны; не задан — ищется по имени CLOUDFLARE_ZONE_NAME (wetop.ai)
# CF_RL_REQUESTS         порог запросов за период с одного IP (20)
# CF_RL_PERIOD           период в секундах (10; Free допускает только 10)
# CF_RL_TIMEOUT          сколько секунд блокировать после порога (10; Free допускает только 10)
# CF_RL_PATHS            пути через пробел (/widget/session /widget/consent /widget/message /widget/attachment)
# CF_RL_HOST             хост в выражении (пусто — без хоста; задавать только на плане Pro и выше)
set -euo pipefail
export PATH="${PATH:+$PATH:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
API="${CLOUDFLARE_API:-https://api.cloudflare.com/client/v4}"
REF="wetop-widget-ratelimit"
DESCRIPTION="WETOP: чат помощника /widget/* — не больше ${CF_RL_REQUESTS:-20} запросов за ${CF_RL_PERIOD:-10} с с одного IP (аудит 30.09.2026)"
REQUESTS="${CF_RL_REQUESTS:-20}"
PERIOD="${CF_RL_PERIOD:-10}"
TIMEOUT="${CF_RL_TIMEOUT:-10}"
PATHS="${CF_RL_PATHS:-/widget/session /widget/consent /widget/message /widget/attachment}"
HOST="${CF_RL_HOST:-}"
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-wetop.ai}"

say() { printf 'cloudflare-widget-ratelimit: %s\n' "$*"; }
fail() { say "$*" >&2; exit 1; }

# Значение ключа из .env без вывода на экран — как в db-backup.sh и auto-deploy.sh
env_value() {
  [ -f "$ENV_FILE" ] || return 0
  local line
  line="$(grep -E "^(export[[:space:]]+)?$1=" "$ENV_FILE" | tail -n 1 || true)"
  [ -n "$line" ] || return 0
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

command -v python3 >/dev/null 2>&1 || fail "нужен python3 (разбор ответов API)"
command -v curl >/dev/null 2>&1 || fail "нужен curl"

TOKEN="${CLOUDFLARE_API_TOKEN:-$(env_value CLOUDFLARE_API_TOKEN)}"
[ -n "$TOKEN" ] || fail "не задан CLOUDFLARE_API_TOKEN (окружение или $ENV_FILE): токен с правами Zone WAF: Edit и Zone: Read"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-$(env_value CLOUDFLARE_ZONE_ID)}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Вызов API. Токен уходит в curl через `--config -` на stdin, а не аргументом: аргументы процесса видит любой через `ps`
# (аудит 25.09). Тело запроса — файлом. Печатает ответ целиком; код HTTP не нужен — Cloudflare всегда отвечает JSON с
# полем success, его и смотрим.
cf() {
  local method="$1" url="$2" body="${3:-}"
  local -a extra=()
  [ -n "$body" ] && extra=(--data-binary "@$body" -H 'Content-Type: application/json')
  printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" |
    curl -sS --max-time 30 --config - -X "$method" ${extra[@]+"${extra[@]}"} "$url"
}

# python3 читает JSON ответа из файла и печатает то, что просят
py() { python3 -I - "$@"; }

if [ -z "$ZONE_ID" ]; then
  cf GET "$API/zones?name=$ZONE_NAME" >"$WORK/zone.json"
  ZONE_ID="$(py "$WORK/zone.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
rows = data.get("result") or []
print(rows[0]["id"] if data.get("success") and rows else "")
PY
)"
  [ -n "$ZONE_ID" ] || fail "зона $ZONE_NAME не найдена токеном: нужны права Zone: Read на неё"
fi

ENTRYPOINT="$API/zones/$ZONE_ID/rulesets/phases/http_ratelimit/entrypoint"
cf GET "$ENTRYPOINT" >"$WORK/current.json"

# Текущие правила фазы. «Фазы ещё нет» (ошибка 10002) — это пустой список, а не отказ: первое правило её и создаст.
py "$WORK/current.json" "$WORK/rules.json" <<'PY' || fail "Cloudflare не отдал правила фазы http_ratelimit: $(cat "$WORK/current.json")"
import json, sys
data = json.load(open(sys.argv[1]))
if data.get("success"):
    rules = (data.get("result") or {}).get("rules") or []
elif any(e.get("code") == 10002 for e in data.get("errors") or []):
    rules = []
else:
    sys.exit(1)
json.dump(rules, open(sys.argv[2], "w"), ensure_ascii=False)
PY

case "${1:-}" in
  status)
    say "зона $ZONE_ID, фаза http_ratelimit:"
    py "$WORK/rules.json" "$REF" <<'PY'
import json, sys
rules = json.load(open(sys.argv[1]))
if not rules:
    print("  правил нет")
for r in rules:
    rl = r.get("ratelimit") or {}
    own = "своё" if r.get("ref") == sys.argv[2] else "чужое"
    print(f"  [{own}] ref={r.get('ref', '-')} action={r.get('action')} {rl.get('requests_per_period')} за {rl.get('period')} с, блок {rl.get('mitigation_timeout')} с")
    print(f"         {r.get('expression')}")
    print(f"         {r.get('description', '')}")
PY
    ;;
  apply|remove)
    MODE="$1"
    py "$WORK/rules.json" "$WORK/body.json" "$MODE" "$REF" "$DESCRIPTION" "$REQUESTS" "$PERIOD" "$TIMEOUT" "$HOST" $PATHS <<'PY'
import json, sys
rules_file, body_file, mode, ref, description, requests, period, timeout, host, *paths = sys.argv[1:]
rules = json.load(open(rules_file))
# Чужие правила остаются как есть (с их id — так Cloudflare понимает, что это те же правила); своё — только одно и последним:
# правила rate limiting обязаны стоять в конце фазы.
kept = [r for r in rules if r.get("ref") != ref]
if mode == "apply":
    paths_set = " ".join(json.dumps(p) for p in paths)
    expression = f"http.request.uri.path in {{{paths_set}}}"
    if host:
        expression = f"http.host eq {json.dumps(host)} and {expression}"
    kept.append({
        "ref": ref,
        "description": description,
        "action": "block",
        "expression": f"({expression})",
        "ratelimit": {
            "characteristics": ["cf.colo.id", "ip.src"],
            "period": int(period),
            "requests_per_period": int(requests),
            "mitigation_timeout": int(timeout),
        },
    })
json.dump({"rules": kept}, open(body_file, "w"), ensure_ascii=False)
PY
    cf PUT "$ENTRYPOINT" "$WORK/body.json" >"$WORK/put.json"
    py "$WORK/put.json" <<'PY' || fail "Cloudflare отклонил правила: $(cat "$WORK/put.json")"
import json, sys
data = json.load(open(sys.argv[1]))
sys.exit(0 if data.get("success") else 1)
PY
    if [ "$MODE" = apply ]; then
      say "применено: $REF — не больше $REQUESTS запросов за $PERIOD с с одного IP на ${PATHS// /, }, блок $TIMEOUT с${HOST:+, хост $HOST}"
    else
      say "снято: $REF (чужие правила фазы не тронуты)"
    fi
    ;;
  *)
    fail "использование: $0 status|apply|remove (см. шапку скрипта)"
    ;;
esac
