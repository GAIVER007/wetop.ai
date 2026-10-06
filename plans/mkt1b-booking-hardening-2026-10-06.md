# MKT1B: Booking Foundation Hardening (план, без кода)

Статус: **план 06.10.2026, срез MKT1A** (ADR-149). Код по нему пишется только после отдельного «да» владельца.
Источник: свежий `origin/main` `dcf3145c`. Строки ниже сверены с этим коммитом.

Цель: прежде чем первый управляемый сайт MKT покажет форму брони, публичный контракт `/w/*` должен работать для
любого объекта любой организации, не создавать двойных броней и не зависеть от выбора «самого раннего объекта».
Второго движка брони не появляется: правки идут в существующий путь.

Общие правила среза: red → green по каждому пункту (AGENTS.md §6), прогоны через `npm run test:record`,
модель данных и деньги не меняются, правила цены и доступности не меняются, production не трогается, выкладка стойки
по «да» владельца (AGENTS.md §18).

## BOOK-1. CORS виджета для сайтов всех организаций

**Где сейчас.**
- `apps/api/src/web-booking/web-booking.module.ts:39-76` `WidgetCorsMiddleware`, подключён на `w/*path` (`:97`).
- `:66-75` `hosts()` зовёт `AnalyticsRepository.sites()`.
- `apps/api/src/analytics/analytics.repository.ts:219-230`: `sites()` фильтрует `where: { propertyId }`, а
  `propertyId()` идёт через `propertyIdRef` (`apps/api/src/database/property-ref.ts:64-115`). В мидлваре нет вошедшего
  человека и scope организации, поэтому `propertyRef` берёт объект установки: `INTEGRATION_PROPERTY_ID` или объект по
  имени Luxx (`:82-114`).
- Для сравнения: счётчик `/a/hit` уже берёт все сайты без scope через `allSites()` (`analytics.repository.ts:245-248`,
  `apps/api/src/analytics/collect.service.ts:138-171`).

**Как ломается.** Виджет на домене сайта второй организации делает `GET /w/availability` и `POST /w/book` с
`Content-Type: application/json` (предзапрос `OPTIONS`). Ответ приходит без `Access-Control-Allow-Origin`, браузер не
отдаёт его странице: форма брони не работает. Вывод по чтению кода, живьём не воспроизводилось.

**Целевой инвариант.** Мидлвар разрешает `Origin`, если его хост совпадает с хостом любого сайта любой организации в
статусе `ACTIVE` с `booking_enabled` (или это собственный хост API). Это только допуск браузера; точная проверка «этот
ключ сайта с этого домена» остаётся в `bookingSite` (`apps/api/src/web-booking/web-booking.service.ts:547-561`) и не
ослабляется. Кэш хостов прежний (30 с).

**Красный тест.** Unit мидлвара с подставным репозиторием: два сайта двух организаций, у второго хост `b.example`;
сейчас `Origin: https://b.example` не получает заголовок (красный), после правки получает; хост сайта на паузе или с
выключенной бронью не получает; чужой хост не получает. Integration на настоящей базе: сайт второй организации,
мидлвар под служебным пулом видит его хост.

**Вероятные файлы.** `web-booking.module.ts` (брать `allSites()` вместо `sites()`), тест рядом
(`apps/api/src/web-booking/*.test.ts`), `fake-repository.ts` при необходимости.

**Регрессия.** `apps/api/src/web-booking/web-booking.controller.test.ts`, `turnstile.test.ts`,
`apps/api/src/analytics/collect.controller.test.ts`, `tests/integration/web-analytics.test.ts`,
`tests/integration/rls-isolation.test.ts`, `tests/e2e/web-booking.spec.ts`, `tests/ui/booking-widget-turnstile.spec.ts`.

**Не меняется.** Проверка ключа и домена в `bookingSite`; права кабинета `/analytics/sites*` (там `sites()` по объекту
вошедшего остаётся); лимиты; Turnstile.

## BOOK-2. Идемпотентность `POST /w/book`

**Где сейчас.**
- `apps/api/src/web-booking/web-booking.service.ts:349-432` `book()`: разбор, лимит IP, Turnstile (`:364-372`), лимит
  сайта, затем `reservations.create` (`:408-432`) без `creationKey`.
- `packages/domain/src/web-booking/request.ts:114-149` `parseBookingRequest` ключа не принимает.
- Общая идемпотентность уже есть: `apps/api/src/reservations/reservations.service.ts:389-414` (ключ UUID v4 и отпечаток
  sha256 канонического тела), `:458-470` (блокировка `create:<property>:<key>`, повтор с тем же отпечатком отдаёт ту же
  бронь, другой отпечаток даёт 409), `:635-636` (запись `creation_key`, `creation_fingerprint`);
  `packages/database/prisma/schema.prisma:316-317`, `@@unique([propertyId, creationKey])` `:352`.
- Виджет отправляет бронь `apps/api/src/web-booking/widget.js:885-895` без ключа.

**Как ломается.** Двойное нажатие, повтор после обрыва связи или повтор браузером создаёт вторую настоящую бронь.
Защита сегодня только косвенная: лимиты и то, что сбои после записи не отдают ошибку (`web-booking.service.ts:437-438`).

**Целевой инвариант.** Один щелчок «Забронировать» это один ключ (UUID v4, создаётся виджетом на попытку и
переиспользуется при её повторе). Повтор с тем же ключом и тем же содержимым возвращает ту же бронь и не создаёт
вторую, не шлёт второе письмо и не тратит второй слот лимита сайта. Тот же ключ с другим содержимым даёт 409.
Используется существующий механизм `ReservationsService.create`, вторая система не заводится.

**Две ловушки, которые план обязан закрыть.**
1. Псевдоним гостя создаётся заново на каждый вызов: `guestForStorage(req.guest, \`web:${site.id}:${randomUUID()}\`)`
   (`web-booking.service.ts:405`). Отпечаток считается по телу `create`, куда входит этот гость, поэтому честный повтор
   получил бы 409. Зерно псевдонима должно выводиться из ключа (`web:<site>:<creationKey>`), либо отпечаток считается до
   псевдонимизации.
2. Токен Turnstile одноразовый, а проверка стоит до записи (`:364-372`): повтор с тем же токеном откажет раньше, чем
   сработает идемпотентность. Варианты для red-теста: проверять «бронь с этим ключом уже есть» до Turnstile и отдавать
   её без новой проверки (ключ знает только отправитель), или требовать новый токен на повтор. Выбор фиксируется в
   плане среза до кода; рекомендация: поиск по ключу до Turnstile, только чтение, без создания.

**Красный тест.** Unit `web-booking.controller.test.ts`: два `POST /w/book` с одним ключом дают одну бронь и один номер
подтверждения (сейчас две); другой текст гостя с тем же ключом даёт 409; неверный ключ даёт 400. Domain: разбор ключа
в `request.test.ts`. Integration на настоящей базе: параллельные два запроса с одним ключом, одна строка
`reservations`. UI: двойной щелчок в виджете не создаёт второй брони (`tests/ui/booking-widget-*.spec.ts`).

**Вероятные файлы.** `packages/domain/src/web-booking/request.ts` (+ тест), `apps/api/src/web-booking/web-booking.service.ts`,
`apps/api/src/web-booking/widget.js`, `apps/api/src/web-booking/web-booking.controller.test.ts`, новый integration-тест.

**Регрессия.** Те же, что BOOK-1, плюс `tests/integration/website-reservations.test.ts`,
`tests/integration/seller-booking-intents.test.ts` (у продавца ключ уже используется), unit `reservations.service`.

**Не меняется.** Правило отпечатка в `ReservationsService`; правила цены, доступности, автоназначения; письмо гостю
(только не дублируется); связь сессии счётчика с бронью.

## BOOK-3. `GET /w/config` в правилах туннеля

**Где сейчас.**
- `deploy/cloudflared.example.yml:37-39` пускает наружу только `^/w/(widget\.js|availability|book)$`.
- Виджет первым делом зовёт `/w/config` за ключом Turnstile: `apps/api/src/web-booking/widget.js:489-497`; маршрут
  `apps/api/src/web-booking/web-booking.controller.ts:65-69`.
- Режим проверки: `WEB_BOOKING_TURNSTILE_REQUIRED` (`apps/api/src/web-booking/turnstile.ts:37-43`).
- `docs/deploy.md:82` велит проверять `curl https://<API>/w/config`, а `SECURITY.md:324-325` и `:358-359` в списке
  публичных путей `/w/config` не называют.
- Настоящие правила на сервере в git не лежат (`deploy/cloudflared/` в `.gitignore`): **неизвестно**, открыт ли путь в
  production.

**Как ломается.** Если сервер настроен по образцу, `/w/config` получает 404 на краю туннеля, виджет глотает ошибку
(`{}`), Turnstile не рисуется, токена нет; при обязательной проверке `/w/book` отказывает каждой брони.

**Целевой инвариант.** Каждый путь, который зовёт публичный виджет (`/w/widget.js`, `/w/config`, `/w/availability`,
`/w/book`), открыт в образце туннеля и назван в `SECURITY.md` §11; демо-страницы `/w/demo` и `/a/demo` по-прежнему
закрыты.

**Красный тест.** В `tests/unit/deploy-server.test.ts` (там уже разбираются правила туннеля, `:350-385`): извлечь из
`widget.js` все вызовы `request('GET'|'POST', '/w/...')` и проверить, что каждый проходит правило `api.wetop.ai` образца;
`/w/demo` не проходит. Сейчас красный на `/w/config`.

**Вероятные файлы.** `deploy/cloudflared.example.yml`, `SECURITY.md` §11, `tests/unit/deploy-server.test.ts`.

**Отдельно до production (не код).** Владелец сверяет живые правила туннеля на сервере и `curl -s https://<API>/w/config`
(должен вернуть `{"turnstileSiteKey":…}`), правка конфига сервера только им.

**Не меняется.** Остальные правила туннеля; закрытость `/w/demo`, `/a/demo`, панели бота.

## BOOK-4. Точный объект: сайт → Property → Location

**Где сейчас.**
- `apps/api/src/web-booking/web-booking.service.ts:116-117` `asSite` = `withOrganizationScope(site.organizationId)`,
  без Location.
- `:568-573` `assertServingProperty` читает `repo.property()` в этом контексте и требует, чтобы
  `site.propertyId` совпал с ним; `repo.property()` в scope ORGANIZATION это **самый ранний объект организации**
  (`apps/api/src/database/property-ref.ts:124-152`, ветка `{ location: chain }`, `orderBy createdAt asc`, без проверки
  статуса).
- Расчёт и бронь тоже идут в `asSite` (`:166`, `:201`, `:224`, `:408-432`), то есть в тот же самый ранний объект;
  блокировка идемпотентности в `ReservationsService` берёт `repo.property()` так же (`reservations.service.ts:458-460`).
- Для каналов уже есть точный механизм: `withIntegrationPropertyScope(propertyId, fn)`
  (`apps/api/src/auth/request-context.ts:105-117`), им пользуются входящие брони Channex и очередь
  (`apps/api/src/channels/inbound.service.ts:258,348`, `apps/api/src/channels/outbox.worker.ts:87`); `propertyRef` по нему
  ищет объект по id и проверяет видимость (`property-ref.ts:64-74`).

**Как ломается.** Организация с гостиницами A (заведена раньше) и B. Сайт B: `bookingSite` отвечает 404 «пока не
подключено», потому что объект B не самый ранний. Если проверку просто снять, цены, доступность и бронь сайта B
пойдут в фонд гостиницы A. Архивный филиал A при этом всё равно может оказаться «самым ранним».

**Целевой инвариант.** Публичный расчёт и бронь работают строго в объекте `TrackedSite.property_id` этого сайта: тот же
объект для цены, доступности, фонда, ключа идемпотентности, письма и журнала. Цепочка объекта проверяется: объект
принадлежит организации сайта, его Location и Business в статусе `ACTIVE`, иначе честный отказ. Для управляемого сайта
MKT (позже): `MarketingSite.location_id` → `Property` этого Location → `TrackedSite.property_id` того же объекта
(триггер §29.2). Никакого выбора первого объекта организации на публичном пути.

**Красный тест.** Integration на настоящей базе: организация с двумя объектами через `createPropertyInChain`, сайт на
втором; `GET /w/availability` по ключу второго сайта отдаёт категории второго объекта (сейчас 404), `POST /w/book`
создаёт бронь в объекте второго; бронь не появляется у первого; архивный Location второго даёт отказ. Те же сценарии
для `quoteForOrganization` и `quoteForAgent` продавца (`web-booking.service.ts:174-224`), чтобы не разъехались.

**Вероятные файлы.** `apps/api/src/web-booking/web-booking.service.ts` (`asSite` через `withIntegrationPropertyScope`
плюс организация сайта, `assertServingProperty` по цепочке), возможно `apps/api/src/database/property-ref.ts` (проверка
статуса цепочки в ветке id), новый `tests/integration/web-booking-multi-property.test.ts`.

**Регрессия.** Всё из BOOK-1 и BOOK-2, плюс `tests/integration/request-scope.test.ts`, тесты каналов
(`inbound`, `outbox`), бот-котировки (`bot-quote.controller.test.ts`, `bot-booking.controller.test.ts`), живые
`tests/e2e/web-booking.spec.ts`.

**Не меняется.** Правила scope стойки (`auth/scope.ts`), поведение `organizationPropertyRef` для вошедших людей,
каналы Channex, модель данных.

## Порядок и выход

Порядок: BOOK-3 (документы и один тест) → BOOK-1 → BOOK-4 → BOOK-2 (BOOK-2 зависит от точного объекта, потому что
ключ идемпотентности уникален внутри объекта). Выход среза: четыре красных теста стали зелёными, полный unit,
integration, затронутые UI и живые e2e на свежем стенде, `release-checks` зелёный на кандидате. Затем STOP до «да»
владельца на выкладку и сверку правил туннеля на сервере.
