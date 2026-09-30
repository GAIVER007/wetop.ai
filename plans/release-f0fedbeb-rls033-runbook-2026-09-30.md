# Памятка выкладки `f0fedbeb` с миграцией `033` (код раньше миграции)

Для master release/deploy-сессии с доступом к серверу. **Облачная сессия, которая её собрала, на сервере ничего не выполняла.**
Решение владельца 30.09.2026: вариант 1, «делать правильно»; `release` до конца проверки не двигать.

| | |
|---|---|
| Сейчас на сервере (`release`) | `7ee096dd` |
| Цель | `f0fedbeb` (PR #179 — крупный шрифт; всего 33 коммита от `7ee096dd`, это полный релиз, не хотфикс) |
| Миграция | `20260929000033_rls_credential_grants` (единственная в диапазоне, других файлов в `deploy/` нет) |
| Порядок | **КОД → проверка → 033 → проверка → `release`** |

Источники, и только они: `docs/deploy.md` §1а, §1д, §4 и «Текущая серверная выкладка»; `docs/ops/rls.md` (этапы 1–3, SEC-1a,
SEC-1b); `docs/ops/backups.md`; `migration.sql` и `down.sql` миграции 033; `scripts/ops/auto-deploy.sh`; прецедент ручной
выкладки `reports/deploy-unified-workspace-2026-09-29.md`. Всё, чего в них нет, помечено **[вне runbook]**.

## Почему не обычная автовыкладка

- `rls.md`, SEC-1b: «сначала выкладка кода, потом миграция. Код от прав не зависит; прежний код без миграции — тоже. Но
  прежний код после миграции сломал бы `/auth/me`».
- `auto-deploy.sh` на вершине с новой миграцией отказывает. Флаг `--migrations-applied <вершина>` миграций **не применяет**,
  он только пропускает их проверку и требует, чтобы вершина уже была `origin/release`, то есть сначала двигать `release`.
- Поэтому код выкладывается ручным путём §1а при неподвижном `release`, а `release` и маркер автовыкладки приводятся к цели
  в конце, как в прецеденте 29.09.

Пока `release` = `7ee096dd` и маркер `/var/lib/wetop-deploy/deployed` = `7ee096dd`, cron ничего не делает: вершина та же, он
выходит молча. Замок `/var/lib/wetop-deploy/lock` на время работ держим дополнительно (прецедент 29.09).

---

## 0. PRECHECK — только чтение

```bash
cd /root/wetop
C="docker compose -f deploy/compose.yml"; [ -f deploy/compose.hostinger.yml ] && C="$C -f deploy/compose.hostinger.yml"
T=$(git rev-parse f0fedbeb)                                   # полный SHA цели; не найден — git fetch -q origin и повторить
cat /var/lib/wetop-deploy/deployed                            # 7ee096dd… — что выложено по записи автовыкладки
cat /var/lib/wetop-deploy/refused 2>/dev/null; echo          # пусто или старая вершина
git rev-parse HEAD                                            # 7ee096dd…
git status --short                                            # пусто или только ?? deploy/compose.hostinger.yml
git fetch -q origin && git rev-parse origin/release           # 7ee096dd…
git merge-base --is-ancestor HEAD "$T" && echo ff-ok          # цель продолжает текущую
git diff --name-only HEAD "$T" -- packages/database/prisma/migrations
#   ровно два файла: …20260929000033_rls_credential_grants/migration.sql и down.sql
grep -c '^DATABASE_APP_URL=' .env                             # 1   (значение не печатаем)
grep -c '^AUTH_REQUIRED=0' .env                               # 0   (rls.md: AUTH_REQUIRED не 0)
grep -c '^RLS_DISABLED=1' .env                                # 0
grep -c '^INTEGRATION_PROPERTY_ID=' .env                      # 1 желательно; 0 — API найдёт объект по названию
                                                              #   и напишет предупреждение (SEC-2, в диапазоне)
$C ps api web                                                 # оба Up (healthy)
$C exec -T api wget -qO- http://127.0.0.1:3001/health         # "status":"ok"
$C exec -T api wget -qO- http://127.0.0.1:3001/auth/options   # записать registrationEnabled — после выкладки то же
docker image inspect pms-lux:latest --format '{{.Id}}'        # записать ID прежнего образа

# роль API — wetop_app (rls.md, этап 3)
( set -a; . ./.env; set +a
  docker run --rm -e U="${BACKUP_DATABASE_URL:-$DIRECT_URL}" postgres:17 sh -c \
    'psql "$U" -Atc "select usename, count(*) from pg_stat_activity where usename like '"'"'wetop%'"'"' or usename = '"'"'postgres'"'"' group by 1"' )
#   ждём строку wetop_app|N

# роль входит и без контекста организации не видит броней (rls.md, этап 2)
( set -a; . ./.env; set +a
  docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
    'psql "$DATABASE_APP_URL" -Atc "select current_user, count(*) from reservations"' )
#   ждём wetop_app|0

# migrate status по миграциям цели (deploy.md §1д, rls.md этап 1)
rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$T" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL \
    -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
mig status                                                    # не применена ровно одна: 20260929000033_rls_credential_grants
```

**Проверено SEC-1a:** в production API не стартует, если соединение идёт не ролью `wetop_app` или у роли `BYPASSRLS`
(`rls.md`, «Проверка при старте»). Раз API сейчас «Up (healthy)» на `DATABASE_APP_URL`, `BYPASSRLS=false` уже подтверждён
запуском. После пересборки на шаге 2 это проверится снова.

## 1. BACKUP

```bash
cd /root/wetop
cp .env /root/backups/env-before-033-$(date -u +%Y%m%dT%H%M%SZ)      # как в rls.md, этап 2; значения не печатаем
BACKUP='docker run --rm -v /root/wetop/scripts/ops/db-backup.sh:/db-backup.sh:ro -v /root/wetop/.env:/wetop.env:ro -v /root/backups:/root/backups -e ENV_FILE=/wetop.env postgres:17 bash /db-backup.sh'
$BACKUP                               # ждём «db-backup: wetop-<UTC>.dump — …, таблиц с данными: N»; нет строки — STOP
ls -lt /root/backups | head -4        # свежий wetop-<UTC>.dump, права -rw-------
cat /root/backups/status/last.json    # то же имя файла и время
# пробное восстановление «перед каждой миграцией» (backups.md)
docker run -d --rm --name wetop-restore-check -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v /root/backups:/root/backups:ro -v /root/wetop/scripts/ops/db-restore-check.sh:/db-restore-check.sh:ro postgres:17
until docker exec wetop-restore-check pg_isready -h 127.0.0.1 -q; do sleep 1; done
docker exec -e RESTORE_CHECK_URL=postgresql://postgres@127.0.0.1:5432/postgres wetop-restore-check \
  bash /db-restore-check.sh "$(ls -t /root/backups/wetop-*.dump | head -1)"
docker rm -f wetop-restore-check
# ждём «restore-check: wetop-….dump восстановлена — таблиц N из N, …, inventory_units: 88 …»
```

Записать в журнал выкладки имя копии. Без строки `restore-check: … восстановлена` дальше не идём.

## 2. DEPLOY CODE FIRST — `f0fedbeb` без миграции

```bash
cd /root/wetop
exec 9>/var/lib/wetop-deploy/lock && flock -n 9 && echo lock-held   # прецедент 29.09; держим до шага 5
docker image tag pms-lux:latest pms-lux:rollback-7ee096dd          # точка отката (имя — как у auto-deploy.sh)
git checkout -B release "$T"                                        # так же переключает клон auto-deploy.sh
$C up -d --build --no-deps api web                                  # §1а; туннель и .env не трогаются
$C ps api web                                                       # оба Up (healthy)
$C logs --tail 50 api | grep -E 'PMS API'
#   ждём «PMS API: http://…/health»; «PMS API не запущен: …» — STOP, сценарий A
$C exec -T api wget -qO- http://127.0.0.1:3001/health               # "status":"ok"
$C exec -T web cat .next/BUILD_ID                                   # записать; должен отличаться от прежнего
$C exec -T api wget -qO- http://127.0.0.1:3001/auth/options         # registrationEnabled — как в precheck
curl -s -o /dev/null -w '%{http_code}\n' https://app.wetop.ai/login                                   # 200
curl -si -X OPTIONS -H 'Origin: https://wetop.ai' https://app.wetop.ai/api/site-auth/login | head -5  # 204 и ACAO
# роль API после пересборки — снова wetop_app (запрос из шага 0)
```

Руками, в браузере (миграции ещё нет): вход под своей учёткой → открывается `/today`; «Профиль» открывается (это
`/auth/me`); шрифт крупнее. Не работает вход или профиль — **STOP, сценарий A**.

## 3. APPLY MIGRATION 033 — только после зелёного шага 2

```bash
cd /root/wetop
mig status        # по-прежнему одна не применена: 20260929000033_rls_credential_grants (образ теперь f0fedbeb — это норма)
mig deploy        # ждём «All migrations have been successfully applied»
mig status        # ждём «Database schema is up to date»
# API после миграции не перезапускаем: права действуют сразу, соединения пула остаются ролью wetop_app
# роль API — wetop_app (запрос из шага 0) — ждём wetop_app|N
```

Права — в SQL-редакторе базы (`rls.md`, SEC-1b):

```sql
-- 1. Табличных прав у wetop_app на эти таблицы больше нет: ждём пустой ответ
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'wetop_app' AND table_schema = 'public'
  AND table_name IN ('users', 'platform_admins', 'password_resets', 'email_verifications',
                     'wizard_sessions', 'wizard_events', 'wizard_surveys');

-- 2. Колонки: users — email, email_verified_at, id, name, status; platform_admins — revoked_at, user_id
SELECT table_name, column_name
FROM information_schema.column_privileges
WHERE grantee = 'wetop_app' AND table_schema = 'public' AND table_name IN ('users', 'platform_admins')
ORDER BY 1, 2;
```

`mig deploy` завершился ошибкой — **STOP**. Миграция — один блок `DO $$ … $$` в транзакции: при ошибке права не меняются,
но Prisma отметит её неудачной. Дальше — с владельцем (см. «Пробелы» в конце).

## 4. POST-MIGRATION SMOKE

Руками (`rls.md` SEC-1b: «войти в стойку, открыть „Сотрудники“ и „Журнал“, сменить пароль и войти новым»):

1. Вход → `/today`; «Профиль» открывается (`/auth/me`).
2. Выход → вход снова.
3. Смена пароля → выход → вход новым паролем.
4. Вход главного администратора (Platform Admin) → «Платформа → Организации» открывается.
5. Вход обычного партнёра (не администратора платформы) → видит только свою организацию.
6. Luxx: Главная, Гости (карточка гостя), Брони (карточка брони), Шахматка, Финансы, «Каналы продаж» (Channex),
   «Сотрудники», «Журнал». Ни одной страницы «Ошибка загрузки».

Безопасность:

```bash
cd /root/wetop
# без контекста организации — ни одной брони (rls.md, этап 2)
( set -a; . ./.env; set +a
  docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
    'psql "$DATABASE_APP_URL" -Atc "select current_user, count(*) from reservations"' )     # wetop_app|0
# [вне runbook: та же форма команды, другой запрос] wetop_app не читает password_resets и хеши паролей
( set -a; . ./.env; set +a
  docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
    'psql "$DATABASE_APP_URL" -Atc "select count(*) from password_resets"' )   # ждём ERROR: permission denied
( set -a; . ./.env; set +a
  docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
    'psql "$DATABASE_APP_URL" -Atc "select password_hash from users limit 1"' ) # ждём ERROR: permission denied
```

«Организация A не видит организацию B»: готового скрипта в runbook нет. Руками — п. 5 выше: партнёр не видит Luxx, Luxx не
видит партнёра. Плюс `wetop_app|0` без контекста.

## 5. RELEASE — только после зелёного шага 4

```bash
# с любой машины с правом push (или облачной сессией по слову владельца):
git push origin f0fedbeb:release

# на сервере, под тем же замком:
cd /root/wetop && git fetch -q origin
[ "$(git rev-parse origin/release)" = "$T" ] && echo release-ok
# [вне §1д; прецедент reports/deploy-unified-workspace-2026-09-29.md — «Restore deploy-state marker»]
printf '%s\n' "$T" > /var/lib/wetop-deploy/deployed && rm -f /var/lib/wetop-deploy/refused
exec 9>&-                                                     # отпустить замок
/usr/local/sbin/wetop-auto-deploy; echo "код $?"              # §1д: вершина та же — молча, код 0
tail -3 /var/log/wetop-deploy.log                             # новых записей о выкладке нет
```

Так cron не собирает тот же код второй раз. Путь `rls.md` (`--migrations-applied "$T"` после миграции) тоже рабочий, но это
вторая сборка того же коммита, и `auto-deploy.sh` перезапишет тег `pms-lux:rollback-7ee096dd` новым образом, то есть точка
отката пропадёт. Поэтому здесь маркер.

## 6. ROLLBACK

**A. Код не работает, 033 ещё не применялась** (прецедент 29.09, `deploy.md` §4):

```bash
cd /root/wetop
git checkout -B release 7ee096dd
docker image tag pms-lux:rollback-7ee096dd pms-lux:latest
$C up -d --no-build --no-deps api web
$C exec -T api wget -qO- http://127.0.0.1:3001/health     # "status":"ok"; вход в браузере
exec 9>&-
```

`release` и маркер `deployed` не трогались и так и остаются `7ee096dd`: cron ничего не сделает. Данные не откатываются:
миграции не было.

**B. Ошибка после 033.** Порядок строго такой: сначала права, потом код. Прежний код при действующей 033 ломает `/auth/me`.

1. Вернуть права — `down.sql` 033. Это и есть «восстановление прежних grants»: он снимает и заново выдаёт `wetop_app` и
   `wetop_service` полный доступ к семи таблицам в порядке `…026`. Данные и политики не меняются.
   ```bash
   # [вне runbook: rls.md говорит «down.sql этой миграции», но команды не даёт; форма — как в rls.md, этап 2]
   cd /root/wetop && ( set -a; . ./.env; set +a
     export ADMIN="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
     git show "$T":packages/database/prisma/migrations/20260929000033_rls_credential_grants/down.sql \
       | docker run --rm -i -e ADMIN postgres:17 sh -c 'psql "$ADMIN" -v ON_ERROR_STOP=1 -q' )
   ```
   Проверка — первый SQL из шага 3 снова показывает `SELECT, INSERT, UPDATE, DELETE` на семи таблицах.
2. `rls.md`: после `down.sql` «код продолжает работать». Если беда была только в правах — **код `f0fedbeb` можно
   оставить**, повторить шаг 4.
3. Если сломан и сам код — сценарий A.

**Где `down.sql` недостаточно:**

- Он не трогает запись в `_prisma_migrations`: 033 останется «применённой», и следующий `mig deploy` её не повторит. Снять
  отметку — `mig resolve --rolled-back 20260929000033_rls_credential_grants`. **[вне runbook, стандартная команда
  Prisma]** — только по решению владельца.
- `mig deploy` упал посередине: права не менялись (транзакция), `down.sql` не нужен, но отметка «failed» в
  `_prisma_migrations` блокирует следующие `mig deploy` — то же `resolve`, решение владельца.
- Нужна порча данных, а не прав: `down.sql` данные не возвращает. Восстановление рабочей базы из копии в runbook не
  описано (`db-restore-check.sh` восстанавливает только в локальную пробную базу) — STOP, владелец.

## 7. STOP CONDITIONS — немедленно остановиться, ничего не чинить наугад

- копия не подтверждена: нет строки `db-backup: wetop-….dump` или `restore-check: … восстановлена`;
- `DATABASE_APP_URL` отсутствует (`grep -c` дал 0), либо `AUTH_REQUIRED=0`, либо `RLS_DISABLED=1`;
- API работает не под `wetop_app` (нет строки `wetop_app|N`), или в журнале `PMS API не запущен: …`;
- `mig status` в precheck показывает что-то кроме одной 033;
- после выкладки кода не работает вход, «Профиль» (`/auth/me`) или `/health` → сценарий A;
- `mig deploy` 033 не прошёл чисто;
- после 033 не работает вход или `/auth/me` → сценарий B;
- smoke изоляции не прошёл: `wetop_app` видит брони без контекста, читает `password_resets` или `password_hash`, партнёр
  видит чужую организацию → сценарий B и владелец.

---

## Один блок по порядку

```bash
# ── 0. PRECHECK ────────────────────────────────────────────────────────────────
cd /root/wetop
C="docker compose -f deploy/compose.yml"; [ -f deploy/compose.hostinger.yml ] && C="$C -f deploy/compose.hostinger.yml"
git fetch -q origin; T=$(git rev-parse f0fedbeb)
cat /var/lib/wetop-deploy/deployed; git rev-parse HEAD; git rev-parse origin/release     # все три — 7ee096dd…
git status --short                                                                      # пусто / ?? compose.hostinger.yml
git merge-base --is-ancestor HEAD "$T" && echo ff-ok
git diff --name-only HEAD "$T" -- packages/database/prisma/migrations                   # только 033
grep -c '^DATABASE_APP_URL=' .env; grep -c '^AUTH_REQUIRED=0' .env; grep -c '^RLS_DISABLED=1' .env   # 1 / 0 / 0
grep -c '^INTEGRATION_PROPERTY_ID=' .env
$C ps api web; $C exec -T api wget -qO- http://127.0.0.1:3001/health
$C exec -T api wget -qO- http://127.0.0.1:3001/auth/options
docker image inspect pms-lux:latest --format '{{.Id}}'
( set -a; . ./.env; set +a; docker run --rm -e U="${BACKUP_DATABASE_URL:-$DIRECT_URL}" postgres:17 sh -c \
  'psql "$U" -Atc "select usename, count(*) from pg_stat_activity where usename like '"'"'wetop%'"'"' or usename = '"'"'postgres'"'"' group by 1"' )
( set -a; . ./.env; set +a; docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
  'psql "$DATABASE_APP_URL" -Atc "select current_user, count(*) from reservations"' )
rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$T" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
mig status

# ── 1. BACKUP ──────────────────────────────────────────────────────────────────
cp .env /root/backups/env-before-033-$(date -u +%Y%m%dT%H%M%SZ)
BACKUP='docker run --rm -v /root/wetop/scripts/ops/db-backup.sh:/db-backup.sh:ro -v /root/wetop/.env:/wetop.env:ro -v /root/backups:/root/backups -e ENV_FILE=/wetop.env postgres:17 bash /db-backup.sh'
$BACKUP
ls -lt /root/backups | head -4; cat /root/backups/status/last.json
docker run -d --rm --name wetop-restore-check -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v /root/backups:/root/backups:ro -v /root/wetop/scripts/ops/db-restore-check.sh:/db-restore-check.sh:ro postgres:17
until docker exec wetop-restore-check pg_isready -h 127.0.0.1 -q; do sleep 1; done
docker exec -e RESTORE_CHECK_URL=postgresql://postgres@127.0.0.1:5432/postgres wetop-restore-check \
  bash /db-restore-check.sh "$(ls -t /root/backups/wetop-*.dump | head -1)"
docker rm -f wetop-restore-check

# ── 2. CODE FIRST ──────────────────────────────────────────────────────────────
exec 9>/var/lib/wetop-deploy/lock && flock -n 9 && echo lock-held
docker image tag pms-lux:latest pms-lux:rollback-7ee096dd
git checkout -B release "$T"
$C up -d --build --no-deps api web
$C ps api web
$C logs --tail 50 api | grep -E 'PMS API'
$C exec -T api wget -qO- http://127.0.0.1:3001/health
$C exec -T web cat .next/BUILD_ID
$C exec -T api wget -qO- http://127.0.0.1:3001/auth/options
curl -s -o /dev/null -w '%{http_code}\n' https://app.wetop.ai/login
curl -si -X OPTIONS -H 'Origin: https://wetop.ai' https://app.wetop.ai/api/site-auth/login | head -5
#   → браузер: вход, «Профиль». Не работает — STOP, сценарий A

# ── 3. MIGRATION 033 ───────────────────────────────────────────────────────────
mig status
mig deploy
mig status
( set -a; . ./.env; set +a; docker run --rm -e U="${BACKUP_DATABASE_URL:-$DIRECT_URL}" postgres:17 sh -c \
  'psql "$U" -Atc "select usename, count(*) from pg_stat_activity where usename like '"'"'wetop%'"'"' or usename = '"'"'postgres'"'"' group by 1"' )
#   → SQL-редактор: два запроса rls.md SEC-1b

# ── 4. SMOKE ───────────────────────────────────────────────────────────────────
( set -a; . ./.env; set +a; docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
  'psql "$DATABASE_APP_URL" -Atc "select current_user, count(*) from reservations"' )
( set -a; . ./.env; set +a; docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
  'psql "$DATABASE_APP_URL" -Atc "select count(*) from password_resets"' )
( set -a; . ./.env; set +a; docker run --rm -e DATABASE_APP_URL postgres:17 sh -c \
  'psql "$DATABASE_APP_URL" -Atc "select password_hash from users limit 1"' )
#   → браузер: список из шага 4

# ── 5. RELEASE ─────────────────────────────────────────────────────────────────
#   (где есть право push)  git push origin f0fedbeb:release
git fetch -q origin && [ "$(git rev-parse origin/release)" = "$T" ] && echo release-ok
printf '%s\n' "$T" > /var/lib/wetop-deploy/deployed && rm -f /var/lib/wetop-deploy/refused
exec 9>&-
/usr/local/sbin/wetop-auto-deploy; echo "код $?"
tail -3 /var/log/wetop-deploy.log
```

## Пояснения к командам по порядку

**0.** `C=…` — те же файлы Compose, что у автовыкладки и в `rls.md` (с наложением Hostinger, если оно есть). `T` — полный
SHA цели. Три `rev-parse` — маркер автовыкладки, клон и ветка `release` сходятся на `7ee096dd`: иначе на сервере не то,
что мы думаем. `git status` — локальных правок нет (их затёр бы `checkout`). `merge-base` — цель продолжает текущую
историю. `git diff … migrations` — в релизе только 033. `grep -c` по `.env` — условия `rls.md` (адрес роли задан, вход не
выключен, RLS не выключен) и SEC-2, без печати значений. `ps`/`health`/`auth/options`/`image inspect` — снимок «до».
Запрос `pg_stat_activity` — API держит соединения ролью `wetop_app`. Запрос `reservations` — роль без контекста
организации видит 0 броней. `mig` и `mig status` — Prisma из образа по миграциям цели; ждём ровно одну неприменённую 033.

**1.** Копия `.env` — на случай отката настроек. `$BACKUP` — `pg_dump` рабочей базы в `/root/backups/wetop-<UTC>.dump` с
проверкой `pg_restore --list` внутри скрипта. `ls` и `last.json` — копия реально лежит и статус её называет. Четыре команды
`wetop-restore-check` — копия разворачивается в пробную базу на этом же сервере, рабочую не трогают; `inventory_units` 88.

**2.** Замок — cron не вмешается, пока идёт ручная выкладка. `image tag … rollback-7ee096dd` — прежний образ под своим
именем, для сценария A. `checkout -B release "$T"` — клон на цели, как это делает сам `auto-deploy.sh`. `up -d --build
--no-deps api web` — пересобрать и поднять только API и стойку: туннель, `.env` и соседние контейнеры не трогаются. `logs |
grep` — SEC-1a: API стартовал ролью `wetop_app` без `BYPASSRLS`. `health`, `BUILD_ID`, `auth/options`, `curl /login` и
`OPTIONS site-auth` — версия новая, API с базой, регистрация не поменялась, вход и окно на wetop.ai отвечают.

**3.** `mig status → deploy → status` — применить только 033 и убедиться, что схема «up to date». Повтор запроса
`pg_stat_activity` — после смены прав API по-прежнему на `wetop_app`. Два SQL — права отозваны ровно так, как описано в
миграции.

**4.** `reservations` без контекста — 0: изоляция на месте. `password_resets` и `password_hash` под `wetop_app` —
`permission denied`: именно это закрывает 033. Остальное — руками в браузере по списку шага 4.

**5.** `git push origin f0fedbeb:release` — зафиксировать проверенный релиз в ветке. `release-ok` — сервер видит ту же
вершину. Запись в `deployed` и удаление `refused` — автовыкладка считает цель уже выложенной и не собирает её второй раз.
`exec 9>&-` — отпустить замок. Разовый запуск `wetop-auto-deploy` — должен выйти молча с кодом 0: значит, cron в следующие
две минуты ничего не тронет.

## Пробелы в документации — решить владельцу до начала

1. `rls.md` для 033 говорит одновременно «сначала код» и «по образцу этапа 1 … `--migrations-applied`». Образец этапа 1 —
   это migration-first, а флаг требует заранее передвинутого `release` и пересобирает образ. Памятка идёт путём §1а
   с маркером из прецедента 29.09. Если владелец хочет строго `--migrations-applied`, шаг 5 заменяется на
   `/usr/local/sbin/wetop-auto-deploy --migrations-applied "$T"`, и точкой отката станет ручной тег, а не `rollback-7ee096dd`.
2. Применение `down.sql` и снятие отметки в `_prisma_migrations` (`prisma migrate resolve --rolled-back`) командами в
   runbook не описаны.
3. Восстановления рабочей базы из копии в runbook нет, только пробное.
4. Изоляция «организация A не видит B» автоматически не проверяется: только ручной вход двумя учётками плюс `wetop_app|0`.
5. Шапка `deploy.md` §«Текущая серверная выкладка» говорит `REGISTRATION_OPEN=0`, а ADR-123 (29.09) — регистрация открыта.
   Памятка `.env` не трогает и лишь сверяет `registrationEnabled` до и после.
