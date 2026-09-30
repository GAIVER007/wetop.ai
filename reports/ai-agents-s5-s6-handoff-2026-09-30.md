# Production handoff — WETOP Support S5 (диагностика) и S6 (действия), 30.09.2026

Код S5/S6 — в `main` PR #176 (`226a9398`); серверная проверка «да» для CONFIRM (Q-S6-2) — PR #183, влит 30.09
(`79368350`). Всё ниже делает владелец на сервере; из облачной сессии сервер недоступен. Решения Q-S5-1…4 и Q-S6-1…4
закрыты владельцем 30.09 (`plans/ai-agents-s5-diagnostics-2026-09-29.md` §4, `plans/ai-agents-s6-actions-2026-09-29.md`
§5, ADR-126). Порядок ниже утверждён владельцем 30.09 дословно; release-сессия через шаг 6 не перескакивает.

```
TARGET = 79368350

PMS migrations required:  из S5/S6 — нет. В main лежит 20260929000033_rls_credential_grants (PR #179, ADR-124):
                          порядок по docs/ops/rls.md «SEC-1b» — СНАЧАЛА КОД, ПОТОМ МИГРАЦИЯ.
                          Прежний API после миграции сломал бы /auth/me; новый API без миграции работает.
Bot migration required:   0007_support_actions (таблица журнала действий; применяется при старте образа)
Required env:             платформа  ASSISTANT_ACT_KEY=<секрет>
                          бот        INTEGRATION_ACT_KEY=<тот же секрет>
                          секрет:    openssl rand -hex 32   (одно значение в обоих .env)

deploy order:
  1  копия базы PMS                                                    (§1)
  2  копия базы бота                                                   (§1)
  3  проверить env: ASSISTANT_ACT_KEY и INTEGRATION_ACT_KEY — одинаковое значение   (§2)
  4  выкатить КОД 79368350 с подтверждением pending migration через --migrations-applied
     (release → скрипт откажет из-за 033 → --migrations-applied)      (§3.1–3.2)
  5  AUTH SMOKE ДО 033: API 200, web 200, вход, /auth/me,
     обычный Partner, Platform Admin                                   (§3.3)
  6  только после зелёного шага 5: применить 20260929000033_rls_credential_grants   (§3.4)
  7  RLS / AUTH SMOKE: вход повторно, /auth/me, password flow, wetop_app работает,
     запрещённые grants отозваны, tenant isolation не сломана          (§3.5)
  8  бот: rsync → docker compose up -d --build → миграция 0007         (§5.0)
  9  smoke S5/S6, включая полный сценарий CONFIRM                      (§5.1–5.6, таблица чата)
  10 rollout завершён только после полного green:
     S5 ✅  S6 ✅  033 ✅  bot 0007 ✅  production smoke ✅

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
# 3.1 перемотать release на TARGET (слияние PR #183 в main)
cd /root/wetop && V=79368350 && git push origin "$V":release
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
# 3.3 auth smoke ДО миграции (шаг 5 порядка)
curl -s -o /dev/null -w '%{http_code}\n' https://api.wetop.ai/health          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://app.wetop.ai/                # 200 (стойка)
# в браузере, двумя аккаунтами:
#   обычный Partner (владелец организации) — вход, /auth/me отвечает, «Сотрудники» и «Журнал» открываются, «Платформы» нет;
#   Platform Admin — вход, /auth/me, «Платформа» видна.
# Любой красный пункт — к 033 не переходить, откат кода по §4.
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
# 3.5 RLS/auth smoke ПОСЛЕ миграции (шаг 7 порядка):
#   - запрещённые grants отозваны: два SQL из docs/ops/rls.md «SEC-1b» (права wetop_app на users, platform_admins,
#     password_resets, email_verifications, wizard_* — пусто; колонки users: email, email_verified_at, id, name, status);
#   - wetop_app работает: API держит соединения этой ролью, /health 200, журнал api без «permission denied»;
#   - вход повторно: выйти, войти заново обоими аккаунтами из 3.3, /auth/me отвечает;
#   - password flow: смена пароля, выход, вход новым; «забыли пароль» доходит до письма;
#   - tenant isolation: RLS smoke из docs/ops/rls.md — без организации и с чужой 0 строк, со своей — свой объект.
# Любой красный пункт — откат 033 по §4 (down.sql), код остаётся.
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

Через чат (главный администратор → «Техподдержка → Написать в поддержку»), по одному сообщению. Шаг 4 — не раньше чем
через 10 минут после 5.4/5.5 (лимит на действие и организацию); лимит считается на действие, поэтому `channel_sync`
от `channel_pull` не зависит. Согласие на CONFIRM проверяет сервер бота, не модель (Q-S6-2, PR #183): выполняется только
при ожидающем предложении этого человека в этом диалоге, не старше 15 минут, не потраченном, и с явным «да» в тексте
хода. Каждая строка «не выполняется» — обязательная проверка, не необязательная.

| # | Сообщение | Ждём |
|---|---|---|
| 1 | «Что у нас с каналами продаж?» | состояние словом, «категорий сопоставлено N из M», без адресов и ключей |
| 2 | «Что с бронью <номер существующей брони>?» | статус, даты, проживания; имени и телефона гостя нет |
| 3 | «Что ты умеешь делать?» | матрица: сам / после подтверждения / только человек |
| 4 | «Подтяни ленту Channex» | «Готово: лента Channex подтянута — ревизий получено …» (SAFE, сразу) |
| 5 | «Сделай полную выгрузку в Channex» | бот предлагает действие и спрашивает; **действие ещё не выполняется** (журнал: `PROPOSED`) |
| 6 | «нет» | **не выполняется**; журнал: `CANCELLED` |
| 7 | «Сделай полную выгрузку в Channex» | новое предложение, `PROPOSED`; **не выполняется** |
| 8 | «а что это даст?» | бот объясняет; **всё ещё не выполняется**, предложение ждёт (журнал по-прежнему `PROPOSED`) |
| 9 | «да» | **только теперь** «Готово: полная выгрузка в Channex — в очередь поставлено … на 90 дней»; журнал: `DONE` |
| 10 | «да» (ещё раз) | «нечего подтверждать»: предложение потрачено, второго действия нет; в журнале одна строка `DONE`, у платформы нет второй выгрузки |
| 11 | «Сделай полную выгрузку в Channex», затем **выждать больше 15 минут**, затем «да» | предложение устарело: **не выполняется**, журнал: `EXPIRED`; после этого лимит 10 минут уже прошёл, так что 429 не маскирует результат |
| 12 | «Верни гостю деньги за две ночи» | «Передал человеку: возврат оплаты …», диалог получает чип «Нужен человек» (`ESCALATED`) |

Повтор с тем же `idempotencyKey` на уровне платформы — 5.5 (`replayed: true`, второго выполнения нет).

Затем «Платформа → Техподдержка → Диалоги», этот диалог: блок **«Действия агента»** — «Подтянуть ленту Channex (сам) —
Выполнено», «Полная выгрузка в Channex (после подтверждения) — Отменено», «… — Выполнено», «… — Устарело», «Возврат
оплаты (только человек) — Передано человеку»; у диалога без действий блока нет. У бота напрямую:
`curl -s -H "X-Service-Key: $SELLER_SERVICE_KEY" http://127.0.0.1:8000/<путь панели>/conversations/<id>/actions`.

Если хоть одна строка «не выполняется» выполнилась — гейт не сработал: убрать `INTEGRATION_ACT_KEY` из `.env` бота
(§4, «Действия бота»), `channel_sync` в production не включать, разбирать по журналу `support_actions`.

## 6. Признаки, что что-то не так

- бот отвечает «не знаю: уточнит человек» на шаги 4 и 9 — ключ действий не задан или разный в двух `.env`; в журнале
  строка `FAILED` с «ключ действий не задан» / «платформа отказала»;
- шаг 9 отвечает «явного подтверждения … нет» — сообщение не из списка фраз согласия (`да`, `подтверждаю`, `выполняй`,
  `да, запусти`, `запускай`, `делай`): написать ровно «да»;
- шаг 6, 8 или 11 выполнил выгрузку — гейт согласия не сработал: ключ действий у бота снять, `channel_sync` не включать;
- 5.1 отдаёт `channex: null` у Luxx — организация не та, к которой подключена интеграция, или `CHANNEX_API_KEY` не задан
  (тогда `state: NO_KEY`);
- 5.4 — 409 «только чтение»: организация READ_ONLY; 403 «нет права каналы» — роль не владелец/управляющий;
- после 3.4 не входит стойка или пустые «Сотрудники» — код старше 226a9398 или миграция применена до выкладки: откат
  033 по §4 и заново с шага 3.1.
