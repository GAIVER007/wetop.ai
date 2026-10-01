#!/usr/bin/env bash
# Вторая копия рабочей базы вне сервера, зашифрованная: Q-073, разбор 01.10.2026 (reports/order-2026-10-01, пункт 2),
# инструкция docs/ops/backups.md, раздел «Вторая копия вне сервера».
#
# Берёт последнюю ночную копию из BACKUP_DIR (или файл из аргумента), шифрует её паролем (openssl, AES-256-CBC,
# PBKDF2) и кладёт в хранилище S3 (Cloudflare R2 или любое другое с подписью v4) одним curl. Пароль и ключи
# хранилища не попадают ни в аргументы процессов (их видит любой через ps), ни в вывод: пароль уходит в openssl
# через окружение, ключи хранилища в curl через --config из stdin. После загрузки размер в хранилище сверяется с
# размером файла (HEAD), затем пишется статус BACKUP_DIR/status/offsite.json: время, имя, размер, адрес без ключей.
#
#   scripts/ops/db-backup-offsite.sh [путь к копии .dump]
#
# BACKUP_DIR                 где лежат ночные копии (/root/backups)
# BACKUP_OFFSITE_URL         адрес ведра: https://<account>.r2.cloudflarestorage.com/<bucket> (без завершающего /)
# BACKUP_OFFSITE_KEY_ID      ключ доступа к ведру (только запись и чтение этого ведра)
# BACKUP_OFFSITE_SECRET      секрет ключа
# BACKUP_OFFSITE_PASSPHRASE  пароль шифрования; без него копия в хранилище бесполезна, хранить отдельно от сервера
# BACKUP_OFFSITE_REGION      регион подписи: auto для R2 (по умолчанию), например eu-central-1 для AWS
# Все значения берутся из окружения или из ENV_FILE (файл настроек в корне клона), как в db-backup.sh.
#
# Срок хранения в ведре задаётся правилом жизненного цикла самого ведра (R2: Object lifecycle rules), скрипт объекты
# не удаляет: ключ без права удаления не даст злоумышленнику стереть копии вместе с сервером.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"

fail() {
  echo "db-backup-offsite: $1" >&2
  exit "${2:-1}"
}

# Значение ключа из файла настроек без вывода на экран: последняя строка KEY=… (можно с export), кавычки снимаются
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
setting() { # $1: имя; из окружения, иначе из файла настроек
  local value="${!1:-}"
  [ -n "$value" ] || value="$(env_value "$1")"
  printf '%s' "$value"
}

for tool in openssl curl; do command -v "$tool" >/dev/null 2>&1 || fail "нет $tool в PATH" 2; done
curl --help all 2>/dev/null | grep -q -- '--aws-sigv4' || fail 'curl без --aws-sigv4 (нужен 7.75 и новее)' 2

url="$(setting BACKUP_OFFSITE_URL)"
key_id="$(setting BACKUP_OFFSITE_KEY_ID)"
secret="$(setting BACKUP_OFFSITE_SECRET)"
passphrase="$(setting BACKUP_OFFSITE_PASSPHRASE)"
region="$(setting BACKUP_OFFSITE_REGION)"
region="${region:-auto}"
[ -n "$url" ] || fail "BACKUP_OFFSITE_URL пуст: адрес ведра в окружении или в $ENV_FILE" 2
[ -n "$key_id" ] && [ -n "$secret" ] || fail 'BACKUP_OFFSITE_KEY_ID и BACKUP_OFFSITE_SECRET: ключ ведра' 2
[ -n "$passphrase" ] || fail 'BACKUP_OFFSITE_PASSPHRASE пуст: без пароля копия наружу не уходит' 2
[ "${#passphrase}" -ge 16 ] || fail 'BACKUP_OFFSITE_PASSPHRASE короче 16 знаков' 2
url="${url%/}"
case "$url" in https://*) ;; *) fail 'BACKUP_OFFSITE_URL должен начинаться с https://' 2 ;; esac

if [ -n "${1:-}" ]; then
  dump="$1"
else
  dump="$(ls -t "$BACKUP_DIR"/wetop-*.dump 2>/dev/null | head -n 1 || true)"
fi
[ -n "$dump" ] && [ -s "$dump" ] || fail "нет копии для отправки: ${1:-$BACKUP_DIR/wetop-*.dump}" 1
name="$(basename "$dump").enc"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
enc="$work/$name"

# Шифрование: пароль через окружение (env:), не аргументом
export OFFSITE_PASS="$passphrase"
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -md sha256 -pass env:OFFSITE_PASS -in "$dump" -out "$enc" ||
  fail 'openssl не зашифровал копию' 1
# Проверка: расшифровывается тем же паролем в те же байты
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -pass env:OFFSITE_PASS -in "$enc" 2>/dev/null |
  cmp -s - "$dump"; then
  fail 'зашифрованная копия не расшифровывается обратно в исходник' 1
fi
unset OFFSITE_PASS
size="$(wc -c <"$enc" | tr -d ' ')"

# Загрузка: ключ ведра через --config из stdin, подпись v4
upload() {
  printf 'user = "%s:%s"\n' "$key_id" "$secret" |
    curl -fsS --config - --aws-sigv4 "aws:amz:${region}:s3" --max-time 900 \
      -T "$enc" "$url/$name" -o /dev/null
}
upload || fail "хранилище не приняло $name" 1

# Сверка: размер объекта в хранилище равен размеру файла
remote_size="$(
  printf 'user = "%s:%s"\n' "$key_id" "$secret" |
    curl -fsSI --config - --aws-sigv4 "aws:amz:${region}:s3" --max-time 60 "$url/$name" |
    tr -d '\r' | awk 'tolower($1) == "content-length:" { print $2 }' | tail -n 1
)"
[ "${remote_size:-}" = "$size" ] || fail "размер в хранилище (${remote_size:-нет}) не равен размеру файла ($size)" 1

mkdir -p "$BACKUP_DIR/status"
host="${url#https://}"
host="${host%%/*}"
printf '{"at":"%s","name":"%s","bytes":%s,"host":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$name" "$size" "$host" >"$BACKUP_DIR/status/offsite.json"
echo "db-backup-offsite: $name, $size байт, в хранилище на $host; статус $BACKUP_DIR/status/offsite.json"
