#!/usr/bin/env bash
# Вторая копия рабочей базы вне сервера: шифрование age и выгрузка в Cloudflare R2 (Q-073, ADR-137; замечание
# ментора 02.10.2026). Инструкция: docs/ops/backups.md, раздел «Вторая копия вне сервера».
#
# Ночная копия (db-backup.sh) лежит на том же сервере, что стойка, и от потери сервера или аккаунта хостинга не
# спасает. Этот скрипт берёт последнюю копию wetop-*.dump из $BACKUP_DIR, шифрует её публичным ключом age владельца
# и кладёт в бакет R2. Закрытого ключа на сервере нет: расшифровать копию может только владелец. Наружу уходит
# только шифротекст: перед выгрузкой проверяется заголовок формата age.
#
# После выгрузки сверяется размер файла в R2 и пишется статус $BACKUP_DIR/status/offsite.json (время, копия, объект,
# размер). Любой сбой: ненулевой код, строка в журнал и сообщение дежурным в Telegram.
#
#   scripts/ops/db-backup-offsite.sh
#
# BACKUP_DIR                    папка копий (/root/backups), та же, что у db-backup.sh
# OFFSITE_AGE_RECIPIENT         публичный ключ age владельца (age1…); закрытый ключ сюда не кладётся никогда
# OFFSITE_R2_ACCOUNT_ID         номер аккаунта Cloudflare: адрес https://<номер>.r2.cloudflarestorage.com
# OFFSITE_R2_ENDPOINT           адрес целиком вместо номера (бакет в юрисдикции ЕС: https://<номер>.eu.r2…)
# OFFSITE_R2_BUCKET             бакет
# OFFSITE_R2_ACCESS_KEY_ID, OFFSITE_R2_SECRET_ACCESS_KEY
#                               ключ R2 с правом Object Read & Write только на этот бакет
# OFFSITE_PREFIX                папка в бакете (wetop-db)
# OFFSITE_MAX_AGE_HOURS         копия старше этого не выгружается (26): значит, ночная не снялась
# TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   кому писать о сбое
# Всё берётся из окружения или из ENV_FILE (.env клона), как в db-backup.sh; значения в журнал не попадают, ключи
# R2 уходят в rclone переменными окружения, а не аргументами (аргументы процесса видит любой через `ps`).
set -euo pipefail
export PATH="${PATH:+$PATH:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RCLONE_MIN="1.59" # Cloudflare: «Ensure you are running rclone v1.59 or greater» (developers.cloudflare.com, R2, rclone)

say() { printf '%s db-backup-offsite: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Значение ключа из .env без вывода на экран, как в db-backup.sh
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

# Окружение важнее .env
setting() {
  local value="${!1:-}"
  [ -n "$value" ] || value="$(env_value "$1")"
  printf '%s' "$value"
}

notify() {
  say "$1" >&2
  local token chats
  token="$(setting TELEGRAM_BOT_TOKEN)"
  chats="$(setting TELEGRAM_CHAT_ID)"
  [ -n "$token" ] && [ -n "$chats" ] || return 0
  for chat in $(printf '%s' "$chats" | tr ',' ' '); do
    # Адрес с токеном через stdin, а не аргументом (аудит 25.09, как в auto-deploy.sh)
    printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
      curl -fsS -o /dev/null --max-time 15 -X POST --config - \
        --data-urlencode "chat_id=${chat}" --data-urlencode "text=WETOP, вторая копия базы: $1" ||
      say 'Telegram не принял сообщение' >&2
  done
}

fail() {
  notify "$1"
  exit "${2:-1}"
}

missing=""
for name in OFFSITE_AGE_RECIPIENT OFFSITE_R2_BUCKET OFFSITE_R2_ACCESS_KEY_ID OFFSITE_R2_SECRET_ACCESS_KEY; do
  [ -n "$(setting "$name")" ] || missing="$missing $name"
done
[ -n "$(setting OFFSITE_R2_ACCOUNT_ID)$(setting OFFSITE_R2_ENDPOINT)" ] || missing="$missing OFFSITE_R2_ACCOUNT_ID"
[ -z "$missing" ] || fail "не настроено:$missing (docs/ops/backups.md, «Вторая копия вне сервера»)" 2

recipient="$(setting OFFSITE_AGE_RECIPIENT)"
case "$recipient" in
  AGE-SECRET-KEY-*) fail "в OFFSITE_AGE_RECIPIENT закрытый ключ age: ему не место на сервере, нужен публичный (age1…)" 2 ;;
  age1*) ;;
  *) fail "OFFSITE_AGE_RECIPIENT не похож на публичный ключ age (age1…)" 2 ;;
esac

max_age="$(setting OFFSITE_MAX_AGE_HOURS)"
max_age="${max_age:-26}"
case "$max_age" in '' | *[!0-9]*) fail "OFFSITE_MAX_AGE_HOURS: целое число часов, а не «$max_age»" 2 ;; esac

command -v age >/dev/null || fail "нет age на сервере: apt install age (docs/ops/backups.md)" 2
command -v rclone >/dev/null || fail "нет rclone на сервере: apt install rclone (docs/ops/backups.md)" 2
# Версия «мажор.минор» не меньше нужной; без sort -V, его нет в части систем
version_ok() {
  local hm="${1%%.*}" hn="${1#*.}" mm="${2%%.*}" mn="${2#*.}"
  [ "$hm" -gt "$mm" ] || { [ "$hm" -eq "$mm" ] && [ "$hn" -ge "$mn" ]; }
}
have="$(rclone version 2>/dev/null | sed -nE 's/^rclone v([0-9]+\.[0-9]+).*/\1/p' | head -n 1 || true)"
[ -n "$have" ] && version_ok "$have" "$RCLONE_MIN" ||
  fail "rclone ${have:-?} старше $RCLONE_MIN: с R2 ответит 401 (docs/ops/backups.md, установка)" 2

latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'wetop-*.dump' 2>/dev/null | sort | tail -n 1 || true)"
[ -n "$latest" ] || fail "в $BACKUP_DIR нет ни одной копии wetop-*.dump: ночная копия не снималась" 1
[ -n "$(find "$latest" -mmin "-$((max_age * 60))" 2>/dev/null)" ] ||
  fail "последняя копия $(basename "$latest") старше $max_age ч: ночная копия не снялась, наружу нечего нести" 1

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
encrypted="$work/$(basename "$latest").age"
age -r "$recipient" -o "$encrypted" "$latest" 2>"$work/age.err" || fail "age не зашифровал $(basename "$latest"): $(head -c 300 "$work/age.err")" 1
# Наружу только шифротекст: двоичный файл age начинается строкой своего формата
[ "$(head -c 21 "$encrypted")" = "age-encryption.org/v1" ] ||
  fail "после шифрования нет заголовка age: выгрузка отменена, наружу ничего не ушло" 1

# Настройка rclone целиком из переменных окружения (без файла настроек): ключи не в аргументах и не на диске.
# no_check_bucket: ключ с правами на объекты не может проверять и создавать бакет (developers.cloudflare.com, R2, rclone).
account="$(setting OFFSITE_R2_ACCOUNT_ID)"
endpoint="$(setting OFFSITE_R2_ENDPOINT)"
export RCLONE_CONFIG_WETOPR2_TYPE=s3
export RCLONE_CONFIG_WETOPR2_PROVIDER=Cloudflare
export RCLONE_CONFIG_WETOPR2_REGION=auto
export RCLONE_CONFIG_WETOPR2_ACL=private
export RCLONE_CONFIG_WETOPR2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_WETOPR2_ENDPOINT="${endpoint:-https://${account}.r2.cloudflarestorage.com}"
RCLONE_CONFIG_WETOPR2_ACCESS_KEY_ID="$(setting OFFSITE_R2_ACCESS_KEY_ID)"
RCLONE_CONFIG_WETOPR2_SECRET_ACCESS_KEY="$(setting OFFSITE_R2_SECRET_ACCESS_KEY)"
export RCLONE_CONFIG_WETOPR2_ACCESS_KEY_ID RCLONE_CONFIG_WETOPR2_SECRET_ACCESS_KEY

prefix="$(setting OFFSITE_PREFIX)"
prefix="${prefix:-wetop-db}"
object="$prefix/$(basename "$encrypted")"
remote="wetopr2:$(setting OFFSITE_R2_BUCKET)/$object"

# --ignore-existing: повтор в те же сутки не перезаписывает объект (и не спорит с блокировкой бакета)
rclone copyto -q --ignore-existing "$encrypted" "$remote" 2>"$work/rclone.err" ||
  fail "R2 не принял $object: $(head -c 300 "$work/rclone.err")" 1

sent="$(wc -c <"$encrypted" | tr -d ' ')"
stored="$(rclone lsf -q --format s "$remote" 2>/dev/null | head -n 1 || true)"
[ "$stored" = "$sent" ] || fail "в R2 у $object размер «${stored:-нет объекта}», отправлено $sent байт" 1

status_dir="$BACKUP_DIR/status"
mkdir -p "$status_dir"
chmod 755 "$status_dir"
printf '{"at":"%s","source":"%s","object":"%s","bytes":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(basename "$latest")" "$object" "$sent" >"$status_dir/offsite.json.partial"
chmod 644 "$status_dir/offsite.json.partial"
mv "$status_dir/offsite.json.partial" "$status_dir/offsite.json"

say "в R2 $object, $sent байт, зашифровано для $(printf '%s' "$recipient" | cut -c1-12)…"
