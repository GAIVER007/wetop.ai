# План: ИИ-помощник и раздел «ИИ-продавец» — задачи платформы П1–П8 (24.09.2026)

**Источник.** ТЗ «ИИ-помощник и раздел «ИИ-продавец» в платформе WETOP», редакция 1 от 24.09.2026 — копия
`docs/assistant/tz-2026-09-24.md` (тот же текст лежит на ветке бота `ai-seller`, `TZ-integratsiya-wetop.md`; копия
снята с `e48e1d4` и 24.09 вечером обновлена до `3014331d` — уточнения `items`, `x-wetop-service-key`,
`platform:facts.md`). Владелец прислал ТЗ, затем поручил: «давай проверяй внимательно что осталось составь
план и заряжай делай все по плану четко». Решение о приёме ТЗ — ADR-075.

**Ветка:** `claude/festive-johnson-0aark9` от `main` `39563c1`. Задачи бота (Б1–Б8) здесь не делаются: их исполняет
сессия на ветке `ai-seller`. Контракт между сторонами — `docs/assistant/README.md`.

---

## 1. Что осталось: сверка ТЗ с кодом `main` на 24.09.2026

Из задач платформы в `main` нет ни одной: ни `/assistant/*`, ни `/ai-seller/*`, ни переменных `ASSISTANT_*`,
`SELLER_*`, `WIDGET_IDENTITY_*` (поиск по `apps/`, `packages/`, `deploy/`, `docs/`).

| Что утверждает ТЗ | Проверено по коду | Итог |
|---|---|---|
| Карточка объекта: `name`, `address`, `timezone`, `currency`, `checkInTime`, `checkOutTime` | `schema.prisma`, `Property` | есть |
| `GET /guard/status`, `GET /guard/incidents`, ключ `GUARD_READ_KEY` | `guard.controller.ts`, `auth.guard.ts` | есть |
| Фильтр `api-error.filter.ts` пишет только 500 и только по маршруту, без человека | так и есть | журнала ошибок человека нет |
| Политики безопасности контента нет | `next.config.ts` без `headers()`, `middleware.ts` CSP не ставит | нет |
| `user_id` и `org_id` — из `currentActor()` | `currentActor()` заполняет `ActorMiddleware` только по куке и `Bearer`; стойка ходит в API заголовком `x-wetop-session`, и для её запросов `currentActor()` пуст | **расхождение 1** |
| `role` — роль человека в организации | ролей нет: ADR-023, `memberships` без роли, `SignedInUser` без роли | **расхождение 2** |
| Один экземпляр продавца обслуживает одну организацию | платформа мультиарендная с 21.09 (регистрация заводит организацию и объект) | **расхождение 3** |
| `apps/site` — тот же тег | главная — статическая выгрузка для Cloudflare Pages (`output: 'export'`), окружения во время работы нет | **расхождение 4** |
| Права раздела: смотреть — все, менять — владелец | понятия «владелец организации» нет (ADR-023) | **расхождение 5** |
| Идентификатор запроса в журнале | в платформе его нет нигде | **расхождение 6** |
| Узкий ключ «всё остальное — 403» | замок работает только при `AUTH_REQUIRED=1`; без него любой маршрут открыт, а вошедший человек проходит к любому маршруту | **расхождение 7** |
| Код чата продавца для сайта | `SELLER_URL` — внутренний адрес; публичного адреса продавца у платформы нет | **расхождение 8** |
| Песочница под служебным ключом (Б5) | у бота песочница — `POST /internal/sandbox` в корне с `X-Internal-Key`, панель — под путём из настроек | **расхождение 9** |

## 2. Расхождения и как они решены

1. **Автор подписи — из сессии, а не из `currentActor()`.** Источник — `request.user`, который ставит замок
   `SessionGuard` по `x-wetop-session`, `Bearer` или куке (так же работает `/auth/me`). Поля: `id`, `email`,
   `organizationId` сессии.
2. **`role` в подписи пустая.** Формат бота пустое поле принимает (`role or None`) и прав по нему не раздаёт —
   только показывает в карточке диалога. Придумывать роль нельзя (AGENTS.md §4); появятся роли — поле заполнится
   без смены формата. Эталон ТЗ (`…|owner|…`) проверяется на функции подписи как есть.
3. **Продавец привязан к одной организации настройкой `SELLER_ORGANIZATION_ID`.** Без неё любой
   зарегистрировавшийся увидел бы диалоги гостей хостела. Вошедший из другой организации получает «ИИ-продавец
   для вашей организации не подключён»; служебные ходоки проходят, как везде (ADR-061). Своя копия продавца на
   организацию — предложение ТЗ, вопрос Q-176.
4. **Адрес помощника для главной — поле `assistantUrl` в `apps/site/src/site.config.ts`.** Статическая сборка
   берёт значение при сборке; одно место правки у владельца, как у остальных настроек сайта. Пусто — чата нет.
5. **Права раздела — по ADR-023:** смотрят и меняют все сотрудники организации, контроль — журнал действий
   с автором. Предложение ТЗ требует ролей — вопрос Q-175.
6. **Идентификатор запроса — свой.** Фильтр ошибок выдаёт UUID на каждый ответ с ошибкой, кладёт его в строку
   журнала и в заголовок ответа `X-Request-Id`: человек и помощник могут назвать ошибку по номеру.
7. **`GET /assistant/errors` открыт только ключу — всегда.** Кроме строки в замке, контроллер сам сверяет ключ
   помощника или служебный ключ за постоянное время: и при выключенном `AUTH_REQUIRED`, и для вошедшего человека
   (иначе любой сотрудник прочёл бы чужие ошибки, подставив `userId`).
8. **Публичный адрес продавца — `SELLER_PUBLIC_URL`** в окружении API; код для сайта собирает API, браузер
   адреса служебного входа не видит.
9. **Песочница в контракте — `POST {SELLER_URL}/sandbox` под служебным ключом.** Это пункт контракта для Б5:
   бот либо даёт песочницу под путём панели, либо платформа переходит на его путь — `docs/assistant/README.md` §4.

Ещё два решения исполнения (не расхождения, а выбор способа):

- **«Автоматически после правки карточки, категорий, тарифа сайта» (П8)** — не крючками в четырёх модулях, а
  сверкой отпечатка фактов раз в минуту: платформа собирает факты, считает SHA-256 и отправляет продавцу, если
  отпечаток отличается от последнего доставленного. Ловит любой путь правки (стойка, массовая правка цен, импорт,
  скрипт), и повтор после отказа продавца получается сам. Выключатель — `SELLER_SYNC=off`.
- **Смена вошедшего без перезагрузки страницы.** Виджет читает `data-identity` один раз, а вход и выход в стойке —
  серверные действия с мягким переходом. Рядом с тегом стоит клиентский сторож: если на странице работает виджет
  другого человека (вход, выход), страница перезагружается один раз. Иначе после «Выйти» следующий за стойкой видел
  бы диалог предыдущего.

## 3. Шаги

Каждый шаг: тест красный → правка → тест зелёный через `npm run test:record`, лог и строка журнала — в коммите шага.

### Этап 1 — П1, П2: чат помощника на всех экранах

**П1. `GET /assistant/identity`.**
- `packages/integrations/src/assistant/identity.ts` — `signIdentity(secret, fields)`: строка
  `user_id|email|org_id|role|issued_at`, `|` → пробел, края обрезаны, base64url без `=`, HMAC-SHA256 hex.
  `IDENTITY_TTL_SECONDS = 43200` — равен `WIDGET_IDENTITY_TTL_SECONDS` помощника (Б2).
- `apps/api/src/assistant/` — модуль, контроллер: только вошедшему (`request.user`), иначе 401; без
  `WIDGET_IDENTITY_SECRET` — 503; ответ `{ token, expiresAt }`, `Cache-Control: no-store`.
- Тесты: эталон ТЗ байт в байт; `|` в почте; целые секунды; 401 без сессии и со служебным ключом; 503 без секрета;
  токен читается тем же разбором, что у бота, и несёт поля сессии.

**П2. Тег виджета.**
- `apps/web/src/lib/assistant-widget.ts` — адрес скрипта из `ASSISTANT_URL` (только `http(s)`, без него — тега нет).
- `apps/web/src/components/shell/assistant-widget.tsx` — серверный кусок макета: подпись берётся на сервере
  (`/assistant/identity` с сессией человека; без куки запроса нет), `data-identity` только вошедшему; 401 не уводит
  на вход (макет рисуется и на `/login`). Клиентский сторож перезагружает страницу при смене вошедшего.
- `apps/web/src/app/layout.tsx` — перед `</body>`.
- `apps/site/src/site.config.ts` — `assistantUrl: ''`; `lib/site.ts` — проверка адреса; `layout.tsx` — тег без
  `data-identity`.
- Тесты: адрес и атрибуты тега; пусто — тега нет; `data-identity` только с подписью; кривой адрес останавливает
  сборку сайта.

### Этап 2 — П3, П4: помощник видит ошибки человека и состояние системы

**П3. Журнал ошибок, которые видит человек** — `DATA_MODEL.md` v1.8 §14, таблица `user_errors`.
- Миграция `20260924000018_user_errors` + `down.sql`; проверка — `scripts/ops/check-migrations.sh`.
- `packages/domain/src/assistant/` — раздел по маршруту («Брони», «Шахматка»…), текст ошибки из ответа Nest
  через `redactText` (почта, телефоны, секреты), срок 30 суток.
- `api-error.filter.ts` — после ответа: 4xx и 5xx, только когда есть `request.user`; маршрут — шаблоном
  (`req.route.path`); тела запроса нет по построению; `/assistant/*` не пишется (иначе «помощник не настроен»
  попадал бы в журнал на каждой странице); одинаковая ошибка того же человека чаще раза в минуту не дублируется;
  запись не задерживает и не ломает ответ.
- Уборка — служба по образцу `WebRetentionService`: раз в сутки после 04:00 Алматы, выключатель
  `USER_ERRORS_RETENTION=off`.
- Тесты: unit (фильтр, раздел, текст, уборка) и integration на локальной PostgreSQL 16 (CHECK, выборка, уборка).

**П4. Узкий ключ `ASSISTANT_READ_KEY`.**
- `auth.guard.ts` — рядом с `GUARD_READ_KEY`: `GET /assistant/errors` и `GET /guard/status`, остальное 403.
- `GET /assistant/errors?userId=&organizationId=&since=&limit=` — оба id обязательны (UUID), `since` — ISO,
  по умолчанию сутки назад, `limit` 1…50 (20); ответ `[{ at, section, status, message }]`, новые сверху.
- Тесты: два разрешённых адреса, 403 на остальное и на запись; ключ проверяется и при выключенном замке; вошедший
  человек без ключа получает отказ.

### Этап 3 — П5, П7, П8 и экраны «Настройки», «Данные объекта», «Проверка»

**П5. Профиль продавца** — `DATA_MODEL.md` v1.8 §15, таблица `seller_profiles`, одна строка на организацию.
- Миграция `20260924000019_seller_profiles` + `down.sql`.
- `packages/domain/src/ai-seller/profile.ts` — поля, пределы длины, перечисления, умолчания; ядра правил в профиле
  нет и быть не может: это поля, а не текст промпта (ТЗ §2 п. 2).
- `GET/PUT /ai-seller/profile` — правка пишет журнал действий `seller.profile.updated` с автором.

**П7. Прокси к продавцу.**
- `packages/integrations/src/assistant/seller-client.ts` — вызовы по `SELLER_URL` с `X-Service-Key`, тайм-ауты,
  отказ «продавец недоступен» отдельно от «продавец отклонил»; ключ не попадает ни в ответ, ни в текст ошибки.
- `apps/api/src/ai-seller/` — явный список маршрутов (не «всё под `/ai-seller/*`»): диалоги (список, карточка,
  перехват, возврат, ответ), знания (список, загрузка), сводка, песочница, код для сайта, состояние.

**П8. Применение.**
- «Применить» — сохранить профиль и сразу отправить профиль и факты; отказ продавца — понятное сообщение, профиль
  сохранён, повтор автоматически.
- Факты: адрес, заезд и выезд, часовой пояс, валюта, активные категории с вместимостью и числом мест, тариф сайта
  (`tracked_sites.booking_rate_plan_id`) и его цены на 60 дней вперёд — `priceMinor` строкой и готовый текст суммы
  (бот деньги не считает). Наличия мест в фактах нет — это часть 3.
- Служба сверки раз в минуту: профиль новее доставленного — отправить; отпечаток фактов другой — отправить;
  отказ — `last_error`, следующая попытка через минуту.

**П6 (часть).** Раздел `/ai-seller` в навигации рядом с «Менеджером каналов»: вкладки «Настройки», «Данные объекта»,
«Проверка» на компонентах `apps/web/src/components` (DESIGN.md §8; новый компонент — только после строки в §8).

### Этап 4 — П6: «Знания», «Диалоги», «Код для сайта»

- «Знания» — список и загрузка (md, txt, pdf, docx, xlsx; предел размера — у бота).
- «Диалоги» — список (имя замаскировано ботом), карточка, «Перехватить», «Вернуть боту», «Ответить», пометка
  «нужен человек» (`needs_human`).
- «Код для сайта» — тег чата продавца из `SELLER_PUBLIC_URL`, кнопка «Скопировать».
- Тесты: unit стойки на сборку данных экранов; набор стойки без базы (`tests/ui`) — раздел открывается, доступность.

### Этап 5 — часть 3 (брони от продавца) — **не делается**

Условия ТЗ не выполнены: база не в Казахстане (`PII_STORAGE` пуст), смена ведёт день не в WETOP, Q-166 и Q-114 не
решены. Новое значение `AI` в `ReservationSource` — отдельная правка `DATA_MODEL.md` после этих решений.

## 4. Модель данных — `DATA_MODEL.md` v1.8

§14 `user_errors` и §15 `seller_profiles` — таблицы, которые ТЗ называет прямо (П3, П5), с полями из ТЗ. Существующие
таблицы не меняются. Приняты вместе с ТЗ по поручению «составь план и заряжай делай все по плану четко» — тем же
порядком, что §11 («давай внедряй») и §12 («делай» на план среза 11). Боевую миграцию применяет владелец (AGENTS.md §15);
откат — `down.sql` рядом с каждой миграцией.

## 5. Настройки окружения — имена (значения вписывает владелец; `.env.example` агенту закрыт)

| Где | Имя | Зачем | Пусто |
|---|---|---|---|
| API | `WIDGET_IDENTITY_SECRET` | подпись вошедшего (П1), общий с помощником | подпись не выдаётся, чат анонимный |
| API | `ASSISTANT_READ_KEY` | узкий ключ помощника (П4) | помощник ошибок не видит |
| API | `USER_ERRORS_RETENTION` | `off` — не чистить журнал ошибок по расписанию | чистит |
| API | `SELLER_URL` | внутренний адрес API панели продавца (П7) | раздел: «продавец не подключён» |
| API | `SELLER_SERVICE_KEY` | служебный ключ продавца (П7, Б5) | то же |
| API | `SELLER_ORGANIZATION_ID` | чья это копия продавца | то же |
| API | `SELLER_PUBLIC_URL` | публичный адрес продавца для кода на сайт | кода нет |
| API | `SELLER_SYNC` | `off` — не отправлять факты по расписанию | отправляет |
| стойка | `ASSISTANT_URL` | адрес помощника для тега (П2) | тега нет |
| главная | `assistantUrl` в `site.config.ts` | то же для wetop.ai | тега нет |

## 6. Что за владельцем

- Адреса экземпляров (Q-173), сервер (Q-174), права раздела (Q-175), вторая организация (Q-176).
- Вписать переменные раздела 5 в `.env` сервера и имена — в `.env.example`.
- Применить миграции `20260924000018`, `20260924000019` на рабочей базе (`docs/deploy.md`).
- Выложить: из контейнера SSH нет.
- Часть 3 — после Q-166, Q-114 и переезда базы в РК.

## 7. Откат

Код — revert коммитов ветки. База — `down.sql` обеих миграций (таблицы новые, чужих данных в них нет).
Без переменных окружения всё новое молчит: тега нет, подпись не выдаётся, раздел говорит «не подключён», службы
сверки и уборки не делают ничего.

## 8. Исполнение (24.09.2026)

| Этап | Шаги | Состояние | Коммит |
|---|---|---|---|
| 1 | П1, П2 | сделано | `c3ae230`, `0ad921a` |
| 2 | П3, П4 | сделано; миграция `20260924000018` | `b8db4dc`, `14bb92a` |
| 3 | П5, П7, П8 | сделано; миграция `20260924000019` | `7af76cb` |
| 3–4 | П6 — все шесть экранов, меню, значок | сделано | `028bb1f4` |
| — | сверка с кодом бота (§9): `items`, песочница, отказы; отказ по содержанию без повтора | сделано | `c628e4bd` |
| — | П5, П6, П8 под схемы бота Б6, Б7 (§11) | **ждёт владельца** — Q-177, Q-179 | — |
| 5 | часть 3 | не делается — условия не выполнены | — |

Отклонения от плана: предел документа знаний — 10 МБ, как у продавца (`kb_max_file_mb`), а не 20; ради него предел тела
серверного действия стойки поднят до 11 МБ. Доказательства и приёмка по пунктам — `reports/ai-assistant-seller-2026-09-24.md`.

## 9. Сверка с кодом бота (24.09.2026, вечер)

Владелец прислал порядок работ: сначала план со списком файлов, потом код; новые таблицы П3 и П5 — `DATA_MODEL.md` и
миграция с откатом — сначала ему; в `main` без него не сливать; контракт бота молча не менять; расхождение с ТЗ —
сначала вопрос, потом правка. Сторона бота готова (Б1–Б7), ветка `origin/ai-seller` на `3014331d`; ТЗ там уточнено после
нашей копии (`items`, `x-wetop-service-key`, `platform:facts.md`). Сверено по коду бота:

| Что | Бот (`origin/ai-seller`) | Платформа до сверки | Итог |
|---|---|---|---|
| Подпись П1 | `src/channels/widget_identity.py` | тот же формат | совпадает; проверено кодом бота на эталоне ТЗ и на живых полях (отчёт §7) |
| Ключ помощника | `x-wetop-service-key` (`src/integrations/wetop.py`) | так же | совпадает |
| `GET /assistant/errors` — параметры | `userId`, `organizationId`, `since` (Python `isoformat()`), `limit` | так же | совпадает; `since` с микросекундами и смещением принимается (тест) |
| `GET /assistant/errors` — ответ | `{ items: […] }`, поле `errors` — признак отказа | голый список | **исправлено** — обёртка `items` |
| `GET /guard/status` | берёт `dbDownSince`, `open.critical` | есть | совпадает |
| Служебный ключ продавца | `X-Service-Key`, маршруты `SERVICE_ROUTES` под путём панели | так же | совпадает |
| Песочница | `POST /internal/sandbox` в корне экземпляра, `X-Service-Key` | `POST {SELLER_URL}/sandbox` | **исправлено** — корень адреса `SELLER_URL` |
| Отказ профиля | `detail: { message, fields }` | понимала строку и список | **исправлено** — причина и названия полей экрана |
| 403 продавца | «Доступ с этого адреса закрыт», «маршрут закрыт» | всё называла «ключ не принят» | **исправлено** — слова продавца |
| Диалоги, знания, сводка | как в контракте | так же | совпадает |
| Профиль (Б6) | `SellerProfile`, `extra='forbid'`: `object_name`, `emoji` ×3, `reply_length` ×2, списки запретов и «звать человека», `extra_charges`, `faq {q, a}` | своя первая редакция | **не совпадает — вопрос Q-177** (таблица §15) |
| Факты (Б7) | `ObjectFacts`, `extra='forbid'`: плоско, одна цена на категорию | окно цен на 60 дней | **не совпадает — вопросы Q-177, Q-179** |

Поправки сделаны тем же порядком: тест красный на прежнем коде → правка → зелёный (`reports/ai-assistant-seller-2026-09-24.md` §7).
Там же исправлено найденное перечитыванием П6–П8: версия, отклонённая продавцом по содержанию (400, 422), сверкой раз в
минуту больше не повторяется — только после правки или по «Применить» (ADR-075).

## 10. Файлы по задачам

Всё — на ветке `claude/festive-johnson-0aark9`; в `main` не слито. Тесты и логи прогонов (`tests/runs/`) не перечислены.

| Задача | Файлы |
|---|---|
| П1 | `packages/integrations/src/assistant/{identity.ts, identity.test.ts, index.ts}`, `packages/integrations/src/index.ts`, `apps/api/src/assistant/{assistant.controller.ts, assistant.controller.test.ts, assistant.module.ts}`, `apps/api/src/app.module.ts` |
| П2 | `apps/web/src/components/shell/{assistant-widget.tsx, assistant-widget-script.tsx, assistant-widget.css}`, `apps/web/src/lib/{assistant-widget.ts, assistant-widget-owner.ts, assistant-widget.test.ts, api.ts}`, `apps/web/src/app/layout.tsx`, `apps/site/src/{site.config.ts, lib/site.ts, lib/site.test.ts, app/layout.tsx}`, `scripts/preview/fixture-api.ts`, `tests/ui/{assistant-widget.spec.ts, fake-assistant.ts, playwright.assistant.config.ts}` |
| П3 | `DATA_MODEL.md` §14, `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260924000018_user_errors/{migration.sql, down.sql}`, `packages/domain/src/assistant/{user-errors.ts, user-errors.test.ts, index.ts}`, `packages/domain/src/index.ts`, `apps/api/src/assistant/{user-errors.repository.ts, user-errors.module.ts, user-errors-retention.service.ts, user-errors-retention.service.test.ts, assistant.module.ts}`, `apps/api/src/guard/{api-error.filter.ts, api-error.filter.test.ts, guard.module.ts}`, `tests/integration/user-errors.test.ts` |
| П4 | `apps/api/src/auth/{auth.guard.ts, auth.guard.test.ts}`, `apps/api/src/assistant/{assistant.controller.ts, assistant.controller.test.ts}` |
| П5 | `DATA_MODEL.md` §15, `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260924000019_seller_profiles/{migration.sql, down.sql}`, `packages/domain/src/ai-seller/{profile.ts, profile.test.ts, index.ts}`, `apps/api/src/ai-seller/seller.repository.ts`, `tests/integration/seller-profiles.test.ts` |
| П7 | `packages/integrations/src/assistant/{seller-client.ts, seller-client.test.ts}`, `apps/api/src/ai-seller/{seller.connection.ts, seller.service.ts, ai-seller.controller.ts, ai-seller.controller.test.ts, ai-seller.module.ts, fakes.ts}`, `apps/api/src/app.module.ts` |
| П8 | `packages/domain/src/ai-seller/{facts.ts, facts.test.ts}`, `apps/api/src/ai-seller/{seller.service.ts, seller-sync.service.ts, seller-sync.service.test.ts}` |
| П6 | `apps/web/src/app/ai-seller/{[[...section]]/page.tsx, actions.ts, forms.tsx, ai-seller.css}`, `apps/web/src/lib/{ai-seller.ts, ai-seller.test.ts, api.ts, navigation.ts}`, `apps/web/src/components/icon.tsx`, `apps/web/next.config.ts`, `scripts/preview/fixture-api.ts`, `tests/ui/{ai-seller.spec.ts, accessibility.spec.ts, navigation.spec.ts, playwright.config.ts}` |
| Документы | `docs/assistant/{README.md, tz-2026-09-24.md}`, `DATA_MODEL.md`, `DECISIONS.md` (ADR-075), `QUESTIONS.md` (Q-173…Q-179), `SPEC.md`, `SECURITY.md` §13, `DESIGN.md` §7–8, `TESTING.md`, `CLAUDE.md` §2, этот план, `reports/ai-assistant-seller-2026-09-24.md` |

## 11. Переделка П5, П6, П8 под схемы бота Б6 и Б7 — **ждёт владельца** (Q-177, Q-179)

Не начата: меняет таблицу §15, а цена в фактах — решение по деньгам. После «да» по Q-177 и ответа по Q-179:

| Шаг | Файлы |
|---|---|
| 1. Таблица §15 в редакции под Б6: `emoji` ×3, `reply_length` ×2, `extra_charges`, `prohibitions` и `call_human_when` — `text[]`, пределы бота | `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260924000019_seller_profiles/{migration.sql, down.sql}` (переписываются: на рабочей базе не применялись), `tests/integration/seller-profiles.test.ts` |
| 2. Домен: поля и пределы профиля; тело `PUT /seller/profile` по схеме бота (`object_name` из карточки, языки названиями, `faq` → `{q, a}`); факты плоско, одна цена на категорию по ответу Q-179, `kind` `room`/`bed` | `packages/domain/src/ai-seller/{profile.ts, profile.test.ts, facts.ts, facts.test.ts}` |
| 3. API: сборка тела, отпечаток новых фактов | `apps/api/src/ai-seller/{seller.service.ts, seller.repository.ts, ai-seller.controller.test.ts, seller-sync.service.test.ts}` |
| 4. Экран «Настройки»: три варианта эмодзи, две длины, запреты и «когда звать человека» списком; «Данные объекта» — цена, которую получает продавец; в «Знаниях» документ бота `platform:facts.md` — подписью «Данные объекта (от платформы)», а не именем файла | `apps/web/src/app/ai-seller/{forms.tsx, [[...section]]/page.tsx}`, `apps/web/src/lib/{ai-seller.ts, ai-seller.test.ts, api.ts}`, `scripts/preview/fixture-api.ts`, `tests/ui/ai-seller.spec.ts` |
| 5. Проверка тел на схемах бота: тела платформы проходят `SellerProfile` и `ObjectFacts` бота (pydantic) без 422 | сценарий сверки в `reports/`, по образцу проверки подписи (отчёт §7) |
| 6. Документы | `DATA_MODEL.md` §15, `docs/assistant/README.md` §4, отчёт |

