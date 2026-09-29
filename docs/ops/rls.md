# Row Level Security: включение на сервере (владелец, 27.09.2026)

DATA_MODEL v1.13 §17, ADR-103, план `plans/rls-2026-09-27.md`. Всё ниже — в веб-терминале сервера, в `/root/wetop`.
Пароли на экран не печатаются и в чат не пересылаются: они живут только в `.env` (RLS-2).

Порядок из трёх этапов. После каждого — проверка; любой этап откатывается отдельно.

## Этап 1. Миграции (поведение не меняется)

Автовыкладка откажет на новой вершине `release` и напишет в Telegram, что ждут три миграции:
`20260927000026_rls_roles`, `20260927000027_tenant_columns`, `20260927000028_rls_policies`. Это ожидаемо.

```bash
cd /root/wetop && git fetch -q origin && V=$(git rev-parse origin/release)
rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$V" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL \
    -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
BACKUP='docker run --rm -v /root/wetop/scripts/ops/db-backup.sh:/db-backup.sh:ro -v /root/wetop/.env:/wetop.env:ro -v /root/backups:/root/backups -e ENV_FILE=/wetop.env postgres:17 bash /db-backup.sh'
mig status     # ждём: не применены три миграции 20260927000026_rls_roles, …27, …28; применённая 20260927000026_phase1_tenant_scope — известна
$BACKUP        # ждём «db-backup: wetop-…dump»; без неё дальше не идём
mig deploy     # ждём «All migrations have been successfully applied»
mig status     # ждём «Database schema is up to date»
/usr/local/sbin/wetop-auto-deploy --migrations-applied "$V"
```

Если `mig deploy` остановится на `guests: N гостей в бронях разных организаций` — дальше не идти, прислать текст
ошибки: такого гостя надо разделить руками (DATA_MODEL §17.1). База при этом не меняется — миграция откатывается целиком.

Проверка: стойка открывается, брони и гости на месте, журнал показывает записи. API пока ходит прежней ролью —
политики на неё не действуют (§17.3).

## Этап 2. Вход для роли `wetop_app` и строка подключения

Роль создана миграцией без входа. Команды ниже включают вход со случайным паролем и собирают `DATABASE_APP_URL` из
`DATABASE_URL`: тот же адрес пулера, пользователь `wetop_app.<ref проекта>` вместо `postgres.<ref проекта>`.

```bash
cd /root/wetop && cp .env /root/backups/env-before-rls-$(date +%F)
( set -a; . ./.env; set +a
  export P=$(openssl rand -hex 24)
  export ADMIN="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  # пароль идёт в psql переменной окружения (\getenv), а не аргументом — его не видно ни на экране, ни в ps
  printf '%s\n' '\getenv p P' "ALTER ROLE wetop_app LOGIN PASSWORD :'p';" \
    | docker run --rm -i -e ADMIN -e P postgres:17 sh -c 'psql "$ADMIN" -v ON_ERROR_STOP=1 -q' \
    && echo "wetop_app: вход включён" \
    && APP=$(printf '%s' "$DATABASE_URL" | sed -E "s#://postgres(\.[^:]+)?:[^@]*@#://wetop_app\1:$P@#") \
    && grep -v '^DATABASE_APP_URL=' .env > .env.tmp && printf 'DATABASE_APP_URL=%s\n' "$APP" >> .env.tmp \
    && mv .env.tmp .env && chmod 600 .env && echo "DATABASE_APP_URL записан в .env" )
```

Проверка без печати пароля — роль входит и без переменной не видит ни одной брони:

```bash
cd /root/wetop && ( set -a; . ./.env; set +a
  docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
    'psql "$DATABASE_APP_URL" -Atc "select current_user, count(*) from reservations"' )
# ждём: wetop_app|0
```

## Этап 3. API на `wetop_app`

```bash
cd /root/wetop && C="docker compose -f deploy/compose.yml"; [ -f deploy/compose.hostinger.yml ] && C="$C -f deploy/compose.hostinger.yml"
$C up -d api && sleep 20
( set -a; . ./.env; set +a
  docker run --rm -e U="${BACKUP_DATABASE_URL:-$DIRECT_URL}" postgres:17 sh -c \
    'psql "$U" -Atc "select usename, count(*) from pg_stat_activity where usename like '"'"'wetop%'"'"' or usename = '"'"'postgres'"'"' group by 1"' )
# ждём строку wetop_app|N — API держит соединения новой ролью
```

Проверка руками: войти в стойку Luxx — Главная, шахматка, брони, гость, счёт, журнал, «Платформа → Организации».
Всё как было. Замер (RLS-3): открыть шахматку на неделю и список броней 3–4 раза, сравнить время с вечерним днём
до включения; больше +20 % — написать, будет оптимизация (копия `property_id` в горячие таблицы — отдельной правкой
модели).

## Проверка при старте (SEC-1a, 29.09.2026)

В боевом образе (`NODE_ENV=production`) API перед запуском одним разовым соединением по `DATABASE_APP_URL` спрашивает у
базы `current_user` и права роли. Он не стартует, если: адрес не задан; соединение идёт не ролью `wetop_app` (например,
в адрес попала копия `DATABASE_URL`); у роли `BYPASSRLS` или права суперпользователя; роль проверить не удалось.
Причина пишется в журнал контейнера строкой `PMS API не запущен: …` (без адреса и пароля). Вне production проверки нет.

Явный выход на время разбора — `RLS_DISABLED=1` в `.env`: API стартует с предупреждением в журнале, а изоляция
организаций держится только на фильтрах кода. Выключает только значение `1`. Держать так дольше разбора не нужно.

## Откат

- **Этап 3** — в `.env` строку `DATABASE_APP_URL` убрать (`sed -i '/^DATABASE_APP_URL=/d' .env`) **и добавить
  `RLS_DISABLED=1`** (`echo 'RLS_DISABLED=1' >> .env`), затем `$C up -d api`: без второго API не запустится — так и задумано.
  API вернётся на прежнюю роль; политики останутся, но на неё не действуют.
- **Этап 2** — `ALTER ROLE wetop_app NOLOGIN` той же командой, что включала вход.
- **Этап 1** — `down.sql` трёх миграций в обратном порядке (28 → 27 → 26), из копии базы — по `docs/ops/backups.md`.

## Что с `wetop_service`

Роль создана миграцией (с `BYPASSRLS`, если роль миграций может его раздать; иначе — без него, NOTICE в выводе
`mig deploy`). Служебные пути API сейчас ходят прежней ролью по `DATABASE_URL` — на неё политики не действуют, отдельный
вход для `wetop_service` не нужен. Роль оставлена для скриптов и будущей передачи служебного пути с роли владельца
таблиц (§17.2).
