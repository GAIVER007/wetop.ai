#!/usr/bin/env bash
# Дамп базы по расписанию: pg_dump в BACKUP_DIR, удаление старых файлов.
#
# 🔴 Бэкап не существует, пока из него не восстановились. Файл на диске —
# это надежда, а не резервная копия: битый дамп, неполная схема и пустой
# том выглядят одинаково успешно. В первую неделю работы сделайте дамп
# и поднимите его в ОТДЕЛЬНУЮ базу — и повторяйте восстановление раз
# в квартал. Проверка восстановлением — единственная проверка, которая
# что-то значит.
#
# 🔴 Пароль берётся из окружения (PGPASSWORD) и в командную строку
# не попадает: аргументы процесса видит любой, кто выполнит ps.
#
# Алерт вешает тот, кто запускает: cron или systemd-таймер. Скрипт
# отвечает кодом возврата 1 и понятным сообщением в stderr — этого
# достаточно, чтобы OnFailure= или MAILTO= сработали.
#
# Запуск: PGPASSWORD=... scripts/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-}"
POSTGRES_DB="${POSTGRES_DB:-}"

die() {
    echo "backup: $1" >&2
    exit 1
}

if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ]; then
    die "не заданы POSTGRES_DB или POSTGRES_USER — дамп не делался"
fi

command -v pg_dump >/dev/null 2>&1 || die "pg_dump не найден в PATH — дамп не делался"

mkdir -p "$BACKUP_DIR" || die "каталог $BACKUP_DIR не создать — дамп не делался"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/${POSTGRES_DB}-${STAMP}.sql.gz"
# Пишем во временный файл и переименовываем только после успеха: иначе
# оборванный дамп ляжет рядом с целыми и будет выглядеть как рабочий.
TMP="${TARGET}.part"

if ! pg_dump \
        --host="$POSTGRES_HOST" \
        --port="$POSTGRES_PORT" \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --no-password \
        --format=plain \
    | gzip -c > "$TMP"; then
    rm -f "$TMP"
    die "pg_dump завершился с ошибкой, файл ${TARGET} не создан"
fi

# Пустой дамп — тоже отказ: gzip от нуля байт весит два десятка байт.
if [ ! -s "$TMP" ]; then
    rm -f "$TMP"
    die "дамп пуст, файл ${TARGET} не создан"
fi

mv "$TMP" "$TARGET"
echo "backup: готов ${TARGET}"

# Удаление старых — ПОСЛЕ успешного дампа. Сделай наоборот, и неудачная
# ночь унесёт и новый дамп, и все прежние разом.
if [ "$BACKUP_KEEP_DAYS" -gt 0 ]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "${POSTGRES_DB}-*.sql.gz" \
        -mtime "+${BACKUP_KEEP_DAYS}" -delete
    echo "backup: старше ${BACKUP_KEEP_DAYS} сут удалены"
fi
