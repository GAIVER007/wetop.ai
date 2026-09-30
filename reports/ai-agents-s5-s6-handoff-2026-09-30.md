# Production handoff — WETOP Support S5 (диагностика) и S6 (действия), 30.09.2026

Код S5/S6 — в `main` PR #176 (`226a9398`); серверная проверка «да» для CONFIRM (Q-S6-2) — PR #183. Всё ниже делает
владелец на сервере; из облачной сессии сервер недоступен. Решения Q-S5-1…4 и Q-S6-1…4 закрыты владельцем 30.09
(`plans/ai-agents-s5-diagnostics-2026-09-29.md` §4, `plans/ai-agents-s6-actions-2026-09-29.md` §5, ADR-126).

```
PMS migrations required:  из S5/S6 — нет. В main лежит 20260929000033_rls_credential_grants (PR #179, ADR-124):
                          порядок по docs/ops/rls.md «SEC-1b» — СНАЧАЛА КОД, ПОТОМ МИГРАЦИЯ.
                          Прежний API после миграции сломал бы /auth/me; новый API без миграции работает.
Bot migration required:   0007_support_actions (таблица журнала действий; применяется при старте образа)
Required env:             платформа  ASSISTANT_ACT_KEY=<секрет>
                          бот        INTEGRATION_ACT_KEY=<тот же секрет>
                          секрет:    openssl rand -hex 32   (одно значение в обоих .env)

deploy order:
  1 копии PMS и базы бота
  2 ключи действий в оба .env
  3 API и стойка — код с 033 в дереве, миграцию НЕ применять (release → отказ скрипта → --migrations-applied)
  4 auth smoke (вход, /auth/me, «Сотрудники», «Журнал»)
  5 миграция PMS 033
  6 RLS/auth smoke (SQL из docs/ops/rls.md «SEC-1b» + вход заново)
  7 бот: rsync → up -d --build → миграция 0007
  8 web уже выложен шагом 3 — проверить, что стойка перезапущена после правки .env
  9 полный smoke S5/S6 (§5)

rollback:                 §4
smoke:                    §5
```

## 1. Копии

```bash
# PMS — как обычно (docs/ops/backups.md): свежая копия до любой миграции, $BACKUP
# бот — своя база в docker compose
cd /opt/wetop-bot/assistant
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /root/backups/bot-$(date -u +%Y%m%dT%H%M%SZ).sql
ls -la /root/backups | tail -2
```

## 2. Ключи действий

```bash
openssl rand -hex 32      # один раз; значение — руками в оба файла, сюда не копировать
# /root/wetop/.env                → ASSISTANT_ACT_KEY=<секрет>
# /opt/wetop-bot/assistant/.env   → INTEGRATION_ACT_KEY=<секрет>
```

## 3. API и стойка — код первым, миграция 033 после

```bash
# 3.1 перемотать release на проверенный коммит (после слияния PR #183 — его вершина; иначе 226a9398)
cd /root/wetop && V=<коммит> && git push origin "$V":release
tail -20 /var/log/wetop-deploy.log
# скрипт ОТКАЖЕТ: «в обновлении новые миграции — 20260929000033_rls_credential_grants». Это ожидаемо.
```

```bash
# 3.2 выложить код без применения миграции: флаг снимает только проверку миграций (docs/deploy.md §1д);
#     код 226a9398+ от прав 033 не зависит (docs/ops/rls.md «SEC-1b»)
/usr/local/sbin/wetop-auto-deploy --migrations-applied "$V"
tail -f /var/log/wetop-deploy.log        # ждём «выложено <V>», /health ok; api и web перезапущены, .env с ключом прочитан
```

```bash
# 3.3 auth smoke ДО миграции
curl -s -o /dev/null -w '%{http_code}\n' https://api.wetop.ai/health          # 200
# в браузере: войти в стойку, открыть «Сотрудники» и «Журнал», /auth/me отвечает; главный администратор видит «Платформу»
```

```bash
# 3.4 миграция 033 — только после зелёного 3.3 и свежей копии
rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$V" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL \
    -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
mig status     # ждём: не применена только 20260929000033_rls_credential_grants
mig deploy
mig status     # ждём: Database schema is up to date
```

```bash
# 3.5 RLS/auth smoke ПОСЛЕ миграции — два SQL из docs/ops/rls.md «SEC-1b» (права wetop_app на users, platform_admins,
#     password_resets, email_verifications, wizard_* — пусто; колонки users: email, email_verified_at, id, name, status);
#     затем в стойке: выйти, войти заново, «Сотрудники», «Журнал», смена пароля и вход новым
```

Откат этого шага, если 3.3 или 3.5 красные: §4.

## 4. Откат

| Что | Как |
|---|---|
| Миграция 033 | `down.sql` этой миграции из копии базы (`docs/ops/backups.md`) — `wetop_app` снова получает полный доступ; код продолжает работать |
| API и стойка | `docs/deploy.md` §4: прежний коммит из `/var/lib/wetop-deploy/previous`, образ `pms-lux:rollback-<коммит>`, `up -d api web` без сборки. Миграций S5/S6 нет — в базе PMS откатывать нечего. **Прежний код после применённой 033 работать не будет** — откатывать код только вместе с `down.sql` 033 |
| Действия бота | убрать `INTEGRATION_ACT_KEY` из `.env` бота и `docker compose up -d app` — бот снова только читает; матрица, диагностика и «нужен человек» остаются. Или убрать `ASSISTANT_ACT_KEY` у платформы — те же действия получат отказ ключа |
| Бот целиком | прежний `apps/ai-seller` из нужного коммита → тот же `rsync` → `docker compose up -d --build`; таблица `support_actions` прежнему коду не мешает; снять её: `docker compose exec app alembic downgrade 0006` |
| База бота | `docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < /root/backups/bot-<метка>.sql` |

## 5. Бот и smoke S5/S6

```bash
# 5.0 бот (после зелёного 3.5)
cd /root/wetop
git pull origin main

rsync -a \
  --exclude .env \
  --exclude data \
  --exclude logs \
  --exclude compose.override.yml \
  /root/wetop/apps/ai-seller/ \
  /opt/wetop-bot/assistant/

cd /opt/wetop-bot/assistant
docker compose up -d --build

docker compose logs app --tail 50 | grep -i "0007\|alembic\|error"     # ждём: upgrade 0006 -> 0007, ошибок нет
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "\d support_actions"' | head -5
curl -s https://assistant.wetop.ai/health                              # {"status":"ok"}
```

Подставить: `$U` — UUID главного администратора, `$O` — UUID организации Luxx (интеграция), `$O2` — UUID другой
организации, `$RK` — `ASSISTANT_READ_KEY`, `$AK` — `ASSISTANT_ACT_KEY` (из `.env`, в чат не копировать).
`A=http://127.0.0.1:3001` изнутри сервера (или `https://api.wetop.ai`).

```bash
H='content-type: application/json'
# 5.1 диагностика читающим ключом — 200, channex не null у Luxx
curl -s -H "x-wetop-service-key: $RK" "$A/assistant/integrations?userId=$U&organizationId=$O" | head -c 400; echo
# 5.2 чужая пара — 404 (tenant isolation)
curl -s -o /dev/null -w '%{http_code}\n' -H "x-wetop-service-key: $RK" "$A/assistant/integrations?userId=$U&organizationId=$O2"
# 5.3 ключ чтения на действие — 403; без ключа — 401; ключ действий на чтение — 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "x-wetop-service-key: $RK" -H "$H" -d "{\"userId\":\"$U\",\"organizationId\":\"$O\",\"idempotencyKey\":\"smoke-1\"}" "$A/assistant/actions/channel-pull"
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "$H" -d "{\"userId\":\"$U\",\"organizationId\":\"$O\",\"idempotencyKey\":\"smoke-1\"}" "$A/assistant/actions/channel-pull"
curl -s -o /dev/null -w '%{http_code}\n' -H "x-wetop-service-key: $AK" "$A/assistant/integrations?userId=$U&organizationId=$O"
# 5.4 «подтянуть ленту» ключом действий — 200 {ok:true, action:channel_pull, received/processed/failed}
curl -s -X POST -H "x-wetop-service-key: $AK" -H "$H" -d "{\"userId\":\"$U\",\"organizationId\":\"$O\",\"idempotencyKey\":\"smoke-2\"}" "$A/assistant/actions/channel-pull"; echo
# 5.5 повтор с тем же ключом идемпотентности — replayed:true; новый ключ сразу — 429
curl -s -X POST -H "x-wetop-service-key: $AK" -H "$H" -d "{\"userId\":\"$U\",\"organizationId\":\"$O\",\"idempotencyKey\":\"smoke-2\"}" "$A/assistant/actions/channel-pull"; echo
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "x-wetop-service-key: $AK" -H "$H" -d "{\"userId\":\"$U\",\"organizationId\":\"$O\",\"idempotencyKey\":\"smoke-3\"}" "$A/assistant/actions/channel-pull"
# 5.6 чужая организация ключом действий — 404; организация без интеграции — 409
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "x-wetop-service-key: $AK" -H "$H" -d "{\"userId\":\"$U\",\"organizationId\":\"$O2\",\"idempotencyKey\":\"smoke-4\"}" "$A/assistant/actions/channel-pull"
```

Через чат (главный администратор → «Техподдержка → Написать в поддержку»), по одному сообщению; шаг 4 и 6 не раньше
чем через 10 минут после 5.4/5.5 (лимит на действие и организацию):

| # | Сообщение | Ждём |
|---|---|---|
| 1 | «Что у нас с каналами продаж?» | состояние словом, «категорий сопоставлено N из M», без адресов и ключей |
| 2 | «Что с бронью <номер существующей брони>?» | статус, даты, проживания; имени и телефона гостя нет |
| 3 | «Что ты умеешь делать?» | матрица: сам / после подтверждения / только человек |
| 4 | «Подтяни ленту Channex» | «Готово: лента Channex подтянута — ревизий получено …» (SAFE, сразу) |
| 5 | «Сделай полную выгрузку в Channex» | бот спрашивает подтверждение, ничего не делает |
| 6 | «а что это даст?» | **действие не выполняется** (Q-S6-2: «да» не написано), бот объясняет и снова спрашивает |
| 7 | «да» | «Готово: полная выгрузка в Channex — в очередь поставлено … на 90 дней» |
| 8 | «Верни гостю деньги за две ночи» | «Передал человеку: возврат оплаты …», диалог получает чип «Нужен человек» |

Затем «Платформа → Техподдержка → Диалоги», этот диалог: блок **«Действия агента»** — «Подтянуть ленту Channex (сам) —
Выполнено», «Полная выгрузка в Channex (после подтверждения) — Выполнено», «Возврат оплаты (только человек) — Передано
человеку»; у диалога без действий блока нет. У бота напрямую:
`curl -s -H "X-Service-Key: $SELLER_SERVICE_KEY" http://127.0.0.1:8000/<путь панели>/conversations/<id>/actions`.

## 6. Признаки, что что-то не так

- бот отвечает «не знаю: уточнит человек» на шаги 4 и 7 — ключ действий не задан или разный в двух `.env`; в журнале
  строка `FAILED` с «ключ действий не задан» / «платформа отказала»;
- шаг 7 отвечает «явного подтверждения … нет» — сообщение не из списка фраз согласия (`да`, `подтверждаю`, `выполняй`,
  `да, запусти`, `запускай`, `делай`): написать ровно «да»;
- 5.1 отдаёт `channex: null` у Luxx — организация не та, к которой подключена интеграция, или `CHANNEX_API_KEY` не задан
  (тогда `state: NO_KEY`);
- 5.4 — 409 «только чтение»: организация READ_ONLY; 403 «нет права каналы» — роль не владелец/управляющий;
- после 3.4 не входит стойка или пустые «Сотрудники» — код старше 226a9398 или миграция применена до выкладки: откат
  033 по §4 и заново с шага 3.1.
