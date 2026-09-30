# ИИ-помощник и ИИ-продавец: контракт платформы с ботом

Что платформа WETOP даёт боту и чего от него ждёт. Источник — ТЗ ред. 1 от 24.09.2026
([`tz-2026-09-24.md`](tz-2026-09-24.md) — копия `TZ-integratsiya-wetop.md` с ветки бота, обновлена 24.09 вечером до
`3014331d`: обёртка `items`, заголовок `x-wetop-service-key`, источник фактов `platform:facts.md`), решение — ADR-079, план — `plans/ai-assistant-seller-2026-09-24.md`.
Бот живёт в `apps/ai-seller/` ветки `main` (до 24.09.2026 — отдельная ветка `ai-seller` и папка на Mac «Чат агент/WETOP»,
перенесены с историей; как убрать старую папку и карта связей бота с платформой — `apps/README.md`); один образ, два экземпляра: помощник (`BOT_ROLE=support`) и
продавец (`BOT_ROLE=seller`). **Сверено с кодом бота** `origin/ai-seller` `3014331d` (Б1–Б7) 24.09.2026: где платформа
расходилась с ботом, правилась платформа; контракт бота не менялся.

Секреты и адреса — только в `.env` сторон. Ни один служебный ключ не попадает в браузер и в журнал.

---

## 1. Подпись вошедшего (П1) — для помощника

Стойка кладёт подпись в тег виджета: `<script async src="{ASSISTANT_URL}/widget/widget.js" data-identity="{token}">`.
Невошедшему атрибута нет. Подпись берёт сервер стойки у API: `GET /assistant/identity` с сессией человека.

| | |
|---|---|
| Строка под подписью | `user_id\|email\|org_id\|role\|issued_at`, `issued_at` — секунды Unix |
| Поля | в каждом `\|` заменяется пробелом, края обрезаются |
| `payload_b64` | base64url от строки в UTF-8, без `=` на конце |
| Подпись | HMAC-SHA256 от той же строки, ключ `WIDGET_IDENTITY_SECRET`, hex в нижнем регистре |
| Токен | `payload_b64` + `.` + подпись |
| Срок | 12 часов: `expiresAt` = `issued_at` + 43200 с; у помощника `WIDGET_IDENTITY_TTL_SECONDS=43200` (Б2) |

Откуда поля: `user_id` — id человека (UUID), `email` — его почта, `org_id` — организация, под которой открыта сессия
(UUID). **`role`** — роль в организации строчными: `owner`, `manager` или `staff` (ADR-083, ADR-107; до 25.09 была
пустой). Эталон ТЗ
(`42|ivan@example.com|7|owner|1700000000` → `NDJ8…MDA.7e42…9a2c`) функция платформы даёт байт в байт
(`packages/integrations/src/assistant/identity.test.ts`). 24.09 то же проверено кодом бота: `sign_identity` бота на тех
же входах даёт те же токены, `read_identity` принимает подпись платформы с UUID, пустой ролью и `|` в почте, отвергает
чужой ключ и просроченную подпись (`reports/ai-assistant-seller-2026-09-24.md` §7). Роль — вопрос Q-178.

Ответ `GET /assistant/identity`: `200 { token, expiresAt }` с `Cache-Control: no-store`; `401` — не вошёл
(служебный ключ тоже не человек); `503` — подпись не настроена (нет `WIDGET_IDENTITY_SECRET`).

Виджет читает подпись один раз при загрузке страницы. Если на странице работает виджет другого человека (вход или
выход без перезагрузки), стойка перезагружает страницу один раз — иначе следующий за стойкой видел бы чужой диалог.

## 2. Узкий ключ помощника (П4)

Заголовок `x-wetop-service-key: <ASSISTANT_READ_KEY>` — тот же, что у ключа сторожа (ADR-067). Ключ пускает ровно на
три адреса; всё остальное, включая запись, — `403`.

### `GET /assistant/errors`

Ошибки, которые API отдал этому человеку (`DATA_MODEL.md` §14): 4xx и 5xx, только вошедшим, за 30 суток.

| Параметр | |
|---|---|
| `userId` | обязателен, UUID — `user_id` из подписи |
| `organizationId` | обязателен, UUID — `org_id` из подписи |
| `since` | необязателен, ISO 8601; по умолчанию — сутки назад |
| `limit` | 1…50, по умолчанию 20 |

Ответ — новые сверху, в обёртке `items` (не `errors`: непустое поле `errors` бот считает отказом):

```json
{ "items": [{ "at": "2026-09-24T09:12:03.120Z", "section": "Брони", "status": 400, "message": "adults — целое ≥ 1" }] }
```

Бот (`src/integrations/wetop.py`, `recent_for_user`) шлёт `since` как Python `isoformat()` — с микросекундами и
смещением (`2026-09-24T09:00:00.123456+00:00`); платформа такое принимает.

`section` — раздел стойки по маршруту («Брони», «Шахматка», «Тарифы»…; неизвестный маршрут — «Прочее»).
`message` — ровно текст, который получил человек, с маской на почте, телефонах и секретах. Тела запроса, значений из
адреса и данных гостей в ответе нет. Пустой `items` — ошибок не было, а не «не знаю».

Этот адрес открыт **только ключу** — помощника или служебному: и при выключенном замке API, и для вошедшего человека.

**Для справочника ошибок (Б4)** — частые тексты за неделю, первые кандидаты в `data/errors.md`. Запрос только читает
журнал; выполняет владелец на рабочей базе:

```sql
SELECT message, status, count(*) AS n
  FROM user_errors
 WHERE at > now() - interval '7 days'
 GROUP BY message, status
 ORDER BY n DESC
 LIMIT 50;
```

### `GET /assistant/organization` (С5, Q-187)

Клиент и подписка для техподдержки: `?id=<UUID организации>` → название, статус, дата регистрации
и расширение «ИИ-продавец» (`aiSeller.access` / `activeUntil` / `daysLeft`). Почт, денег и данных
гостей в ответе нет. 400 — id не UUID, 404 — организации нет («не наш клиент»). Инструмент бота
`my_subscription` для вошедших берёт организацию из подписи (ничего называть не нужно), обращению
без подписи нужен ID — точным совпадением (рекомендация Q-187).

### `GET /assistant/requester` (S4)

Контекст обратившегося для помощника поддержки: роль, организация, бизнесы и филиалы, состояние аккаунта
(`ACTIVE`/`TRIAL`/`READ_ONLY`/`SUSPENDED`, можно ли менять данные, причина, срок пробного периода), права роли.
Параметры `userId` и `organizationId` — из подписи посетителя, которую бот проверил сам; API сверяет пару с членством
(чужая организация — 404). Ответа без почты, телефона, имени и внутренних id. Третий адрес узкого ключа помощника.

### `GET /assistant/integrations` и `GET /assistant/reservation` (S5)

Диагностика для помощника поддержки (`plans/ai-agents-s5-diagnostics-2026-09-29.md`). Параметры `userId` и
`organizationId` — из подписи посетителя, сверка с членством как у `/assistant/requester` (чужая пара — 404). Четвёртый
и пятый адреса узкого ключа; живых вызовов Channex нет — только база и снимок сторожа webhook.

- `integrations` → `{ "channex": null }` у организации без подключённых каналов; иначе `channex`: `state`
  (`READY` / `NO_KEY` / `NO_MAPPING` / `ATTENTION`), `categories { mapped, total }`, `ratePlansMapped`,
  `lastEventAgeMinutes`, `outbox { pending, failed, oldestPendingMinutes }`, `webhook { suspect, reachable }`,
  `problems[]` кодами (`CATEGORIES_UNMAPPED`, `WEBHOOK_SUSPECT`, `OUTBOX_STUCK`, `NO_EVENTS_24H`…). Ключей и адресов нет.
- `reservation?number=` → бронь по номеру среди объектов организации: `status`, даты, `nights`, `source`, `channel`,
  `guests { adults, children }`, `items[] { category, status, unitAssigned, unitCode, housekeeping }`, `problems[]`
  (`UNASSIGNED_ITEMS`, `ARRIVAL_PASSED_NOT_CHECKED_IN`, `UNIT_NOT_INSPECTED_BEFORE_ARRIVAL`…). Имени, телефона,
  заметок и сумм нет по построению; чужая или несуществующая бронь — 404 без различения; `number` — до 40 знаков
  из букв, цифр, дефиса и подчёркивания, иначе 400.

Инструменты бота: `get_integration_health`, `get_reservation_status(number)`, `get_workspace_health` (сводка:
аккаунт из S4, `platform_status`, каналы, число своих ошибок за окно `SUPPORT_INCIDENT_WINDOW_HOURS`).

### Действия помощника (S6): `POST /assistant/actions/channel-pull`, `POST /assistant/actions/channel-sync`

Ключ **действий** `ASSISTANT_ACT_KEY` — отдельный от ключа чтения (Q-S6-1): пускает **только POST** и только на эти
два адреса; ключ чтения на них — 403, ключ действий на чтение — 403. У бота он зовётся `INTEGRATION_ACT_KEY`; пустой —
бот только читает, матрица возможностей остаётся (`list_capabilities`), SAFE/CONFIRM отвечают «не знаю».

Тело: `{ userId, organizationId, idempotencyKey, days? }` — пара из подписи, ключ идемпотентности — id строки журнала
бота. Порядок проверок на платформе: членство (404) → право `channels` у роли (403) → аккаунт пишущий (409 «только
чтение») → организация с подключённой интеграцией (409) → лимит: то же действие той же организации не чаще раза в
10 минут (429) → повтор с тем же `idempotencyKey` в течение часа возвращает прежний результат с `replayed: true`,
ничего не выполняя. Ответ — `{ ok, action, replayed, received/processed/failed | queued/days }`, без адресов и ключей.

Классы (матрица — `apps/ai-seller/src/ai/support_actions_matrix.py`, план `plans/ai-agents-s6-actions-2026-09-29.md` §2):
`channel_pull` — SAFE, выполняется сразу; `channel_sync` — CONFIRM, бот сначала предлагает, выполняет только после
`confirm_action` тем же диалогом не позже 15 минут, причём согласие проверяет сервер бота, а не модель (Q-S6-2): тот же
человек, тот же диалог, в сообщении человека этого хода — явное «да» из закрытого списка фраз; иначе предложение ждёт; `refund`, `subscription`, `organization_disable`, `owner_rights`,
`data_delete`, `reservations_bulk`, `other_human` — HUMAN_ONLY: `request_human` ставит диалогу «нужен человек» и пишет в
журнал, платформа не зовётся. Журнал — таблица бота `support_actions` (миграция `0007`), панель бота
`GET /conversations/{id}/actions`, кабинет — `GET /platform/support/conversations/:id/actions` («Действия агента»).

### База знаний WETOP Support (S3, только помощник, только служебный ключ)

Панель бота: `GET/POST /support-knowledge`, `GET/PUT /support-knowledge/{id}`, `POST /support-knowledge/{id}/publish`
(`approved_by` обязателен), `POST /support-knowledge/{id}/status` (`DRAFT`/`OUTDATED`/`ARCHIVED`; `ACTIVE` ставит только
публикация), `GET /conversations/{id}/knowledge` (на каких знаниях строились ответы), `POST
/conversations/{id}/knowledge-draft` (пустой черновик из закрытого обращения). Платформа: `platform/support/kb…` — только
главный администратор; `by` и `approved_by` ставит сервер из сессии. Таблицы бота — миграция `0006`. Правила состояния
и видимости — `plans/ai-agents-s3-knowledge-2026-09-29.md`.

### `GET /guard/status`

Состояние системы — то же, что видит экран «Неисправности»: `{ …, dbDownSince, open: { total, critical, escalated, byClass } }`.
Бот берёт отсюда только `dbDownSince` и `open.critical` (`parse_health`, `src/integrations/wetop_parse.py`).

## 3. Где стоят экземпляры

Наружу у обоих экземпляров открыты только `/widget/*` и `/health`. Панель, `/internal/*` и служебные маршруты — только
внутренняя сеть. Удобнее всего — одна сеть compose с платформой: тогда помощник ходит в API по `http://api:3001`,
а платформа в продавца — по `SELLER_URL`, и туннель платформы остаётся с шестью путями. Адреса и сервер — Q-180, Q-174.

У платформы и бота разные проекты compose (`deploy/compose.yml` — `pms-lux`; у бота свой `compose.yml`). Внутреннее имя
службы видно только внутри общей сети. **Сеть `wetop-internal` заводит сама платформа** (25.09.2026, после решения
Q-174, ADR-081):
- имя постоянное, `internal: true` — выхода наружу у сети нет;
- в ней `api` и туннель (`cloudflared`). Туннель выводит наружу `assistant.wetop.ai`, и только чат (`/widget/*`) и
  живость (`/health`) — правило в `deploy/cloudflared.example.yml`. Стойке бот не нужен;
- сторож — `tests/unit/deploy-server.test.ts`.

Руками сеть не заводят. `docker network create` создаёт сеть без меток compose, и `up` платформы с такой сетью
откажется. Если её уже завели, удалить (`docker network rm wetop-internal`), пока к ней никто не подключён.

Оба экземпляра бота подключаются к ней как к внешней и берут в ней свои имена — файлом рядом с `compose.yml` бота:

```yaml
# compose.override.yml экземпляра бота; у продавца aliases: [seller]
services:
  app:
    networks:
      default: {}
      wetop-internal: { aliases: [assistant] }
networks:
  wetop-internal: { external: true }
```

Тогда помощник ходит в API по `INTEGRATION_BASE_URL=http://api:3001`, а платформа в продавца — по
`SELLER_URL=http://seller:8000/<DASHBOARD_PATH_PREFIX>`. Экземпляр бота поднимается после платформы: сети до первой
выкладки платформы нет.

## 4. Продавец: что зовёт платформа (П7, П8) — для Б5–Б7

Все вызовы — от API платформы, не из браузера: `{SELLER_URL}{путь}` с заголовком `X-Service-Key: <SELLER_SERVICE_KEY>`.
`SELLER_URL` — внутренний адрес API панели продавца (с путём панели, если он задан). Список ниже — всё, что нужно
платформе; остальное ей не нужно.

**Организация вызова (Э4, ADR-083).** Один продавец обслуживает все гостиницы. Каждый вызов таблицы (кроме
`PUT /seller/organizations/{id}`) платформа шлёт с заголовком `X-Organization: <uuid организации>` — панель продавца
отдаёт и меняет строки ровно этой гостиницы; без заголовка продавец отвечает 400. В песочнице организация идёт полем
`organization_id` в теле. Гостиниц у продавца заводит сама платформа: при смене расширения и каждой сверкой (раз в
минуту) уходит `PUT /seller/organizations/{id}` — имя, `active` (действует ли расширение: `false` гасит виджет, Q-183),
домены сайтов организации и её публичный ключ виджета. Ключ платформа выводит и нигде не хранит:
`sk_` + первые 24 hex `HMAC-SHA256(SELLER_SERVICE_KEY, "seller-widget|<uuid организации>")`; он стоит в теге на сайте
гостиницы (`data-key`), из него служебный ключ не восстановить. Хранит строку и сравнивает только продавец.

| Метод и путь | Зачем | Тело и ответ |
|---|---|---|
| `GET /conversations?mode=&limit=&queue=&nonempty=&closed=` | «Диалоги», список | как у панели сегодня: `{ items: [{ id, channel, client_name, mode, stage, last_activity_at, messages, has_contact }] }`; с 29.09 (ADR-122) в строке ещё `started_at`, `last_message: { role, text ≤ 160, at }`, `waiting_since` (первое сообщение пользователя после последнего ответа, иначе `null`), `closed`; необязательные отборы в SQL: `nonempty=true` — без пустых, `closed=true/false`, `queue=new` (начат за сутки) или `queue=waiting` (последнее слово за пользователем) |
| `GET /conversations/{id}` | карточка | `{ id, mode, stage, lead_data, contact, messages: [{ role, text, at, sent_by_us }] }` |
| `POST /conversations/{id}/takeover` | «Перехватить» | `{ status, mode, previous_mode }` |
| `POST /conversations/{id}/release` | «Вернуть боту» | то же |
| `POST /conversations/{id}/reply` | «Ответить» | тело `{ text }`, до 4000 знаков; `{ status }` |
| `POST /conversations/{id}/close` | «Закрыть обращение» (ADR-122) | `{ status, closed }`; диалог `is_active = false`, запись `close` в журнал бота; следующее сообщение того же человека откроет новый диалог. Карточка отдаёт `closed` |
| `GET /knowledge` | «Знания», список | `{ items: [{ source, chunks, created_at }] }` |
| `POST /knowledge` | загрузка документа | `multipart/form-data`, поле `file` (md, txt, pdf, docx, xlsx; платформа пропускает до 10 МБ — как `kb_max_file_mb` продавца, имя в UTF-8); `{ status, source, created, chunks }` |
| `GET /summary` | сводка за сутки | `{ hours, dialogs, replies, leads, sla_breaches }` |
| `POST /internal/sandbox` — **в корне экземпляра**, не под путём панели | «Проверка» | тело `{ external_id, text, organization_id }`, текст до 2000 знаков, `external_id` = `wetop-check-<user_id>` — у каждого сотрудника свой разговор; ответ `{ status, reply, needs_human, edits, reasons, conversation_id }` |
| `PUT /seller/profile` | профиль (Б6) | ниже |
| `POST /extract-profile` | рассказ владельца → поля анкеты (С1 «под ключ»): раскладывает модель бота, каждое поле — через слой 9; свободный текст промптом не становится | тело `{ story }` (10…4000 знаков); ответ `{ status, profile, facts, unparsed, rejected }` — поля схем Б6/Б7 в snake_case, цены категорий в `price_minor`; 422 — инъекция в рассказе, 503 — модель не ответила |
| `PUT /seller/facts` | факты объекта (Б7) | ниже |
| `PUT /seller/organizations/{id}` | гостиница у продавца (Э4) | тело `{ name, public_key, active, hosts }`; `{ status }`; идемпотентно — та же строка перезаписывается |
| `GET /seller/organizations/{id}/llm-key` | ключ модели партнёра (С2, Q-186): статус | `{ set, last4 }` — сам ключ бот не отдаёт никогда |
| `PUT /seller/organizations/{id}/llm-key` | поставить или снять ключ | тело `{ key }`; пустой — снять; ключ ложится в базу бота шифрованным (`LLM_KEYS_SECRET`), без секрета — 409; `{ status, set, last4 }` |
| `POST /seller/organizations/{id}/llm-key/check` | проверка ключа до сохранения | тело `{ key }`; бот живым вызовом спрашивает роутер (`GET {LLM_BASE_URL}/models`); `{ valid, reason }` — ключа в ответе нет |
| `GET /seller/organizations/{id}/whatsapp` | WhatsApp (С3, Q-185 (а)): статус | `{ set, phone_number_id, verify_token }` — токена и секрета в ответах нет никогда |
| `PUT /seller/organizations/{id}/whatsapp` | подключить или снять | тело `{ phone_number_id, token, app_secret }` (пустой номер — снять); токен и секрет ложатся шифрованными (`LLM_KEYS_SECRET`); слово вебхука выдаёт бот |
| `POST /seller/organizations/{id}/whatsapp/check` | проверка до сохранения | тело `{ phone_number_id, token }`; бот спрашивает Graph (`GET {WHATSAPP_GRAPH_BASE_URL}/{id}?fields=display_phone_number`); `{ valid, phone, reason }` |

**Песочница.** У бота она осталась в корне экземпляра — `POST /internal/sandbox`, путь зафиксирован его сборочным
планом — и принимает служебный ключ платформы тем же заголовком `X-Service-Key` (`src/dashboard_router.py`). Платформа
зовёт её по корню адреса из `SELLER_URL` (`http://seller:8000/<путь панели>` → `http://seller:8000/internal/sandbox`).
Остальные маршруты таблицы — под путём панели; служебный ключ бот пускает ровно на них (`SERVICE_ROUTES`,
`src/dashboard/auth_router.py`), всё остальное — 403.

**Отказы.** Причину бот кладёт в `detail`: строкой, списком проверок `{ msg }` или объектом
`{ message, fields }` (профиль, слой 9: какие поля содержат инструкции для модели) — платформа показывает причину и
названия полей экрана. 401 у панели бота — «сессия истекла», для служебного ключа это неверный ключ. 403 бывает разным:
«Доступ с этого адреса закрыт» (адрес платформы не в списке панели), «Служебному ключу этот маршрут закрыт» — платформа
показывает слова бота. 2xx — принято. 4xx по содержанию (400, 422 и прочие, кроме перечисленных ниже) — продавец отклонил:
платформа показывает владельцу `detail` из ответа (например, «в поле найдены инструкции для модели») и эту версию сама
не повторяет — профиль уйдёт после правки, факты — когда поменяются данные, и то и другое — по «Применить». 401 и 403
(ключ), 404 (адреса ещё нет), 408, 429, 5xx, тайм-аут, нет связи — не про содержание: платформа говорит об этом в
разделе и повторяет доставку профиля и фактов раз в минуту. Тайм-ауты: 15 с, песочница — 90 с.

### Помощник: что зовёт «Платформа → Техподдержка» (Э3, ADR-083, ADR-084)

Та же панель, тот же клиент (`packages/integrations/src/assistant/bot-panel-client.ts`): `{ASSISTANT_PANEL_URL}{путь}`
с заголовком `X-Service-Key: <ASSISTANT_SERVICE_KEY>`; у помощника тот же ключ стоит в его `SELLER_SERVICE_KEY` (у бота
одно имя переменной для обеих ролей). Зовёт только API платформы и только для главного администратора.

| Маршруты | Что | Кому открыт ключ |
|---|---|---|
| диалоги, карточка, перехват, ответ, возврат, знания, сводка — как в таблице выше | «Диалоги», «Знания», сводка | обеим ролям (`SERVICE_ROUTES`) |
| `GET /prompt` → `{ text }`, `PUT /prompt` тело `{ text }` → `{ status, length }` | «Настройки»: правила помощника — текст его системного промпта; пустой текст бот считает ошибкой настройки — платформа такой не шлёт | **только `BOT_ROLE=support`** (`SUPPORT_SERVICE_ROUTES`) |
| `GET /settings` → `{ models, model, values }`, `PUT /settings/model` тело `{ model }` → `{ status, model, previous }` | «Настройки»: модель из списка `LLM_ALLOWED_MODELS`; пустой список — выбора нет (404). Платформа берёт из ответа только `models` и `model` | **только `BOT_ROLE=support`** |
| `POST /internal/sandbox` в корне экземпляра, `external_id` = `wetop-support-check-<user_id>` | «Проверка» | обеим ролям |

Роль сверяется буквально: `support` открывает правила и модель. С 26.09.2026 (ADR-095, аудит С-60) опечатка в
`BOT_ROLE` не сводится к `support`, а не даёт боту стартовать вовсе: у продавца она открывала бы диалоги всех гостиниц без
отбора. Пустая роль — по-прежнему `support`. У продавца `PUT /prompt` и `/settings` служебному ключу закрыты по-прежнему:
ядро его правил платформа не переписывает (Б6).

Организацию у продавца (`X-Organization`) называет только служебный ключ платформы: человек, вошедший в собственную
панель продавца, получает 403 на маршрутах гостиниц (ADR-083 — продавцом управляют из платформы). Новые переменные бота
(26.09): `LLM_DAILY_TOKEN_BUDGET` — токенов в сутки на гостиницу, `WIDGET_ATTACHMENT_DIR_MAX_MB` и
`WIDGET_ATTACHMENT_KEEP_DAYS` — предел и срок папки вложений; умолчания — в `apps/ai-seller/env.example`.

**Кто пишет.** Вошедшего бот узнаёт по подписи стойки (§2) и хранит её в диалоге: `lead_data.platform_user` =
`{ user_id, email, org_id, role }` (`src/channels/widget_store.py`), имя клиента в списке — почта, маскированная
(`d***`). Карточка «Техподдержки» показывает почту, организацию названием из базы платформы (по `org_id`) и роль
словом. Посетитель wetop.ai пишет без подписи — `platform_user` нет.

### `PUT /seller/profile` — схема бота (Б6, `src/ai/seller_prompt.py`)

Поля экрана «Настройки», не текст промпта. Ядро правил бот держит сам, в профиле его нет и стереть его нельзя. Модель —
с `extra='forbid'`: лишнее поле или значение вне списка — 422.

```json
{
  "object_name": "Luxx Aparts",
  "bot_name": "Айгерим",
  "address_form": "vy",
  "emoji": "never",
  "reply_length": "short",
  "languages": ["русский", "казахский", "английский"],
  "greeting": "Здравствуйте! Чем помочь?",
  "included_in_price": "Постельное бельё, полотенце, Wi-Fi.",
  "extra_charges": "Трансфер из аэропорта.",
  "house_rules": "Тишина с 23:00.",
  "prohibitions": ["Не курить в номерах."],
  "call_human_when": ["Группа от 6 человек.", "Оплата по счёту."],
  "faq": [{ "q": "Есть ли парковка?", "a": "Парковки нет, рядом городская." }]
}
```

| Поле | У бота |
|---|---|
| `object_name` | обязательно, 1…120 — платформа берёт из карточки объекта |
| `bot_name` | ≤ 40 или `null` |
| `address_form` | `vy` \| `ty` |
| `emoji` | `never` \| `moderate` \| `greeting_only` |
| `reply_length` | `short` \| `detailed` |
| `languages` | до 6 строк ≤ 20 знаков — названия языков, бот вставляет их в промпт как есть |
| `greeting` | ≤ 300 |
| `included_in_price`, `extra_charges` | ≤ 1000 |
| `house_rules` | ≤ 2000 |
| `prohibitions`, `call_human_when` | списки до 30 строк ≤ 300 |
| `faq` | до 50 пар `{ q ≤ 300, a ≤ 1000 }` |

Ответ — `{ status: "ok", length }`. Инструкция для модели в поле — 422 с `detail: { message, fields }`. Экземпляр не
продавец (`BOT_ROLE` не `seller`) — 409.

### `PUT /seller/facts` — схема бота (Б7, `src/knowledge/facts.py`)

Данные объекта из карточки, категорий и тарифа сайта. Бот собирает из них документ «адрес, заезд и цены» и **заменяет**
прежний с источником `platform:facts.md` (источник ставит сам бот), а не кладёт рядом. Модель — с `extra='forbid'`.

```json
{
  "object_name": "Luxx Aparts",
  "address": "Алматы, …",
  "timezone": "Asia/Almaty",
  "check_in": "14:00",
  "check_out": "12:00",
  "currency": "KZT",
  "categories": [{ "name": "Двухместная", "kind": "room", "capacity": 2, "price_minor": 1500000 }]
}
```

`address` — строка (пусто — `""`, не `null`); `kind` — `room` или `bed`; `capacity` 1…50; `price_minor` — целые тиыны
(ADR-008) или `null` — тогда бот говорит «уточнит администратор». Категорий до 50. Ответ — `{ status: "replaced" }` или
`{ status: "unchanged" }`. **Цена одна на категорию** — какая именно, решено ADR-081 (ниже).
**Наличия мест в фактах нет:** занятость меняется каждую минуту, её отдаст котировка в части 3.

### Как платформа это отправляет

Тела собирает домен платформы — `sellerProfilePayload` и `buildSellerFacts` (`packages/domain/src/ai-seller/`) — ровно
по моделям бота; проверено самими моделями `SellerProfile` и `ObjectFacts` с ветки `ai-seller`: профиль по умолчанию,
профиль на всех пределах бота, факты с разными и одинаковыми ценами и без тарифа сайта — ни одной ошибки
(`reports/ai-assistant-seller-2026-09-24.md` §9).

- **Название объекта** (`object_name`) — из карточки объекта при каждой отправке, до 120 знаков. Переименовали объект —
  профиль уходит заново вместе с фактами: бот представляется именем из карточки.
- **Языки** хранятся кодами ISO 639-1, уходят названиями строчными («русский», «казахский»).
- **Цена за ночь** (ADR-081, Q-179) — одна на категорию, только если в окне 60 дней она не меняется; иначе `null`, и бот
  говорит «уточнит администратор». Цена — при наибольшем числе гостей, на которое она есть в тарифе сайта (у
  «Двухместной» — за двоих), валюта — тарифа сайта. Цены по датам — следующий шаг: правка Б7 на стороне бота.
- **Когда уходит.** Профиль — при «Применить», когда он новее доставленного и после переименования объекта; факты — при
  «Применить» и когда их отпечаток (SHA-256 тела) отличается от доставленного. Проверка — раз в минуту; версию,
  отклонённую по содержанию, сверка сама не повторяет.

### Обратно: что продавец зовёт у платформы — котировка (Q-166 в объёме чтения, ADR-085)

Единственный вызов бота к платформе у продавца. Заголовок `x-wetop-service-key: <SELLER_QUOTE_KEY>` — свой узкий
ключ по образцу ключа помощника (§2): ровно один адрес, только GET, всё остальное — 403. Ходит по внутренней сети
`wetop-internal` (`INTEGRATION_BASE_URL=http://api:3001`), наружу адрес не выходит (SECURITY.md §11).

`GET /bot/availability?organization=<uuid>&arrival=YYYY-MM-DD&departure=YYYY-MM-DD&adults=N`

Организацию бот берёт из хода (Э4). Платформа находит сайт организации сама — первый ACTIVE с включённым
бронированием и тарифом сайта, тот же выбор, что у фактов продавца, — и отвечает ровно тем JSON `Quote`, что публичный
`GET /w/availability` (categories: `available`, `closed`, `fits`, `totalMinor` строкой минорных, `currency`). Отказы:
401/403 — ключ, 400 — организация не UUID или даты не по правилам виджета, 404 — у организации нет сайта с
бронированием, 429 — больше 120 котировок в час на организацию. Бот на любой отказ честно говорит «уточнит
администратор»; число мест наружу не называет — только признак «есть/мало/нет» (категории `closed` или не `fits`
местом не считаются), сумму только берёт из `totalMinor`, сам не считает. Брони этой дверью нет (Q-166б, ADR-086).

## 5. Переменные окружения

| Сторона | Имя | Значение |
|---|---|---|
| API платформы | `WIDGET_IDENTITY_SECRET` | общий с помощником |
| API платформы | `ASSISTANT_READ_KEY` | общий с помощником |
| API платформы | `ASSISTANT_ACT_KEY` | S6: ключ действий помощника, только `POST /assistant/actions/*`; у бота — `INTEGRATION_ACT_KEY`; не задан — бот только читает |
| API платформы | `SELLER_URL`, `SELLER_SERVICE_KEY` | адрес панели продавца с её путём (`DASHBOARD_PATH_PREFIX` бота) и ключ Б5; песочница — по корню того же адреса |
| API платформы | ~~`SELLER_ORGANIZATION_ID`~~ | **снята (Э4, ADR-083):** продавец общий, организация — в каждом вызове; оставшаяся в `.env` строка игнорируется, можно удалить |
| API платформы | `SELLER_PUBLIC_URL` | публичный адрес продавца — из него код чата для сайта объекта |
| API платформы | `ASSISTANT_PANEL_URL`, `ASSISTANT_SERVICE_KEY` | внутренний адрес панели помощника с её путём (`http://assistant:8000<DASHBOARD_PATH_PREFIX>`) и ключ «Техподдержки»; у помощника тот же ключ — в `SELLER_SERVICE_KEY` |
| API платформы | `SELLER_QUOTE_KEY` | общий с продавцом: у него — `INTEGRATION_API_KEY`; открывает только `GET /bot/availability` |
| API платформы | `USER_ERRORS_RETENTION`, `SELLER_SYNC` | `off` — выключить уборку журнала ошибок и сверку фактов |
| стойка | `ASSISTANT_URL` | публичный адрес помощника |
| главная | `assistantUrl` в `apps/site/src/site.config.ts` | то же для wetop.ai |
| помощник | `WIDGET_IDENTITY_SECRET`, `WIDGET_IDENTITY_TTL_SECONDS=43200`, `WIDGET_SITE_HOSTS=app.wetop.ai,wetop.ai,www.wetop.ai` | Б2, Б3 |
| помощник | `BOT_ROLE=support`, `SELLER_SERVICE_KEY` = `ASSISTANT_SERVICE_KEY` платформы, `LLM_ALLOWED_MODELS` (по желанию) | «Техподдержка»; без ключа панель закрыта целиком |
| продавец | `BOT_ROLE=seller`, `SELLER_SERVICE_KEY` | Б5, Б8. Домены у продавца — от платформы по каждой гостинице (Э4): `WIDGET_SITE_HOSTS` его дверей больше не касается и остаётся помощнику |
| продавец | `INTEGRATION_MODE=wetop`, `INTEGRATION_BASE_URL=http://api:3001`, `INTEGRATION_API_KEY` = `SELLER_QUOTE_KEY` платформы | котировка (ADR-085): без них инструменты наличия и цены отвечают «не знаю» |
| продавец | `LLM_KEYS_SECRET` | хранилище ключей моделей партнёров (С2, Q-186): Fernet, `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`; пуст — ключи партнёров не принимаются, ходы идут ключом платформы |
| продавец | `WHATSAPP_GRAPH_BASE_URL` | по умолчанию `https://graph.facebook.com/v20.0`; менять не нужно |
| продавец | `LLM_DAILY_TOKENS_PER_ORG` | дневной предел токенов гостиницы на ключе платформы; по умолчанию `150000` (решение 26.09), `0` — без предела. Выше предела гостю — «администратор свяжется», диалог помечен «нужен человек», владельцу — алерт раз в сутки; сутки по UTC+5. Гостиница со своим ключом — без предела |
| продавец | `LLM_EMERGENCY_BASE_URL`, `LLM_EMERGENCY_API_KEY` | по желанию: второй путь аварийной модели — к поставщику напрямую, мимо роутера; нужны оба; имя в `LLM_MODEL_EMERGENCY` — как у этого поставщика. Только ключ платформы |
| продавец | `LLM_PRICES` | по желанию: цены моделей для отчёта о расходе — за 1 млн токенов `модель=вход/кэш/выход` через запятую, в валюте счёта роутера |
| продавец, помощник | `LLM_PROMPT_CACHE_MARK` | `false` по умолчанию; `true` — метка кэша на постоянной части промпта для моделей Claude. Включать, только если роутер её понимает (иначе ступень Claude отказывает) |

## 6. Включение по шагам (владелец; 25.09.2026)

Код платформы — в `main` с PR #67 (`afe82ab9`). Пока шаги не сделаны, всё новое молчит: тега чата нет, подпись не
выдаётся, раздел «ИИ-продавец» пишет «продавец не подключён». Агент этих шагов не делает: боевые миграции, `.env` и
сервер — владелец (AGENTS.md §15, SECURITY.md §3).

| # | Шаг | Как | Проверка |
|---|---|---|---|
| 1 | Бэкап рабочей базы, затем две миграции: `20260924000018_user_errors` и `20260924000019_seller_profiles`. Откат — `down.sql` рядом | `docs/ops/backups.md`: бэкап → `migration.sql` каждой по порядку → проверка | `select count(*) from user_errors;` и `select count(*) from seller_profiles;` — оба `0`, без ошибки |
| 2 | Три общих ключа: `openssl rand -hex 32`, трижды | `WIDGET_IDENTITY_SECRET`, `ASSISTANT_READ_KEY`, `SELLER_SERVICE_KEY` — одинаковые у платформы и бота (§5; у помощника `ASSISTANT_READ_KEY` зовётся `INTEGRATION_API_KEY`) | — |
| 3 | Переменные платформы в `.env` корня клона: `ASSISTANT_URL=https://assistant.wetop.ai`, `SELLER_URL=http://seller:8000/<DASHBOARD_PATH_PREFIX>`, `SELLER_PUBLIC_URL=https://seller.wetop.ai` и ключи шага 2 (`SELLER_ORGANIZATION_ID` с Э4 не нужна) | имена — и в `.env.example` | — |
| 4 | Выкладка платформы | `release` → проверенный коммит `main`, затем `/usr/local/sbin/wetop-auto-deploy --migrations-applied <вершина из отказа>` (`docs/deploy.md` §1д) | `/health` — ok; в «Продажах» есть «ИИ-продавец»; `docker network inspect wetop-internal` — в сети `api` |
| 4а | С 25.09 (ADR-083): отметка главного администратора и расширение своей гостиницы — после миграции `20260925000020_access_extensions`. Без расширения пункта «ИИ-продавец» нет, а раздел отвечает 403 | `accounts -- platform-admin --email=<ваша почта>` и `accounts -- extension --email=<ваша почта> --status=active` в контейнере `api` (`plans/platform-roles-extensions-2026-09-25.md` §11) | `accounts -- list` — у вас «владелец» и «главный администратор»; в стойке — «ИИ-продавец» в «Продажах» и «Платформа» внизу меню |
| 5 | Экземпляры бота: помощник (`BOT_ROLE=support`) и продавец (`BOT_ROLE=seller`) — каждый своей папкой и проектом compose, с файлом сети из §3; `assistant.wetop.ai` — правилом туннеля и записью DNS | команды ниже; перед деплоем — `apps/ai-seller/vykatka.md` | `https://assistant.wetop.ai/health` — 200; `https://assistant.wetop.ai/widget/widget.js` — 200 |
| 6 | Главная wetop.ai | `CLOUDFLARE_ACCOUNT_ID=… npm run site:deploy` (`docs/deploy.md` §2) | `curl -s https://wetop.ai/ \| grep -c assistant.wetop.ai/widget/widget.js` — `1` |
| 7 | «ИИ-продавец» → «Настройки» → «Применить» | стойка | баннер «Применено: продавец получил настройки и данные объекта» |
| 8 | Правила помощника (ADR-084): «Платформа → Техподдержка → Настройки» — вписать системный промпт по шаблону `apps/ai-seller/sistemnyy-prompt-pomoshchnik.md` (подстановки `{{…}}` заменить) и сохранить. Пока правил нет, помощник не отвечает: файла `data/system_prompt.md` в его томе ещё нет | стойка | вкладка «Проверка» — помощник отвечает; предупреждения «Правил нет» нет |
| 9 | Э4 «один продавец на все гостиницы» (после слияния Э4, план `plans/seller-multitenancy-2026-09-25.md` §3): `release` на свежий `main`; обновить код копии продавца («Обновить код продавца» ниже) — его alembic применит `0002_organizations` сам при старте; сверка платформы заведёт гостиницу у продавца в течение минуты. Тег чата на сайте гостиницы заменить на новый из «Код для сайта» — теперь в нём `data-key`. Старые диалоги виджета (по желанию): `UPDATE clients SET organization_id='<uuid организации>' WHERE channel='widget' AND organization_id IS NULL;` в базе продавца — uuid показывает «Платформа → Организации» | веб-терминал | в «Код для сайта» тег с `data-key`; чат на сайте отвечает; «Диалоги» раздела показывают новые разговоры |
| 10 | Котировка продавца (после слияния ADR-085): `openssl rand -hex 32` → `SELLER_QUOTE_KEY` в `.env` платформы; тот же ключ у продавца в `.env` — `INTEGRATION_API_KEY`, там же `INTEGRATION_MODE=wetop`, `INTEGRATION_BASE_URL=http://api:3001`; перезапуск `api` и продавца | веб-терминал; имена — в `.env.example` вписать владельцу | в чате продавца «есть места на завтра на двоих?» — признак и цена тарифа сайта, а не «уточнит администратор» |
| 11 | Ключ модели партнёра (С2): сгенерировать `LLM_KEYS_SECRET` (команда в §5) → в `.env` продавца; обновить код копии продавца («Обновить код продавца» ниже) — alembic применит `0003_org_llm_keys` при старте; затем в стойке «ИИ-продавец → Модель» — ключ, «Проверить», «Сохранить» | веб-терминал, затем стойка | в окне «Модель» — «оканчивается на ····…»; ход в «Проверке» отвечает как раньше |
| 12 | WhatsApp гостиницы (С3; после ответа Q-185 и при базе бота в РК для чужих сайтов — ADR-009): партнёр заводит номер, Meta Business c проверкой и постоянный токен; в стойке «ИИ-продавец → WhatsApp» — номер, токен, секрет → «Проверить» → «Подключить»; адрес вебхука и слово с экрана — в консоль Meta (Webhook → Callback URL / Verify token, подписка на messages). Наружу нужен путь `/channels/whatsapp/webhook/*` к продавцу (`SELLER_PUBLIC_URL`) | стойка + консоль Meta; ingress продавца | сообщение на номер → ответ бота в WhatsApp; диалог в «Диалогах» раздела |
| 13 | Расход модели под контролем (после слияния `claude/seller-cost-controls`; план `plans/seller-cost-controls-2026-09-26.md`): обновить код копии продавца («Обновить код продавца» ниже) — alembic применит `0005_message_usage` при старте, дневной предел 150 000 токенов на гостиницу включится сам. По желанию — второй путь аварийной модели и цены (§5) в `.env` продавца, затем `docker compose up -d --force-recreate app monitor` в `/opt/wetop-bot/seller`. Помощник получит `0005` при следующем обновлении своего кода — на его работу это не влияет | веб-терминал | `cd /opt/wetop-bot/seller && docker compose exec app python -m src.jobs.usage_report` — таблица по гостиницам за текущий месяц; в журнале продавца нет строки «второй путь аварийной модели не включён» |

Код чата продавца на сайт объекта ставится, только когда база бота в Казахстане: в переписке гостей персональные
данные (ADR-009, ADR-081).

### Команды для веб-терминала сервера (шаги 4–5)

Порядок важен: сеть `wetop-internal` появляется, когда выложена вершина `main` с PR #69 и дальше. Бот подключается к ней
как к внешней, поэтому поднимается после платформы.

```bash
# 4. Платформа: после перемотки release автовыкладка поднимет api в новой сети. Туннель она не трогает — один раз руками:
cd /root/wetop/deploy && docker compose -f compose.yml -f compose.hostinger.yml up -d cloudflared
docker network inspect wetop-internal --format '{{range .Containers}}{{.Name}} {{end}}'   # ждём api и cloudflared

# 5а. Помощник — своя папка, копия бота из клона
mkdir -p /opt/wetop-bot && cp -a /root/wetop/apps/ai-seller /opt/wetop-bot/assistant && cd /opt/wetop-bot/assistant
cp env.example .env && nano .env          # что вписать — ниже
mkdir -p data logs && chown 1000:1000 data logs
cat > compose.override.yml <<'YML'
services:
  app:
    networks:
      default: {}
      wetop-internal: { aliases: [assistant] }
networks:
  wetop-internal: { external: true }
YML
#    Пароля у панели бота нет (поручение владельца 25.09.2026): DASHBOARD_ADMIN_EMAIL и DASHBOARD_ADMIN_PASSWORD_HASH
#    оставить пустыми. Людей в панели нет, платформа ходит в неё служебным ключом (plans/platform-roles-extensions-2026-09-25.md §3)
docker compose up -d --build && docker compose ps && curl -s 127.0.0.1:8000/health

# 5б. Продавец — то же в /opt/wetop-bot/seller, но: aliases: [seller], BOT_ROLE=seller, и порт на хосте другой
#     (sed -i 's/127.0.0.1:8000:8000/127.0.0.1:8001:8000/' compose.yml), проверка — curl -s 127.0.0.1:8001/health

# 5в. Адрес помощника наружу: правило из deploy/cloudflared.example.yml (hostname: assistant.wetop.ai …) — в
#     /root/wetop/deploy/cloudflared/wetop.yml перед последней строкой `- service: http_status:404`, затем:
cloudflared tunnel route dns wetop assistant.wetop.ai     # или запись CNAME на туннель в панели Cloudflare
cd /root/wetop/deploy && docker compose -f compose.yml -f compose.hostinger.yml restart cloudflared
curl -s https://assistant.wetop.ai/health                 # 200

# 3 (после 5). Переменные платформы из шага 3 — в /root/wetop/.env, затем перечитать их:
cd /root/wetop/deploy && docker compose -f compose.yml -f compose.hostinger.yml up -d api web
```

**Помощник одним скриптом (25.09.2026).** Шаги 2, 3 и 5 для помощника разом, когда папка `/opt/wetop-bot/assistant` с
`.env` из `env.example` и `compose.override.yml` уже есть (шаг 5а), а в `.env` вписаны данные роутера моделей
(`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`). Скрипт ставит переменные помощника из таблицы ниже, пароль панели оставляет
пустым, делает два общих ключа и пишет их в оба файла, не печатая значений; пустые настройки своей базы заполняет,
заполненные не трогает. Затем поднимает бота, добавляет правило туннеля и перезапускает `api`, `web` и `cloudflared` —
стойка на минуту-две недоступна. Запись DNS `assistant` — CNAME на `<ID туннеля>.cfargotunnel.com` с оранжевым облаком —
делается в панели Cloudflare после скрипта: ID — в строке `tunnel:` вывода шага 3/4.

```bash
cat > /root/assistant-setup.sh <<'SH'
set -eu
B=/opt/wetop-bot/assistant/.env
P=/root/wetop/.env
F=/root/wetop/deploy/cloudflared/wetop.yml
for f in "$B" "$P" "$F" /opt/wetop-bot/assistant/compose.override.yml; do
  [ -f "$f" ] || { echo "СТОП: нет файла $f"; exit 1; }
done
put() { if grep -q "^$2=" "$1"; then sed -i "s#^$2=.*#$2=$3#" "$1"; else printf '%s=%s\n' "$2" "$3" >> "$1"; fi; }
empty() { ! grep -qE "^$2=[^[:space:]#]" "$1"; }
for k in LLM_API_KEY LLM_BASE_URL LLM_MODEL; do
  if empty "$B" "$k"; then echo "СТОП: в $B пусто $k — впишите данные роутера моделей (nano $B) и запустите снова"; exit 1; fi
done
put "$B" APP_ENV production
put "$B" PUBLIC_BASE_URL https://assistant.wetop.ai
put "$B" CORS_ORIGINS https://app.wetop.ai,https://wetop.ai,https://www.wetop.ai
put "$B" BOT_ROLE support
put "$B" INTEGRATION_MODE wetop
put "$B" INTEGRATION_BASE_URL http://api:3001
put "$B" WIDGET_SITE_HOSTS app.wetop.ai,wetop.ai,www.wetop.ai
put "$B" DASHBOARD_ADMIN_EMAIL ''
put "$B" DASHBOARD_ADMIN_PASSWORD_HASH ''
if empty "$B" DASHBOARD_PATH_PREFIX; then put "$B" DASHBOARD_PATH_PREFIX "/p$(openssl rand -hex 6)"; fi
if empty "$B" DASHBOARD_JWT_SECRET; then put "$B" DASHBOARD_JWT_SECRET "$(openssl rand -hex 32)"; fi
if empty "$B" POSTGRES_HOST; then put "$B" POSTGRES_HOST postgres; fi
if empty "$B" POSTGRES_PORT; then put "$B" POSTGRES_PORT 5432; fi
if empty "$B" POSTGRES_DB; then put "$B" POSTGRES_DB assistant; fi
if empty "$B" POSTGRES_USER; then put "$B" POSTGRES_USER assistant; fi
if empty "$B" POSTGRES_PASSWORD; then put "$B" POSTGRES_PASSWORD "$(openssl rand -hex 16)"; fi
if empty "$B" REDIS_URL; then put "$B" REDIS_URL redis://redis:6379/0; fi
W=$(openssl rand -hex 32); K=$(openssl rand -hex 32); S=$(openssl rand -hex 32)
put "$B" WIDGET_IDENTITY_SECRET "$W"; put "$B" INTEGRATION_API_KEY "$K"; put "$B" SELLER_SERVICE_KEY "$S"
put "$P" ASSISTANT_URL https://assistant.wetop.ai
put "$P" WIDGET_IDENTITY_SECRET "$W"; put "$P" ASSISTANT_READ_KEY "$K"; put "$P" ASSISTANT_SERVICE_KEY "$S"
put "$P" ASSISTANT_PANEL_URL "http://assistant:8000$(grep '^DASHBOARD_PATH_PREFIX=' "$B" | cut -d= -f2-)"
unset W K S
echo "1/4 переменные записаны"
cd /opt/wetop-bot/assistant
docker compose up -d --build --force-recreate app monitor
for i in $(seq 1 36); do curl -sf 127.0.0.1:8000/health >/dev/null && break; sleep 5; done
echo "2/4 помощник: $(curl -s 127.0.0.1:8000/health)"
grep -q 'assistant.wetop.ai' "$F" || sed -i 's#^\(\s*\)- service: http_status:404#\1- hostname: assistant.wetop.ai\n\1  path: ^/(widget/.*|health)$\n\1  service: http://assistant:8000\n\1- service: http_status:404#' "$F"
echo "3/4 правило туннеля: $(grep -c 'assistant.wetop.ai' "$F"), $(grep '^tunnel:' "$F")"
cd /root/wetop/deploy
docker compose -f compose.yml -f compose.hostinger.yml up -d --force-recreate api web cloudflared
echo "4/4 в общей сети: $(docker network inspect wetop-internal --format '{{range .Containers}}{{.Name}} {{end}}')"
SH
bash /root/assistant-setup.sh
```

Проверка после записи DNS: `curl -s https://assistant.wetop.ai/health` — `ok`; в стойке справа внизу — кнопка чата;
в «Платформа → Техподдержка» — диалоги, а не «ИИ-помощник не подключён».

**Обновить код уже поднятого помощника** (например, после ADR-084: ключ помощника открывает правила и модель). Копия
бота обновляется из клона, а `.env`, `compose.override.yml`, том `data/` (там правила, сохранённые из «Техподдержки») и
`logs/` не трогаются:

```bash
cd /root/wetop && git log -1 --oneline
tar -C /root/wetop/apps/ai-seller --exclude=./data --exclude=./logs --exclude=./.env -cf - . | tar -C /opt/wetop-bot/assistant -xf -
cd /opt/wetop-bot/assistant && docker compose up -d --build app && curl -s 127.0.0.1:8000/health
```

**Обновить код продавца** — то же, но папка `seller`, и 🔴 порт возвращается сразу после копирования: `compose.yml` из
клона снова слушает `8000`, а он занят помощником — без правки продавец не поднимется. Пересобираются обе службы
(`app` и `monitor`), миграции бота (`0002`…`0005`) alembic применит сам при старте:

```bash
tar -C /root/wetop/apps/ai-seller --exclude=./data --exclude=./logs --exclude=./.env -cf - . | tar -C /opt/wetop-bot/seller -xf -
sed -i 's/127.0.0.1:8000:8000/127.0.0.1:8001:8000/' /opt/wetop-bot/seller/compose.yml
cd /opt/wetop-bot/seller && docker compose up -d --build && curl -s 127.0.0.1:8001/health
```

🔴 **Всё, что вставляется в веб-терминал, — внутри `bash <<'SCRIPT' … SCRIPT`.** `set -e`, вставленный прямо в
терминал, закрывает сам терминал на первой ошибке («Your session ended», 26.09.2026): так закрыла его проверка
`curl`, запущенная раньше, чем продавец успел подняться. В дочернем `bash` ошибка заканчивает только скрипт.

🔴 **Внутри такого скрипта `docker compose exec` — только с `</dev/null`.** Скрипт приходит в `bash` через стандартный
ввод, а `exec` его тоже читает: он съедает все строки после себя, и скрипт молча кончается без ошибки (29.09.2026 после
обновления помощника не выполнились проверки живости снаружи). Правильно: `docker compose exec -T app … </dev/null`.

**Шаги 10–11 одним скриптом** (котировка и хранилище ключей продавца). Запускать **после** выкладки нового кода:
скрипт сам откажет, если клон на сервере старый. Повторный запуск безопасен: ключ котировки берётся уже вписанный,
`LLM_KEYS_SECRET` не перезаписывается никогда, значения не печатаются:

```bash
bash <<'SCRIPT'
set -u
P=/root/wetop/.env; D=/opt/wetop-bot/seller; S=$D/.env
put() { if grep -q "^$2=" "$1"; then sed -i "s#^$2=.*#$2=$3#" "$1"; else printf '%s=%s\n' "$2" "$3" >> "$1"; fi; }
[ -f "$P" ] || { echo "✗ нет $P"; exit 1; }
[ -f "$S" ] || { echo "✗ нет $S: копия продавца не заведена — сначала шаг 5б"; exit 1; }
grep -q SELLER_QUOTE_KEY /root/wetop/apps/api/src/auth/auth.guard.ts || { echo "✗ клон на старом коде: сначала release на свежий main и миграции"; exit 1; }
Q=$(grep -m1 '^SELLER_QUOTE_KEY=' "$P" | cut -d= -f2-); [ -n "$Q" ] || Q=$(openssl rand -hex 32)
put "$P" SELLER_QUOTE_KEY "$Q"; put "$S" INTEGRATION_API_KEY "$Q"; unset Q
put "$S" INTEGRATION_MODE wetop; put "$S" INTEGRATION_BASE_URL http://api:3001
grep -q '^LLM_KEYS_SECRET=.' "$S" || put "$S" LLM_KEYS_SECRET "$(openssl rand -base64 32 | tr '+/' '-_')"
echo "✓ 1/3 ключи вписаны"
tar -C /root/wetop/apps/ai-seller --exclude=./data --exclude=./logs --exclude=./.env -cf - . | tar -C "$D" -xf - || { echo "✗ код продавца не скопирован"; exit 1; }
sed -i 's/127.0.0.1:8000:8000/127.0.0.1:8001:8000/' "$D/compose.yml"
cd "$D" && docker compose up -d --build || { echo "✗ продавец не собрался — вывод выше"; exit 1; }
for i in $(seq 1 40); do curl -sf 127.0.0.1:8001/health >/dev/null && break; sleep 3; done
curl -sf 127.0.0.1:8001/health >/dev/null && echo "✓ 2/3 продавец отвечает" || echo "✗ продавец молчит 2 минуты: cd $D && docker compose logs --tail=60 app"
cd /root/wetop/deploy && docker compose -f compose.yml -f compose.hostinger.yml up -d --force-recreate api web && echo "✓ 3/3 api и web перезапущены"
SCRIPT
```

**Скрипт уже запускали до «Техподдержки» (Э3)?** Тогда у помощника пустой `SELLER_SERVICE_KEY`, и панель закрыта. Ключ
и адрес панели — одной вставкой в веб-терминал; значения не печатаются, `api` и помощник перезапускаются:

```bash
bash <<'SCRIPT'
set -eu
B=/opt/wetop-bot/assistant/.env; P=/root/wetop/.env
put() { if grep -q "^$2=" "$1"; then sed -i "s#^$2=.*#$2=$3#" "$1"; else printf '%s=%s\n' "$2" "$3" >> "$1"; fi; }
S=$(openssl rand -hex 32)
put "$B" SELLER_SERVICE_KEY "$S"; put "$P" ASSISTANT_SERVICE_KEY "$S"; unset S
put "$P" ASSISTANT_PANEL_URL "http://assistant:8000$(grep '^DASHBOARD_PATH_PREFIX=' "$B" | cut -d= -f2-)"
cd /opt/wetop-bot/assistant && docker compose up -d --force-recreate app
cd /root/wetop/deploy && docker compose -f compose.yml -f compose.hostinger.yml up -d --force-recreate api
SCRIPT
```

**Вебхук WhatsApp продавца наружу (шаг 12).** Правило — как в `deploy/cloudflared.example.yml`: к продавцу пропускается
только `/channels/whatsapp/webhook/<uuid гостиницы>`; чат продавца, панель и `/internal/*` наружу не выходят. Пока база
бота не в РК, подключать только тестовый номер Meta (ADR-009). Одна вставка в веб-терминал, повтор ничего не дублирует;
`cloudflared` перезапускается — стойка на полминуты недоступна:

```bash
bash <<'SCRIPT'
set -eu
F=/root/wetop/deploy/cloudflared/wetop.yml
grep -q 'seller.wetop.ai' "$F" || sed -i 's#^\(\s*\)- service: http_status:404#\1- hostname: seller.wetop.ai\n\1  path: ^/channels/whatsapp/webhook/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$\n\1  service: http://seller:8000\n\1- service: http_status:404#' "$F"
grep -A2 'hostname: seller.wetop.ai' "$F"
cd /root/wetop/deploy && docker compose -f compose.yml -f compose.hostinger.yml restart cloudflared
SCRIPT
```

Затем запись DNS `seller` — CNAME на `<ID туннеля>.cfargotunnel.com` с оранжевым облаком — в панели Cloudflare (ID —
строка `tunnel:` в том же файле). Проверка: адрес вебхука из окна «ИИ-продавец → WhatsApp» с чужим словом —
`curl -s -o /dev/null -w '%{http_code}\n' '<адрес вебхука>?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1'`
даёт `403` (дверь продавца на месте и чужое слово не принимает); `https://seller.wetop.ai/widget/widget.js` и
`https://seller.wetop.ai/health` — `404`.

**Что вписать в `.env` помощника.**

| Группа | Переменные |
|---|---|
| сервис | `APP_ENV=production`, `PUBLIC_BASE_URL=https://assistant.wetop.ai`, `CORS_ORIGINS=https://app.wetop.ai,https://wetop.ai,https://www.wetop.ai` |
| своя база и Redis | `POSTGRES_HOST=postgres`, `POSTGRES_PORT=5432`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (придумать), `REDIS_URL=redis://redis:6379/0` |
| модель | `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` и запасные — ключ роутера владельца |
| панель | `DASHBOARD_PATH_PREFIX` — случайный отрезок пути, например `/p` и 12 знаков из `openssl rand -hex 6`: без него бот не подключает маршруты панели, и платформе некуда ходить. `DASHBOARD_JWT_SECRET` — `openssl rand -hex 32`. `DASHBOARD_ADMIN_EMAIL` и `DASHBOARD_ADMIN_PASSWORD_HASH` — **пустые**: людей в панели нет, пароль не нужен (поручение владельца 25.09.2026). `SELLER_SERVICE_KEY` у помощника — ключ «Техподдержки» (тот же, что `ASSISTANT_SERVICE_KEY` платформы; скрипт выше делает его сам); пустой — панель закрыта целиком |
| роль и платформа | `BOT_ROLE=support`, `INTEGRATION_MODE=wetop`, `INTEGRATION_BASE_URL=http://api:3001`, `INTEGRATION_API_KEY` = `ASSISTANT_READ_KEY` платформы |
| виджет | `WIDGET_IDENTITY_SECRET` = тот же, что у платформы, `WIDGET_IDENTITY_TTL_SECONDS=43200`, `WIDGET_SITE_HOSTS=app.wetop.ai,wetop.ai,www.wetop.ai` |

У продавца отличаются `BOT_ROLE=seller`, `SELLER_SERVICE_KEY` = тот же, что у платформы, `PUBLIC_BASE_URL=https://seller.wetop.ai`,
свой `DASHBOARD_PATH_PREFIX` — из него платформе `SELLER_URL=http://seller:8000<DASHBOARD_PATH_PREFIX>`. Остальное — по
комментариям в `env.example`; своя база бота накатывает миграции сама при старте (`alembic upgrade head`).


### 30.09.2026: проект инструкции владельца

`POST /generate-instruction` в приватной панели продавца, служебный ключ и `X-Organization`.
Тело `{ "story": "10–4000 знаков" }`. Ответ `{ "text": "проект инструкции", "warnings": [] }`.
Только владелец/платформа; экземпляр поддержки отказывает. Модель вызывается без tools, с ключом организации и лимитом запросов; недоступный счётчик блокирует запрос. Результат не сохраняется и не применяется к runtime. Владелец выбирает редакцию и отдельно сохраняет через PMS `PUT /ai-seller/agents/:id/instruction`. Существующий `/extract-profile` сохраняет прежнюю семантику разбора фактов.

PMS: GET/PUT `/ai-seller/agents/:id/instruction`, POST `/ai-seller/agents/:id/instruction/generate`.
Организация, роль, расширение и выбранный Business/филиал проверяются сервером. Генерация ограничена 10 вызовами в час на пользователя организации.
