# Production handoff — WETOP Support S5 (диагностика) и S6 (действия), 30.09.2026

Код влит в `main` PR #176 (`226a9398`). Всё ниже делает владелец на сервере; из облачной сессии сервер недоступен.
Порядок: **бот → API → стойка**. Перед первым шагом — копии баз.

```
PMS migrations required: из S5/S6 — нет. В main лежит 20260929000033_rls_credential_grants (PR #179):
                         если на рабочей базе не применена — применить до выкладки release (порядок §1д docs/deploy.md)
Bot migration required:  0007_support_actions (таблица support_actions; применяется при старте образа)
Required env:            платформа  ASSISTANT_ACT_KEY=<секрет>
                         бот        INTEGRATION_ACT_KEY=<тот же секрет>
                         секрет:    openssl rand -hex 32   (один и тот же в обоих .env)
deploy order:            1 копии баз → 2 миграция PMS 033 (если нет) → 3 ключи в .env → 4 бот → 5 API → 6 web → 7 smoke
rollback:                §4 ниже
smoke:                   §5 ниже
```

## 1. Копии

```bash
# PMS — как обычно (docs/ops/backups.md), $BACKUP — свежая копия до любой миграции
# бот — своя база в docker compose:
cd /opt/wetop-bot/assistant
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /root/backups/bot-$(date -u +%Y%m%dT%H%M%SZ).sql
ls -la /root/backups | tail -2
```

## 2. Миграция PMS 033 (если ещё не применена)

```bash
cd /root/wetop && V=226a9398
rm -rf /tmp/wetop-mig && mkdir -p /tmp/wetop-mig && git archive "$V" packages/database/prisma | tar -x -C /tmp/wetop-mig
mig() { ( set -a; . ./.env; set +a
  export DIRECT_URL="${BACKUP_DATABASE_URL:-${DIRECT_URL:-$DATABASE_URL}}"
  docker run --rm -e DIRECT_URL \
    -v /tmp/wetop-mig/packages/database/prisma:/app/packages/database/prisma:ro \
    -w /app/packages/database pms-lux:latest npx prisma migrate "$@" ); }
mig status     # если «20260929000033_rls_credential_grants» не применена:
mig deploy     # только после свежей копии
mig status     # ждём: Database schema is up to date
```

## 3. Ключи и выкладка

```bash
# 3.1 секрет — один раз, значение вписывается в оба .env руками (сюда не копировать)
openssl rand -hex 32

# /root/wetop/.env                 → ASSISTANT_ACT_KEY=<секрет>
# /opt/wetop-bot/assistant/.env    → INTEGRATION_ACT_KEY=<секрет>
```

```bash
# 3.2 бот (миграция 0007 применится при старте образа)
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

```bash
# 3.3 API и стойка — веткой release (docs/deploy.md §1д); миграций в 226a9398 сверх 033 нет
cd /root/wetop && git push origin 226a9398:release
tail -f /var/log/wetop-deploy.log        # ждём «выложено 226a9398», /health ok; скрипт сам перезапускает api и web
# ASSISTANT_ACT_KEY читается при старте api — если .env правили после выкладки: docker compose up -d api
```

## 4. Откат

| Что | Как |
|---|---|
| API и стойка | `docs/deploy.md` §4 (ручной откат): прежний коммит `707c2e0a` или `/var/lib/wetop-deploy/previous`, образ `pms-lux:rollback-<коммит>`, `up -d api web` без сборки. Миграции S5/S6 не добавляли — откатывать в базе PMS нечего |
| Действия бота | убрать `INTEGRATION_ACT_KEY` из `.env` бота и `docker compose up -d app` — бот снова только читает, матрица и «нужен человек» остаются; или убрать `ASSISTANT_ACT_KEY` у платформы — те же действия получат отказ ключа |
| Бот целиком | `cd /opt/wetop-bot/assistant && git -C /root/wetop checkout <прежний коммит> -- apps/ai-seller` → тот же `rsync` → `docker compose up -d --build`; таблица `support_actions` прежнему коду не мешает; снять её: `docker compose exec app alembic downgrade 0006` |
| База бота | `docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < /root/backups/bot-<метка>.sql` |

## 5. Smoke

Подставить: `$U` — UUID главного администратора, `$O` — UUID организации Luxx (интеграция), `$O2` — UUID любой другой
организации, `$RK` — `ASSISTANT_READ_KEY`, `$AK` — `ASSISTANT_ACT_KEY` (значения — из `.env`, в чат не копировать).
API изнутри сервера: `A=http://127.0.0.1:3001` (или `https://api.wetop.ai`).

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

Через чат (главный администратор → «Техподдержка → Написать в поддержку»), по одному сообщению:

| # | Сообщение | Ждём |
|---|---|---|
| 1 | «Что у нас с каналами продаж?» | ответ по `get_integration_health`: состояние словом, «категорий сопоставлено N из M», без адресов и ключей |
| 2 | «Что с бронью <номер существующей брони>?» | статус, даты, проживания; имени и телефона гостя нет |
| 3 | «Что ты умеешь делать?» | матрица: сам / после подтверждения / только человек |
| 4 | «Подтяни ленту Channex» | «Готово: лента Channex подтянута — ревизий получено …» (SAFE, сразу) |
| 5 | «Сделай полную выгрузку в Channex» | бот спрашивает подтверждение, ничего не делает |
| 6 | «да» | «Готово: полная выгрузка в Channex — в очередь поставлено … на 90 дней» |
| 7 | «Верни гостю деньги за две ночи» | «Передал человеку: возврат оплаты …», диалог получает чип «Нужен человек» в очереди |

Затем в кабинете «Платформа → Техподдержка → Диалоги» открыть этот диалог: блок **«Действия агента»** — строки
«Подтянуть ленту Channex (сам) — Выполнено», «Полная выгрузка в Channex (после подтверждения) — Выполнено», «Возврат
оплаты (только человек) — Передано человеку»; у диалога без действий блока нет. У бота напрямую:
`curl -s -H "X-Service-Key: $SELLER_SERVICE_KEY" http://127.0.0.1:8000/<путь панели>/conversations/<id>/actions`.

Порог лимита: шаг 4 и 6 — разные действия, лимит не мешает; повтор шага 4 в течение 10 минут даст «не знаю: уточнит
человек» (429 у платформы) — это ожидаемо.

## 6. Признаки, что что-то не так

- бот отвечает «не знаю: уточнит человек» на шаги 4 и 6 — ключ действий не задан или разный в двух `.env`; в журнале
  действий строка `FAILED` с «ключ действий не задан» / «платформа отказала»;
- 5.1 отдаёт `channex: null` у Luxx — организация не та, к которой подключена интеграция (`isIntegrationActor`), или
  `CHANNEX_API_KEY` не задан (тогда `state: NO_KEY`);
- 5.4 — 409 «только чтение»: организация READ_ONLY; 403 «нет права каналы» — роль не владелец/управляющий.
