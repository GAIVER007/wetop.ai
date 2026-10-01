#!/bin/sh
# Точка входа образа. Миграции применяет только веб-процесс, один раз,
# до старта gunicorn. monitor идёт тем же образом, и две параллельные
# накатки на одну базу — гонка, поэтому он миграции не трогает.
set -eu

if [ "${1:-}" = "gunicorn" ]; then
    # 0010 сужает ключи: только отдельная ручная выкладка после smoke.
    # Уже суженную базу не откатываем; неизвестную ревизию не угадываем.
    revision=$(alembic current)
    case "$revision" in
        "0010"|"0010 (head)") ;;
        ""|0001|0002|0003|0004|0005|0006|0007|0008|0009)
            alembic upgrade 0009
            ;;
        *)
            echo "Unsupported database revision; deployment requires review" >&2
            exit 1
            ;;
    esac
fi

exec "$@"
