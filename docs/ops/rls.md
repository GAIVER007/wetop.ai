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

## SEC-1b, стадия A: отзыв прав на учётные данные (29.09.2026)

ADR-124, план `plans/sec1b-credential-grants-2026-09-29.md`. Миграция `20260929000033_rls_credential_grants` отзывает у
`wetop_app` доступ к `password_resets`, `email_verifications`, `wizard_*`, оставляет на `users` чтение колонок
`id, email, name, status, email_verified_at`, на `platform_admins` — чтение `user_id, revoked_at`.

**Порядок: сначала выкладка кода, потом миграция.** Код от прав не зависит; прежний код без миграции — тоже. Но прежний код
после миграции сломал бы `/auth/me`.

Перед миграцией на сервере: `AUTH_REQUIRED` не `0`; `DATABASE_APP_URL` задан. Затем по образцу этапа 1 (резервная копия,
`mig status`, `mig deploy`, `mig status`, `--migrations-applied`).

Проверка после миграции — в SQL-редакторе базы (пароли и адреса в ответе не появляются):

```sql
-- 1. Табличных прав у wetop_app на эти таблицы больше нет: ждём пустой ответ
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'wetop_app' AND table_schema = 'public'
  AND table_name IN ('users', 'platform_admins', 'password_resets', 'email_verifications',
                     'wizard_sessions', 'wizard_events', 'wizard_surveys');

-- 2. Колонки, которые остались: users — email, email_verified_at, id, name, status; platform_admins — revoked_at, user_id
SELECT table_name, column_name
FROM information_schema.column_privileges
WHERE grantee = 'wetop_app' AND table_schema = 'public' AND table_name IN ('users', 'platform_admins')
ORDER BY 1, 2;
```

Руками: войти в стойку, открыть «Сотрудники» и «Журнал», сменить пароль и войти новым.

**Откат:** `down.sql` этой миграции (`docs/ops/backups.md`, из копии базы) — `wetop_app` снова получает полный доступ. Код
продолжает работать.

## SEC-1b, стадия B: отзыв прав на данные интеграции (30.09.2026)

ADR-124 (дополнения 30.09.2026), Q-222, Q-225, план `plans/sec1b-stage-b-2026-09-30.md`. Миграция
`20260930000035_rls_integration_grants` отзывает у `wetop_app` всё на `external_events` и `system_incidents`, а на `channel_outbox`
оставляет только `INSERT` (без `RETURNING`). `wetop_service` не меняется.

**Порядок: сначала код, потом миграция.** Нужен код не старше PR #198 (`a47fc932` и позже): все обращения к трём таблицам идут
через `integrationTables(db)` (служебная роль), очередь ставится `createMany`, разбор входящих ревизий из запроса организации идёт
интеграционной командой на служебной роли. Прежний код после миграции даст `permission denied` в журнале, очереди и сторожевых
экранах под организацией.

Перед миграцией на сервере:

1. На сервере выложен код `a47fc932` или новее (`cat /var/lib/wetop-deploy/deployed`), миграции 033 и 034 применены, вход в стойку проверен.
2. Свежая копия базы (`docs/ops/backups.md`).
3. Отчёт `scripts/ops/integration-tables-scope-report.sql` (только чтение): `channel_outbox`, PENDING с `NULL` в `property_id` = 0.
   Строки `NULL` после B1.5 экранам не видны, но отправляет очередь служебный путь; догадочной привязки нет.
4. Желательно: `INTEGRATION_PROPERTY_ID` задан в `.env` (иначе объект интеграции выбирается по сопоставлениям и названию, `docs/deploy.md`).

Применение — по образцу стадии A (`mig status`: не применена только `…035`; `mig deploy`; `mig status`; затем
`/usr/local/sbin/wetop-auto-deploy --migrations-applied <вершина>` только если `release` перематывали).

Проверка после миграции (только чтение, ответы без данных):

```sql
-- 1. Права wetop_app на три таблицы: ждём одну строку — INSERT на channel_outbox
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'wetop_app' AND table_schema = 'public'
  AND table_name IN ('external_events', 'system_incidents', 'channel_outbox')
ORDER BY 1, 2;

-- 2. У wetop_service всё осталось: ждём true, true, true
SELECT has_table_privilege('wetop_service', 'public.external_events', 'SELECT'),
       has_table_privilege('wetop_service', 'public.channel_outbox', 'UPDATE'),
       has_table_privilege('wetop_service', 'public.system_incidents', 'DELETE');
```

Руками: войти в стойку, открыть «Каналы продаж» (журнал событий и очередь), «Подключения → Channex», «Главная» (блок «Системы»);
если каналы подключены — «Проверить соединение». В логе API за несколько минут нет `permission denied` и `42501`.

**Откат:** `down.sql` этой миграции (`docs/ops/backups.md`, из копии базы) — `wetop_app` снова получает полный доступ. Код
продолжает работать: он от этих прав не зависит. Откатывать код на версию старше #198 можно только вместе с `down.sql`.

## Роли Data API Supabase: отзыв прав (30.09.2026)

Аудит 30.09.2026 (`reports/security-vibe-audit-2026-09-30.md` §2). Миграция `20260930000034_revoke_supabase_api_roles`
снимает у `anon` и `authenticated` все права на таблицы, последовательности и функции схемы и умолчания на будущие
объекты: до неё десять таблиц без RLS (`users`, `password_resets`, `external_events`, …) закрывал от публичного ключа
проекта только выключенный Data API (SECURITY.md §12, вариант Б так и не был выполнен). На базе без этих ролей
(локальный стенд, ps.kz) миграция ничего не делает и пишет NOTICE.

Порядок не важен: код от прав `anon` не зависит. Применение — как обычно (`prisma migrate deploy` с `DIRECT_URL`,
`docs/deploy.md` §1д).

**Проверочный лист перед рабочей базой (решение владельца 30.09.2026):**

1. Приложение этих ролей не использует: в коде нет `@supabase/*`, `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` не
   читаются (аудит §1–2); Data API выключен (§12 SECURITY.md).
2. Живых подключений под ними нет и права такие, как ожидается:
   ```sql
   select usename, count(*) from pg_stat_activity where usename in ('anon', 'authenticated') group by 1; -- ждём 0 строк
   select grantee, count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1;             -- сколько грантов снимем
   ```
3. Свежая копия базы есть (`scripts/ops/db-backup.sh`, `docs/ops/backups.md`).
4. Миграция проверена в обе стороны: `scripts/ops/check-migrations.sh` — OK; на локальном стенде с заведёнными ролями
   `anon`/`authenticated` и грантами как у Supabase — до: `has_table_privilege('anon','public.users','SELECT') = true`,
   после `migration.sql` — false и новая таблица `anon` не видна, после `down.sql` — снова true (снято 30.09.2026).
5. После применения: smoke входа (`/auth/login`, `/auth/me`, смена пароля), ручная оплата на стойке
   (`POST /finance/payments` — счёт открывается, оплата записывается), сутки `cli-day-selfcheck`.

Проверка после: в SQL Editor Supabase

```sql
select has_table_privilege('anon', 'public.users', 'SELECT'),            -- ждём false
       has_table_privilege('authenticated', 'public.payments', 'INSERT'); -- ждём false
```

и советник безопасности (Security Advisor) — без новых ошибок. Откат — `down.sql` той же миграции: возвращает
умолчания Supabase (ALL), нужен только если Data API для `public` открывают намеренно. Умолчания роли
`supabase_admin` миграции недоступны — их видно только советником.

## Что с `wetop_service`

Роль создана миграцией (с `BYPASSRLS`, если роль миграций может его раздать; иначе — без него, NOTICE в выводе
`mig deploy`). Служебные пути API сейчас ходят прежней ролью по `DATABASE_URL` — на неё политики не действуют, отдельный
вход для `wetop_service` не нужен. Роль оставлена для скриптов и будущей передачи служебного пути с роли владельца
таблиц (§17.2).
