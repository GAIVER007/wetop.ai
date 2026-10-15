#!/bin/sh
# Точка входа образа. Миграции применяет только веб-процесс, один раз,
# до старта gunicorn. monitor идёт тем же образом, и две параллельные
# накатки на одну базу — гонка, поэтому он миграции не трогает.
set -eu

if [ "${1:-}" = "gunicorn" ]; then
    # Ревизий может быть несколько: 0012 ветка от 0009 и живёт рядом с 0010/0011.
    revisions=$(alembic current | awk '{print $1}')
    contracted=0
    for revision in $revisions; do
        case "$revision" in
            0010|0011) contracted=1 ;;
            0001|0002|0003|0004|0005|0006|0007|0008|0009|0012) ;;
            # Неизвестную ревизию не угадываем.
            *)
                echo "Unsupported database revision; deployment requires review" >&2
                exit 1
                ;;
        esac
    done
    # 0010 сужает ключи: только отдельная ручная выкладка после smoke.
    # Уже суженную базу не откатываем.
    if [ "$contracted" = 0 ]; then
        alembic upgrade 0009
    fi
    # 0012 только добавляет (ведение диалога) и нужна образу сразу: применяется в любом состоянии, повтор ничего не делает.
    alembic upgrade 0012
fi

exec "$@"
