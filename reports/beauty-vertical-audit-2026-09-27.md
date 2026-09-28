# WETOP — аудит архитектуры AS-IS: готовность к мультивертикальности (Hospitality + Beauty)

**Дата:** 27.09.2026
**Заказчик:** владелец, по прямому запросу «провести полный аудит текущего проекта WETOP… ничего не изменять».
**Метод:** шесть параллельных read-only агентов (база данных и миграции; `packages/domain`; `apps/api`; `apps/web`; `packages/integrations` + `apps/ai-seller` + поиск хардкода Luxx; RBAC + тесты + дизайн-система) плюс собственный разбор `SPEC.md`, `DECISIONS.md` (ADR-046/055/056/060/061/079/081/083), `QUESTIONS.md` (Q-152, Q-157) и `reports/isolation-2026-09-20.md`. Код не менялся, миграции не запускались, схема не трогалась.
**Как читать:** каждое утверждение подтверждено путём в репозитории (`file:line`). Где агенты расходились с историческими ADR/отчётами (например, состояние на 20.09 vs факт на 27.09), ниже указано обоснование по актуальному коду.

---

## A. Executive Summary

1. **Монорепо, 4 приложения + 4 пакета.** `apps/web` (Next.js 16 + React 19, стойка), `apps/api` (NestJS/Express, REST), `apps/site` (Next.js, статический маркетинг), `apps/ai-seller` (Python/FastAPI, отдельный сервис). `packages/database` (Prisma), `packages/domain` (чистая бизнес-логика), `packages/integrations` (Channex/Exely/eQonaq/fiscal/mail/telegram), `packages/shared`. Границы держатся npm workspaces + ESLint-правилом (ADR-004), не сетевой изоляцией.
2. **Organization ≠ Property, но де-факто 1:1.** Схема разрешает `Organization.properties: Property[]` (1:N), но во всём коде — только `property.findFirst`, никогда `findMany`; ни один UI/API-путь не показывает список объектов организации. Сегодня «организация» и «объект» — синонимы на практике.
3. **Мультитенантность — недоделанная миграция, а не отсутствующая архитектура.** С 15.09 по 26.09.2026 (10 из 27 миграций) добавлены `organizations`, `memberships.role`, `properties.organization_id`, `platform_admins`, `organization_extensions`, per-property уникальность кода юнита. Это целенаправленный, документированный (ADR-046/055/060/061/083) переход от single-tenant к multi-tenant, который **не завершён**.
4. **Изоляции на уровне БД нет вообще.** Grep по всем 27 миграциям на `ROW LEVEL SECURITY`/`POLICY` — ноль совпадений. Вся изоляция держится на одном application-level замке (`apps/api/src/database/property-ref.ts`) и дисциплине разработчиков, а не на СУБД.
5. **Реальная брешь изоляции**: `Guest`, `GuestDocument`, `AuditLog`, `ExternalEvent`, `ChannelOutbox` не имеют `organization_id`/`property_id` вообще. Один забытый `WHERE` в будущем коде — и одна организация видит гостей/журнал другой. Подтверждено миграцией `20260925000022` (аудит стал append-only, но не org-scoped) и открытым Q-152.
6. **`LUXX_APARTS_PROPERTY` — живая хардкод-константа** (`packages/domain/src/property/index.ts:11-21`), используется как fallback-поиск объекта по имени в **~16-20 файлах** `apps/api/src` — но только на путях без вошедшего человека (сторож, синк, вебхуки, скрипты). Путь живого пользователя уже организация-скоуп (`property-ref.ts`).
7. **Поля `business_type`/`vertical` не существует ни в БД, ни в API, ни в domain.** Единственный след «какой это бизнес» — два свободнотекстовых поля (`WizardSurvey.industry`, `WizardDraft.niche`), собираемых только для настройки ИИ-продавца и ни на что не влияющих.
8. **Booking core структурно ближе к обобщённому, чем кажется.** Цепочка `Reservation → ReservationItem → Allocation → InventoryUnit` — `Allocation` фактически «ресурс забронирован на диапазон дат», но обёрнута в hotel-типизацию (`AccommodationKind`, `InventoryUnitKind`, DATE-only гранулярность, occupancy-based цена). GiST exclusion constraint (запрет пересечений) — на уровне БД и полностью generic.
9. **Resource-абстракции нет вообще.** Ноль вхождений `Resource`/`resourceId` во всём `packages/domain/src` и `packages/database`. Только конкретные `Room`/`Bed`/`RoomCategory`.
10. **Шахматка — hotel-типизированный `<table>` с generic-движком внутри.** `buildChessboard()` (`packages/domain/src/chessboard/build.ts`) — чистая функция grid+overlap, алгоритмически обобщаемая; но интерфейсы (`ChessboardUnit.kind`, `StayStatus`, OTA-поля) и весь фронтенд-компонент (`apps/web/src/app/chessboard/board-grid.tsx`, ~810 строк) — hotel-typed на каждом уровне, включая payload drag&drop.
11. **Финансовый контур — самое готовое «ядро».** `folioBalance`/`assertAllocationsMatch`/`assertRefundWithin`/`parseMoney` (`packages/domain/src/finance/finance.ts`) не имеют привязки к `Reservation` вообще. Штрафы/раннее заселение/OTA-prepayment — hospitality-policy сверху, отделимая.
12. **RBAC уже написан и протестирован, но не применён на проде.** Две роли (`OWNER`/`STAFF`), кросс-тенантный `PlatformAdmin`, расширяемый enum `OrganizationExtension` (пока один вид — `AI_SELLER`). Миграция `20260925000020` есть в репозитории, интеграционные тесты зелёные — применение на боевой БД остаётся ручным шагом владельца (`CLAUDE.md`), это не «не сделано», а «сделано, но не выложено».
13. **Дизайн-система — единственный по-настоящему reuse-ready UI-слой.** `design/tokens.json` + `apps/web/src/components/ui.tsx` — vertical-neutral. Страницы (шахматка/брони/номера/сегодня) типизированы вплотную к hotel API-контрактам.
14. **Онбординг упирается стеной для Beauty.** Регистрация собирает только `hotelName`; `AuthService.register()` безусловно создаёт `Property{timezone:'Asia/Almaty', currency:'KZT', checkInTime:'14:00', checkOutTime:'12:00'}` для КАЖДОЙ новой организации; обязательный шаг `/onboarding` немедленно требует Room/Bed/Apartment категории.
15. **Контраст: подсистема «ИИ-продавец» уже построена vertical-agnostic.** `apps/api/src/wizard`, `apps/web/src/app/create`, `apps/ai-seller`'s `providers.py` (Protocol-интерфейсы `AvailabilityProvider`/`LeadSink`) — поля `businessName`/`niche`/`botType`, ни одного упоминания room/guest. Это прямое доказательство: команда умеет строить мультивертикально, когда решает это делать. PMS-ядро строилось иначе, потому что скоуп с первого дня был «один хостел» (ADR-001).
16. **`packages/integrations` корректно изолирует vendor-код (ADR-004 выполняется).** Channex/Exely/eQonaq — чисто hospitality и не текут в `apps/web`/бизнес-логику `apps/api`. `mail`/`telegram`/`assistant`-транспорт/`fiscal`-порт уже platform-generic.
17. **Тесты — хорошая защитная сетка.** Все критичные потоки (create/move/extend reservation, availability, check-in/out, OTA webhook, org isolation) покрыты и зелёные на последнем прогоне (unit 2012/2015, integration 99/99, e2e 25/25, UI-only 387/387, 27.09.2026). Оплата — PARTIAL (нет платёжного гейтвея, только folio-бухгалтерия).
18. **Второй реальный гостиничный объект сегодня технически возможен для людей, но не готов операционно.** Ключи Channex/почты — per-install `.env`, не per-org; сайт бронирования жёстко отказывает второму объекту (`assertServingProperty`, `apps/api/src/web-booking/web-booking.service.ts:399-404`); ~16-20 файлов сервис-путей резолвят объект по имени.
19. **Открытые вопросы владельца прямо блокируют стратегию.** Q-157 (что обещает публичный сайт — заявка или регистрация) и Q-152 (доизоляция Guest/AuditLog) определяют, идёт ли WETOP по пути «одна установка = один клиент» (ADR-056) или «SaaS с разделением по организациям» (ADR-061) — сейчас в силе одновременно два противоречащих решения.
20. **Beauty-вертикаль возможна без большого рефакторинга core (accounts/finance/analytics/ai-seller), но требует нового параллельного набора модулей** (resources/masters, appointment booking, service catalog, staff calendar) — переиспользовать существующие Room/Reservation/Chessboard «как есть» не рекомендуется; они несут слишком много hotel-specific семантики (DATE-only, occupancy-pricing, housekeeping, OTA).

---

## B. Текущая архитектура (Current Architecture)

### B.1 Карта приложений

| Приложение | Технологии | Порт/домен | Назначение |
|---|---|---|---|
| `apps/web` | Next.js 16, React 19 | `app.wetop.ai`, `127.0.0.1:3000` | Стойка администратора: шахматка, брони, гости, финансы, настройки, «ИИ-продавец», «Платформа» |
| `apps/api` | NestJS + Express | контейнер `api`, `127.0.0.1:3001` | REST API для стойки, сайта, каналов, ботов |
| `apps/site` | Next.js, статика | `wetop.ai` | Публичный маркетинговый сайт |
| `apps/ai-seller` | Python, FastAPI, SQLAlchemy async, Alembic | `seller.wetop.ai`, `assistant.wetop.ai` | Один Docker-образ, два экземпляра: `seller` (продавец гостям) и `support` (техподдержка платформы) |

Фактическая схема потоков данных:

```
Web (Next.js)  ──REST──▶  API (NestJS)  ──Prisma──▶  Database (Postgres)
                              │
                              ├──▶ packages/domain   (чистая бизнес-логика, без БД/HTTP)
                              ├──▶ packages/integrations (Channex/Exely/eQonaq/fiscal/mail/telegram)
                              └──▶ apps/ai-seller (по узким service-key через внутреннюю сеть)

apps/ai-seller ──HTTP (x-wetop-service-key)──▶ GET /bot/availability, POST /w/book  (apps/api)
apps/site      ──iframe/widget──▶  apps/api /w/*  (публичный виджет бронирования)
```

Между `apps/ai-seller` и платформой нет общей БД — только узкие сервисные ключи (`docs/assistant/README.md` §5-6; `apps/README.md`). Это единственная по-настоящему «сетевая» граница в системе; всё остальное — дисциплина пакетов (ADR-002).

### B.2 Пакеты

| Пакет | Назначение | Правило |
|---|---|---|
| `packages/database` | Prisma schema, миграции | Миграции только после утверждения `DATA_MODEL.md` |
| `packages/domain` | availability, reservations, folio, pricing — «не знает про Channex/eQonaq/HTTP/Prisma» (`packages/domain/src/index.ts:1-17`) | Чистые функции |
| `packages/integrations` | Адаптеры Channex, Exely, eQonaq, fiscal, mail, telegram, assistant-транспорт | **Единственное место**, где допустим vendor SDK/vendor ID (ADR-004); проверено — соблюдается |
| `packages/shared` | Money, даты, ошибки | Money — integer minor units (ADR-008) |

### B.3 Frontend ↔ Backend

Обычный REST, не tRPC/GraphQL. Аутентификация — собственный opaque session-токен (SHA-256 хеш в `Session.tokenHash`), не JWT: cookie ставит стойка, API его только выдаёт/проверяет (`apps/api/src/auth/auth.controller.ts:49-51`). Параллельно живёт второй, более старый механизм входа по email-коду (`apps/api/src/accounts/`) — «Два способа входа живут рядом, пока владелец не выбрал (Q-146)». Машинные вызовы — заголовок `x-wetop-service-key` с несколькими именованными ключами разного объёма прав (`SERVICE_API_KEY`, `GUARD_READ_KEY`, `ASSISTANT_READ_KEY`, `SELLER_QUOTE_KEY`).

### B.4 Где бизнес-логика, где БД, где интеграции

- **Расчёты и правила** (ценообразование, статус-guards, штрафы, availability-математика, оверлап-детект) — по большей части в `packages/domain` (чистые функции без Prisma/HTTP).
- **Оркестрация и транзакции** — в `apps/api/src/*` (сервисы вызывают domain-функции, потом пишут в БД одной Prisma-транзакцией). Но `ReservationsService.create()` (`apps/api/src/reservations/reservations.service.ts:312-506`) содержит существенную hotel-операционную логику прямо в API-слое (порядок блокировки категории, авто-назначение первого свободного юнита, групповое бронирование, проверка ёмкости против OTA-паритета) — это **не** тонкий CRUD-шим, а реальные бизнес-правила вне `packages/domain`.
- **Интеграционная логика** — целиком в `packages/integrations` (клиенты Channex/Exely) плюс тонкие сервисы-обёртки в `apps/api/src/channels`.
- **БД-логика** — Prisma-репозитории в каждом модуле `apps/api/src/*/*.repository.ts`, плюс несколько raw-SQL правил прямо в миграциях (GiST-исключение на пересечение allocations — `20260909000003`; append-only триггер аудита — `20260925000022`; уникальность `(property_id, external_id)` для дедупа OTA — `20260925000022`).

### B.5 Сильно связанные части vs хорошо изолированные

**Хорошо изолированные:** `packages/integrations` (vendor-код не течёт наружу — проверено grep); дизайн-система (`design/tokens.json` + `components/ui.tsx`); `packages/domain/src/accounts` (авторизация/роли/сессии — без единого hotel-понятия); `packages/domain/src/web-analytics` (полноценный GA4-подобный движок без PMS-специфики кроме одного имени поля); ИИ-продавец wizard/onboarding.

**Сильно связанные:** весь operational core — шахматка/брони/номера/тарифы/финансы связаны напрямую через hotel-нафты (`AccommodationType`, `InventoryUnit`, `RatePlan`, `Folio`) в контроллерах, сервисах и Prisma-запросах, без единого слоя абстракции; сервис-пути (сторож, синк, вебхуки) жёстко связаны с константой `LUXX_APARTS_PROPERTY`; тенант-резолюция (guard → interceptor → `AsyncLocalStorage` → `property-ref.ts`) — единая точка, от которой зависят ~20 репозиториев (это одновременно и удачная централизация, и единая точка отказа).

---

## C. Карта базы данных (Database Map)

Единственный файл схемы: `packages/database/prisma/schema.prisma` (1356 строк), 27 миграций (`20260907000001` … `20260926000025`).

### C.1 Platform / Auth

| Таблица | Строка | Назначение | Org/Property scope |
|---|---|---|---|
| `Organization` | `schema.prisma:966` | Арендатор. `status`: TRIAL/ACTIVE/READ_ONLY/SUSPENDED, `trialEndsAt` | является корнем tenant |
| `User` | `:988` | Человек-логин | нет прямого scope; через `Membership` |
| `Membership` | `:1061` | User↔Organization, `role: OWNER\|STAFF`, составной PK `[userId, organizationId]` | `organizationId` |
| `Session` | `:1077` | Активная сессия/токен | `organizationId` (денормализован при логине) |
| `Invite` | `:1098` | Приглашение по почте | `organizationId` |
| `PasswordReset`, `EmailVerification` | `:1024`, `:1039` | Одноразовые токены | только `userId` |
| `PlatformAdmin` | `:1202` | Кросс-тенантный супер-админ, ставится только серверным скриптом | нет (platform-wide) |
| `OrganizationExtension` | `:1227` | Платное расширение (сейчас один вид — `AI_SELLER`) | `organizationId` |
| `UserError` | `:1120` | Журнал ошибок для ИИ-помощника | `userId` + `organizationId` |

### C.2 Property / Location

| Таблица | Строка | Назначение | Замечание |
|---|---|---|---|
| `Property` | `:24` | Объект размещения. Комментарий: *«В MVP одна запись (ADR-001), но все запросы фильтруются по property_id»* | `organizationId` — **nullable** FK; NULL = «ничей», не виден никому из вошедших |
| `Building` | `:65` | Здание | generic по названию |
| `Floor` | `:78` | Этаж | generic |
| `PhysicalRoom` | `:129` | Физическая комната. Комментарий: *«Бизнес-логика MVP на неё не опирается — только на InventoryUnit»* | hotel-specific (`roomNumber`, `isDorm`), сейчас рудиментарна |

### C.3 Inventory

| Таблица | Строка | Ключевые поля |
|---|---|---|
| `AccommodationType` (enum `PRIVATE_ROOM/DORM_BED/APARTMENT`) | `:93,99` | `code`, `kind`, `capacityAdults/Children`, `exelyId` |
| `InventoryUnit` (enum `ROOM/BED`) | `:146,160` | «Единица продажи = ячейка»; `propertyId` (добавлен миграцией `20260926000025`), `housekeepingStatus` |
| `HousekeepingEvent` | `:380` | Лог смены статуса уборки |
| `InventoryBlock` (enum `MAINTENANCE/MANAGEMENT/OUT_OF_ORDER/OTHER`) | `:395,404` | Блокировка диапазона дат — единственный «источник правды» недоступности; сам механизм generic |

### C.4 Guests

| Таблица | Строка | Scope |
|---|---|---|
| `Guest` | `:328` | **НЕТ organizationId/propertyId вообще.** Достижим только через `StayGuest→ReservationItem→Reservation→Property→Organization` |
| `GuestDocument` | `:357` | AES-256-GCM шифрование номера/дат документа; тоже без tenant-колонки |

### C.5 Reservations / Bookings / Stay

| Таблица | Строка | Роль |
|---|---|---|
| `Reservation` (enum `TENTATIVE\|CONFIRMED\|CHECKED_IN\|CHECKED_OUT\|CANCELLED\|NO_SHOW`) | `:214` | Шапка брони, `propertyId` |
| `ReservationItem` | `:254` | Один «room-stay» внутри брони; свой статус, свои даты, `ratePlanId` |
| `StayGuest` | `:287` | Гости на `ReservationItem` |
| `Allocation` | `:302` | Привязка `ReservationItem` к конкретному `InventoryUnit` на диапазон дат. Переселение = закрыть одну строку, открыть другую. **DB-enforced no-overlap** через PostgreSQL GiST exclusion (миграция `20260909000003`) |

### C.6 Rates

`RatePlan` (`:423`, enum штрафа `NONE/FIRST_NIGHT/FULL_STAY`), `RatePlanAccommodationType` (`:454`), `DailyRate` (`:466`, цена по дате×категории×occupancy), `Restriction` (`:484`, min/max stay, stop-sell, CTA/CTD).

### C.7 Finance

`Folio` (`:663`, 1:1 с `ReservationItem`), `Service` (`:679`), `Charge` (enum `ACCOMMODATION/SERVICE/PENALTY/ADJUSTMENT`, `:700`), `Payment` (enum метода включая `HALYK`/`KASPI`, `:724`), `PaymentAllocation` (`:747`), `Refund` (`:761`). CHECK `amount > 0` на payments/allocations/refunds — миграция `20260925000022`.

### C.8 Integrations

`ChannelMapping` (`:527`, vendor ID Channex/OTA — `propertyId`), `ExternalEvent` (`:567`, идемпотентный журнал вебхуков, **без** property/org колонки), `ChannelOutbox` (`:606`, очередь ARI, **без** property/org колонки, комментарий «не бизнес-данные»).

### C.9 Web-analytics / Web-booking

`TrackedSite` (`:803`, `propertyId`), `WebSession` (`:828`, без PII), `WebPageview` (`:863`), `WebEvent` (`:879`, allow-list событий).

### C.10 Incidents / Journal / Audit

`AuditLog` (`:507`, append-only с 20260925000022-триггером, **только `userId`, без org/property**), `SystemIncident` (`:924`, платформенный, без PII).

### C.11 AI-seller

`SellerProfile` (`:1162`, PK = `organizationId`), `SellerAgent` (`:1248`), `WizardSession/WizardDraft/WizardJob/WizardMessage/WizardSurvey/WizardEvent` (`:1265-1346`) — воронка настройки бота до регистрации; `WizardDraft.organizationId` nullable (организации ещё нет), `industry`/`niche` — свободный текст.

### C.12 Ключевые миграции (хронология, полная версия — см. отчёт агента по БД)

| Миграция | Что заложила |
|---|---|
| `20260907000001_init_inventory` | Baseline: `properties/buildings/floors/physical_rooms/accommodation_types/inventory_units` — single-property MVP с первого дня |
| `20260909000003_rates_and_overbooking_guard` | GiST exclusion на пересечение allocations — единственное по-настоящему DB-enforced бизнес-правило во всей схеме |
| `20260915000013_accounts` | `organizations/users/memberships/login_codes/sessions/invites` — Organization появляется, но **Property к ней ещё не привязан** |
| `20260920000016_property_organization` | **Ключевая миграция**: `properties.organization_id` (nullable), backfill на самую старую организацию. Комментарий: «до этой правки любой вошедший видел данные единственного объекта» |
| `20260925000020_access_extensions` | `memberships.role` (OWNER/STAFF), `platform_admins`, `organization_extensions` |
| `20260925000022_integrity_guards` | Уникальность `(property_id, external_id)` для дедупа OTA, CHECK на суммы, append-only аудит |
| `20260926000025_unit_code_per_property` | Комментарий прямо называет это **закрытием межтенантной утечки**: «раньше вошедший из чужой организации находил место Luxx по её коду» |

**Итог:** мультитенантность retrofit-нута на схему, изначально построенную под один отель, за последнюю треть истории миграций (`20260915000013` → `20260926000025`), и этот retrofit виден невооружённым глазом как патчворк (nullable `organizationId`, отсутствие org-колонки на `Guest`/`AuditLog`/`ExternalEvent`/`ChannelOutbox`, живая константа `LUXX_APARTS_PROPERTY`).

### C.13 `business_type`/`vertical` — прямой ответ

Полный grep по схеме и всем миграциям: **не существует**. Единственные совпадения — `WizardSurvey.industry` и `WizardDraft.niche`, оба свободнотекстовые, оба не влияют ни на одну модель/enum/фичу.

---

## D. Матрица модулей (Module Matrix)

Легенда Vertical: **CORE** — вертикально-независим; **HOSPITALITY** — принципиально про номера/ночи/OTA; **MIXED** — универсальное понятие и гостиничная логика перемешаны. Ready: READY / PARTIAL / NOT READY для переиспользования в Beauty без переписывания.

| Модуль (раздел UI) | Front | Back | DB | Vertical | Ready для Beauty | Проблемы |
|---|---|---|---|---|---|---|
| Сегодня (`/today`) | `apps/web/src/app/today/*` | `apps/api/src/desk`, `apps/api/src/dashboard` | `Reservation`, `Folio`, `Payment` | MIXED | PARTIAL | KPI-грид и «требует внимания» универсальны по паттерну, но данные — заезды/выезды/долги гостя; occupancy/ADR/RevPAR — чисто hotel-метрики |
| Шахматка (`/chessboard`) | `apps/web/src/app/chessboard/*` (~810 строк `board-grid.tsx`) | `apps/api/src/chessboard` | `InventoryUnit`, `Allocation`, `AccommodationType` | HOSPITALITY (generic engine внутри) | NOT READY | Нет generic timeline-примитива на фронте; `buildChessboard()` в domain алгоритмически generic, но типы (`ChessboardUnit.kind`, `StayStatus`) — hotel |
| Брони (`/reservations`) | `apps/web/src/app/reservations/*` | `apps/api/src/reservations` | `Reservation/ReservationItem/Allocation/StayGuest` | MIXED | PARTIAL | Статус-guards/source/pricing-по-диапазону обобщаемы; restrictions/occupancy/«check-in требует юнит» — нет |
| Гости (`/guests`) | `apps/web/src/app/guests` | `apps/api/src/guests` | `Guest`, `GuestDocument` | MIXED | PARTIAL | Имя/телефон/email универсальны; гражданство/документ — только для eQonaq (казахстанский закон); нет org/property-скоупа в самой таблице |
| Номерной фонд / Категории / Доступность | `apps/web/src/app/{rooms,inventory}` | `apps/api/src/inventory` | `AccommodationType/PhysicalRoom/InventoryUnit` | HOSPITALITY | NOT READY | Никакой Resource-абстракции; закрытые enum `PRIVATE_ROOM/DORM_BED/APARTMENT`, `ROOM/BED` |
| Тарифы (`/rates`) | `apps/web/src/app/rates` | `apps/api/src/rates` | `RatePlan/DailyRate/Restriction` | HOSPITALITY | NOT READY | Календарь цены по дате×категории×occupancy — не подходит для услуг с длительностью |
| Менеджер каналов / Синхронизация | `apps/web/src/app/{channel-manager,channels}` | `apps/api/src/channels` | `ChannelMapping/ExternalEvent/ChannelOutbox` | HOSPITALITY | NOT APPLICABLE | OTA/ARI — понятие, которого не существует для салонов |
| ИИ-продавец (`/ai-seller`) | `apps/web/src/app/ai-seller`, `app/create` | `apps/api/src/wizard`, `apps/api/src/ai-seller` | `SellerProfile/SellerAgent/Wizard*` | **CORE** (уже) | READY | `businessName/niche/botType` — ни одного hotel-поля; ядро уже мультивертикально |
| Аналитика сайта (`/analytics`) | `apps/web/src/app/analytics` | `apps/api/src/analytics` | `TrackedSite/WebSession/WebPageview/WebEvent` | CORE | READY | Единственная hotel-зацепка — `WebSession.reservationId` и имя события `booking_step` |
| Оплаты / Финансы (`/finance`) | `apps/web/src/app/finance` | `apps/api/src/finance` | `Folio/Charge/Payment/Refund` | MIXED (ядро CORE) | PARTIAL | `folioBalance`/`assertAllocationsMatch`/`refund` — без привязки к Reservation; штрафы/ранний заезд — hospitality policy сверху |
| Настройки гостиницы (`/hotel-settings`) | `apps/web/src/app/hotel-settings` | `apps/api/src/hotel` | `Property` | HOSPITALITY | NOT READY | Модуль называется и типизирован как «настройки гостиницы» (checkInTime/checkOutTime/BIN), а фактически это профиль организации |
| Интеграции (`/connections`) | `apps/web/src/app/connections` | `apps/api/src/channels` | — | HOSPITALITY | NOT APPLICABLE | Только Channex |
| Настройки сайта (`/analytics/setup`) | `apps/web/src/app/analytics/setup` | `apps/api/src/web-booking` | `TrackedSite` | MIXED | PARTIAL | Форма générик, но виджет бронирования — hotel-specific (categoryCode) |
| Неисправности (`/incidents`) | `apps/web/src/app/incidents` | системный сторож | `SystemIncident` | **CORE** (в основном) | READY | 16 из 20 видов инцидентов — общие ops (webhook/outbox/backup/db), только 4 — hotel/OTA |
| Журнал (`/journal`) | `apps/web/src/app/journal` | `apps/api/src/audit` | `AuditLog` | CORE (механизм) | PARTIAL | Механизм generic, но без org-scope (риск изоляции) |
| Платформа (`/platform`, только главный админ) | `apps/web/src/app/platform` | `apps/api/src/platform` | `PlatformAdmin/OrganizationExtension` | **CORE** | READY | Уже generic tenant/extension-модель |
| Регистрация / Онбординг | `apps/web/src/app/{register,onboarding,invite}` | `apps/api/src/auth`, `apps/api/src/hotel/onboarding.ts` | `Organization/Property/AccommodationType/InventoryUnit/RatePlan` | HOSPITALITY | NOT READY | `AuthService.register()` безусловно создаёт `Property`; `/onboarding` требует Room/Bed/Apartment |
| ИИ-продавец wizard (`/create`) | `apps/web/src/app/create` | `apps/api/src/wizard` | `WizardSession/WizardDraft` | **CORE** (уже) | READY | Полностью vertical-agnostic — образец для будущего Beauty-онбординга |

---

## E. Матрица сущностей (Entity Matrix)

| Сущность | Сейчас | Universal? | Hospitality-specific? | Beauty reuse | Что требуется |
|---|---|---|---|---|---|
| **Organization** | Арендатор/аккаунт (`schema.prisma:966`) | Да, полностью | Нет | Прямое | Ничего — уже generic |
| **Property** | Физический объект размещения (адрес/таймзона/currency/check-in/out) | Частично (адрес/таймзона/currency — да) | Да (checkInTime/checkOutTime) | С доработкой | Развести «объект» от «часов работы конкретной вертикали»; убрать 1:1-конфляцию с Organization |
| **User / Membership / Role** | Человек + роль в организации (`OWNER/STAFF`) | Да, полностью | Нет | Прямое | Ничего |
| **Guest** | Человек, который проживает; нет универсальной сущности «клиент» | Частично (имя/телефон/email — да) | Гражданство/документ — только для eQonaq | С доработкой (переименовать/расширить в generic Customer, оставить документ опциональным) | Добавить organization/property-scope (сейчас отсутствует вообще — риск изоляции), отделить hospitality-only поля |
| **Reservation / ReservationItem** | Коммерческая бронь + строка «room-stay» | Частично (source/status/цена/дата-диапазон — да) | Restrictions, occupancy-pricing, «check-in требует юнит» | С доработкой | Header/line-item паттерн уже подходит для Beauty (appointment = line item с service+master); нужно заменить DATE-диапазон на timestamp-диапазон |
| **Allocation** | Привязка ReservationItem к конкретному InventoryUnit на диапазон дат | Да, структурно (по сути generic resource-booking) | Только по названию/типам (`InventoryUnit`) | Прямое (после переименования типа) | Переименовать/обобщить `InventoryUnitKind` в `ResourceKind`; GiST-constraint не меняется |
| **AccommodationType (категория)** | Тип продаваемой единицы (номер/dorm/апартамент) | Нет | Да, закрытый enum | Нужен параллельный тип | Для Beauty — новый «ServiceCategory»/«Resource type» |
| **InventoryUnit (Room/Bed)** | Конкретная продаваемая ячейка | Нет | Да | Нужен параллельный тип | «Master»/«Chair»/«Cabinet» как отдельная иерархия, не расширение InventoryUnit |
| **RatePlan / DailyRate / Restriction** | Цена по дате×категории×occupancy, min/max stay, stop-sell | Нет (сам механизм — да, ценовой движок generic по идее, но модель календаря — no) | Да | Нужна отдельная модель | Beauty нужна цена по длительности услуги/мастеру, не по ночи |
| **Folio / Charge / Payment / Refund** | Счёт гостя, начисления, платежи, возвраты | Да (арифметика) | Только штрафы/раннее заселение (policy) | Прямое | Ничего в ядре; заменить hospitality-policy функции на beauty-policy (no-show fee и т.п. — тот же паттерн) |
| **ChannelMapping / ExternalEvent / ChannelOutbox** | OTA/канал-менеджер | Нет | Да, полностью | Не применимо | Остаются пустыми для Beauty-организации, не блокируют |
| **SellerProfile / SellerAgent / Wizard*** | Конфигурация ИИ-продавца | Да (persona/tone/faq) — но `_head()`-шаблон промпта хардкодит «гостям»/«размещение»/«бронирование» | Частично (в одном месте) | Почти прямое | Параметризовать `_head()` по `niche`/`botType` |
| **TrackedSite / WebSession / WebPageview / WebEvent** | Веб-аналитика виджета сайта | Да, полностью | Нет (кроме имени события `booking_step`) | Прямое | Переименовать событие |
| **AuditLog / SystemIncident / UserError** | Платформенные ops-таблицы | Да | Нет | Прямое | Добавить org-scope в AuditLog (риск изоляции, не блокер для Beauty) |
| **HousekeepingEvent / InventoryBlock** | Уборка номера / блокировка диапазона | Механизм блокировки — да; сам workflow — нет | Да (уборка) | Частично | `InventoryBlock`-паттерн (блокировка ресурса на диапазон) переиспользуем для «мастер в отпуске»; сам housekeeping-flow не нужен |

---

## F. Связанность с Luxx Aparts (Luxx Coupling)

### F.1 Классификация находок

**A. Уже хранится как configuration/database data:**
- Контакты для печатных форм (адрес/телефон/email) — перенесены в БД миграцией `20260925000021` (`apps/web/src/app/reservations/[number]/print/forms.ts:11-16`, комментарий подтверждает: «зашитые сюда контакты напечатались бы в договоре любой организации. Значения Luxx перенесены в запись миграцией 20260925000021»).
- Резолюция объекта для аутентифицированного человека — по `organizationId`, не по имени (`property-ref.ts:86-100`).
- Vendor ID Channex — в таблице `ChannelMapping`, per-property.

**B. Захардкожено, но легко вынести (изолировано в константах/файлах):**
- `LUXX_APARTS_PROPERTY` (`packages/domain/src/property/index.ts:11-21`) — единая константа `{name, legalName, address, timezone:'Asia/Almaty', currency:'KZT', checkInTime:'14:00', checkOutTime:'12:00'}`, используемая как fallback-поиск по имени в **~16-20 файлах** (полный список — `apps/api/src/{database/connection.ts, chessboard/chessboard.repository.ts, reservations/reservations.repository.ts, rates/rates.repository.ts, hotel/hotel.module.ts, hotel/reservation-directory.ts, finance/finance.repository.ts, channels/operator-access.ts, channels/channels.repository.ts, channels/integration-owner.ts, units/units.repository.ts, audit/audit.module.ts, desk/desk.repository.ts, inventory/inventory.repository.ts, inventory/inventory-editor.ts, guard/guard.adapters.ts, dashboard/dashboard.repository.ts, guests/guests.repository.ts, analytics/analytics.repository.ts}`). Это только для **service-путей без вошедшего человека** (сторож, синк, вебхуки, скрипты, диагностика `/system/connection`).
- Максимум 88 размещений в одной брони — `apps/web/src/app/reservations/actions.ts:71`, `apps/web/src/app/reservations/new/form.tsx:154`.
- Заголовок алерта сторожа называет «Luxx Aparts» буквально — `packages/domain/src/incidents/alerts.ts:111`.
- Хардкод локации для Channex `{country:'KZ', city:'Алматы'}` — `apps/api/src/channels/channels.repository.ts:215`.
- launchd-лейбл `kz.luxx.pms.web` — `apps/api/src/guard/guard.adapters.ts:50`.
- `HotelService.updateSettings()` явно **блокирует** переименование объекта, если имя равно `LUXX_APARTS_PROPERTY.name` — `apps/api/src/hotel/hotel.module.ts:150-153` («название этого объекта используют каналы продаж и сторож — его меняет поддержка WETOP»).

**C. Глубоко встроено в бизнес-логику (не просто константа — реальный код, зависящий от точного значения):**
- Хардкод смещения +5 часов (Asia/Almaty) в трёх независимых местах вместо чтения `Property.timezone`: `packages/domain/src/reservations/reservations.ts:129-134` (номер подтверждения), `packages/domain/src/incidents/alerts.ts:51-53` (`almatyHour`), `apps/api/src/guard/guard.service.ts:80,496,578,751` (границы суток для SLA/инцидентов). Салон в другой таймзоне получит неверные даты/расчёты — это уже логика, не конфиг.
- Ключи интеграций (Channex, почта) — per-install `.env`, а не per-organization хранилище (`reports/isolation-2026-09-20.md`, подтверждено `apps/api/src/channels/connection.ts:13,17,37,64`).

**D. Только тестовые данные:**
- Фикстуры `'Luxx'`/`'org-luxx'`/пароль `'luxx-stoika-2026'` в `*.test.ts` по всему `apps/api/src`, `packages/domain/src`, `packages/integrations/src` — не влияют на продакшн-путь.
- Placeholder-текст в форме настройки сайта (`apps/web/src/app/analytics/setup/forms.tsx:50`) и комментарий в `globals.css:3`.

### F.2 Прямой ответ: можно ли прямо сейчас подключить второй независимый гостиничный объект без изменения архитектуры?

**Нет.** Конкретные блокеры:

1. **Ключи интеграций на установку, не на организацию.** `CHANNEX_API_KEY`/`CHANNEX_PROPERTY_ID`, почтовый ключ, ключ шифрования ПД — читаются из `.env` процесса; вторая организация в той же установке пользовалась бы аккаунтом Channex/почты первой.
2. **Сайт-виджет явно отказывает второму объекту.** `assertServingProperty()` (`apps/api/src/web-booking/web-booking.service.ts:399-404`): «Сайт другого объекта показывал бы цены и места Luxx… такому сайту честный отказ, пока расчёт не научится нескольким объектам».
3. **~16-20 файлов сервис-путей** резолвят объект по имени `"Luxx Aparts"`, а не по организации — при появлении второго объекта фоновые джобы/вебхуки/сторож продолжат смотреть на первый.
4. **Нет Row Level Security** — при ошибке в новом коде возможна утечка между организациями (особенно через `Guest`/`AuditLog`, у которых вообще нет tenant-колонки).
5. **Хардкод таймзоны +5ч** в трёх местах — второй объект в другом городе/стране получит неверные даты и SLA.

Для аутентифицированного человека (стойка) базовая изоляция уже работает — `property-ref.ts` не даст увидеть чужой объект. Проблема — в фоновых/сервисных путях и в операционной готовности (ключи, виджет), не в самой архитектуре хранения.

---

## G. Core / Hospitality Split

### G.1 READY CORE (переиспользуемо для Beauty практически без изменений)

- `packages/domain/src/accounts/*` — регистрация, роли, сессии, инвайты, trial, extensions (`accounts/roles.ts`, `session.ts`, `invite.ts`, `trial.ts`, `extensions.ts`).
- `packages/domain/src/web-analytics/*` — полноценный аналитический движок (device/hit/metrics/retention/source).
- `packages/domain/src/finance/finance.ts` — ядерная арифметика folio/charge/payment/refund (`folioBalance`, `assertAllocationsMatch`, `assertRefundWithin`, `parseMoney`).
- `packages/domain/src/incidents/*` — 16 из 20 видов инцидентов, весь механизм policy/alert/redact.
- `apps/api/src/wizard`, `apps/web/src/app/create`, `apps/ai-seller/src/integrations/providers.py` (Protocol-интерфейсы) — уже построенный vertical-agnostic онбординг ИИ-продавца.
- `design/tokens.json` + `apps/web/src/components/ui.tsx` — дизайн-токены и UI-примитивы.
- `apps/api/src/platform/*` — Organization/Extension/PlatformAdmin модель.
- `packages/integrations/src/{mail,telegram,fiscal(порт),assistant}` — платформенные интеграции без hospitality-специфики.
- Механизм тенант-резолюции (`auth.guard.ts → author.interceptor.ts → request-context.ts → property-ref.ts`) — сам паттерн, хотя имя «property» стоит обобщить в «location».

### G.2 HOSPITALITY DOMAIN (должно остаться гостиничной логикой)

- `AccommodationType`/`InventoryUnit`/`PhysicalRoom`/`Building`/`Floor` и весь `apps/api/src/inventory`.
- `HousekeepingEvent`/`packages/domain/src/housekeeping/flow.ts` — уборка номера, нет аналога в Beauty.
- `RatePlan`/`DailyRate`/`Restriction` — календарь цены по ночам/occupancy.
- `ChannelMapping`/`ExternalEvent`/`ChannelOutbox`/весь `apps/api/src/channels`, `packages/integrations/src/{channex,exely,eqonaq}` — OTA/channel-manager/миграция-Exely/eQonaq.
- Шахматка целиком (`apps/web/src/app/chessboard`, `apps/api/src/chessboard`) как готовый UI-продукт (сам generic-движок внутри — см. G.3).
- `packages/domain/src/guests/citizenship.ts` — казахстанское требование по гражданству.
- `packages/domain/src/onboarding/plan.ts` — генератор номерного фонда и occupancy-based тарифа.

### G.3 MIXED / NEEDS SEPARATION (самое важное для планирования)

| Компонент | Почему смешан | Насколько сильно | Риск | Затронутые файлы |
|---|---|---|---|---|
| **Шахматка / `buildChessboard`** | Generic overlap-grid алгоритм обёрнут в hotel-типизированные интерфейсы (`ChessboardUnit.kind`, `StayStatus`, OTA-поля) | Средне-высоко (алгоритм отделим, интерфейсы — нет) | Средний: рефакторинг типов не трогает саму математику пересечений | `packages/domain/src/chessboard/build.ts`, `apps/web/src/app/chessboard/board-grid.tsx` |
| **Availability engine** | Типизирован полностью вокруг `accommodationTypeCode`/arrival/departure, а не `resourceId+start+end` | Средне | Низкий: рефакторинг сигнатур, не логики | `packages/domain/src/availability/{availability,category}.ts` |
| **Reservations (статус-guards + pricing)** | Универсальная механика (source/confirmationNumber/priceStay-по-диапазону) перемешана с hotel-policy (restrictions/occupancy/check-in-требует-юнит) | Средне | Средний: часть функций можно вынести «как есть», часть — заменить | `packages/domain/src/reservations/reservations.ts`, `apps/api/src/reservations/reservations.service.ts` |
| **Property / Organization** | Физический объект (адрес/таймзона/currency/часы) и арендатор (аккаунт) сегодня 1:1-слиты; `HotelSettingsPatch` называет это «настройками гостиницы» | Высоко (концептуальная путаница, а не только код) | Высокий для мультилокейшн и мультивертикальности одновременно | `packages/domain/src/property/{index,settings}.ts`, `apps/api/src/hotel/hotel.module.ts`, `AuthService.register()` |
| **AI-seller `_head()`-шаблон и `REFUSAL_REPLY`** | Ядро (`engine.py`) декларировано неприкасаемым, но содержит буквальные хардкод-строки «гостям»/«размещение»/«бронирование» | Низко (2-3 строки) | Низкий, но нарушает собственное правило проекта «core = только конфиг» | `apps/ai-seller/src/ai/seller_prompt.py:94-108`, `apps/ai-seller/src/ai/engine.py:61` |
| **Dashboard metrics** | `resolvePeriod`/`previousPeriod` — generic; ADR/RevPAR/occupancy-by-category — чисто hotel KPI | Средне | Низкий | `packages/domain/src/dashboard/metrics.ts` |
| **Web-booking request validation** | Форма (дата-диапазон/размер группы/контакты) — generic; `categoryCode` — hotel | Низко | Низкий | `packages/domain/src/web-booking/request.ts` |
| **Onboarding + Registration** | `AuthService.register()` безусловно создаёт hotel `Property`; `/onboarding`-форма типизирована на `PRIVATE_ROOM/DORM_BED/APARTMENT` | Высоко | Высокий — это первая стена, в которую упрётся любой Beauty-сигнап | `apps/api/src/auth/auth.service.ts:276-345`, `apps/api/src/hotel/onboarding.ts`, `apps/web/src/app/onboarding/*` |

---

## H. Beauty Gap Analysis

### H.1 Готовность по блокам

| Блок | Статус | Обоснование |
|---|---|---|
| Organization | **READY** | Полностью generic; уже поддерживает мультиорганизационность пользователя (composite PK Membership) |
| Locations | **PARTIALLY READY** | Property существует и несёт нужные общие поля (адрес/таймзона/currency), но 1:1 слит с Organization и типизирован как «гостиница» (checkInTime/checkOutTime) |
| Customers | **PARTIALLY READY** | `Guest` несёт универсальные поля (имя/телефон/email), но без tenant-scope и с hospitality-only полями (гражданство/документ) вплавленными в ту же таблицу |
| Employees | **NOT READY** | Нет отдельной сущности «сотрудник, доступный для записи» (Master); есть только `User`+`Membership` (доступ к системе) — bookable staff не существует |
| Resources | **NOT READY** | Нулевая generic-абстракция; только `Room`/`Bed` |
| Services | **NOT READY** | Нет сущности `Service` для продажи услуг клиенту (только `Service` = доп. услуга к проживанию, `schema.prisma:679`, привязанная к Property, а не к бронированию произвольной длительности) |
| Booking Core | **PARTIALLY READY** | `Reservation→ReservationItem→Allocation` структурно близко к generic, но DATE-only гранулярность и occupancy-модель цены не подходят для часовых слотов |
| Availability | **PARTIALLY READY** | Алгоритм (`availableUnitsForStay`) генерализуем, интерфейс — нет |
| Scheduling | **NOT READY** | Нет понятия «расписание мастера»/рабочих часов сотрудника вообще |
| Payments | **READY** (ядро) | `Folio/Charge/Payment/Refund` арифметика без hospitality-зависимости |
| Analytics | **READY** (веб-аналитика), **NOT APPLICABLE** (ADR/RevPAR/occupancy) | Веб-слой готов; операционные метрики — только hotel |
| Roles | **READY** | OWNER/STAFF уже достаточно для Beauty MVP (владелец салона / мастер как STAFF) |
| Navigation | **NOT READY** | Статический хардкод-массив, ни permissions-driven, ни vertical-driven |
| Onboarding | **NOT READY** | Единственный путь регистрации создаёт номерной фонд; нет параллельного пути «создать каталог услуг» |
| AI | **READY** (архитектура), **PARTIALLY READY** (контент) | Provider-интерфейсы generic; `knowledge/facts.py` и `_head()`-шаблон хардкодят hotel-вокабуляр |
| Website/online booking | **NOT READY** | Виджет типизирован на `categoryCode`/check-in/out; нужен параллельный виджет |
| Notifications | **READY** | `mail`/`telegram` — платформенные, без специфики |

### H.2 Что понадобится для Beauty MVP (без реализации, только gap-список)

Требуемая связка записи (Organization + Location + Customer + Employee/Master + Service + Start + End + Price + Status + Payment + Source):

| Элемент | Уже есть | Нужно добавить |
|---|---|---|
| Organization | ✅ (`Organization`) | — |
| Location (салон) | Частично (`Property`, но слит с Organization и типизирован под отель) | Развязать 1:1, обобщить поля (убрать checkInTime/checkOutTime как обязательные) |
| Customer | Частично (`Guest`) | Новая generic-сущность «Customer» или обобщение `Guest` минус гражданство/документ; добавить organization-scope |
| Employee/Master | ❌ | Новая сущность: `User`+`Membership` (доступ к системе) — это не то же самое, что «доступен для записи»; нужен параллельный `BookableResource`/`Master` со своим графиком |
| Service | Частично (`Service`, но привязан к Property/проживанию, не самостоятельная продажа) | Новая сущность каталога услуг с длительностью и ценой |
| Start/End | Частично (`ReservationItem.arrivalDate/departureDate`, DATE-only) | Нужен timestamp-based диапазон (час, не сутки) |
| Price | ✅ (паттерн `priceStay`/`DailyRate`) | Новая модель цены по услуге/мастеру, не по ночи/occupancy |
| Status | ✅ (паттерн `ReservationStatus` + status-guards) | Переиспользуем паттерн, новый enum (booked/confirmed/completed/no-show) |
| Payment | ✅ (`Folio/Charge/Payment/Refund`) | Переиспользуем ядро без изменений |
| Source | ✅ (`ReservationSource`) | Переиспользуем, убрать `OTA` |

Плюс отсутствующие целиком domain capabilities: расписание работы мастера (working hours), рабочие места (workplaces/cabinets как параллель Room/Bed), календарь записей (frontend — новый, не шахматка), онбординг каталога услуг (параллель `hotel/onboarding.ts`).

---

## I. Карта рисков (Risk Map)

### I.1 По приоритету

**P0 — мешает подключению второй организации или второй вертикали:**
- Ключи интеграций (Channex, почта, PII-шифрование) в `.env` процесса, а не per-organization хранилище.
- `Guest`/`AuditLog`/`ExternalEvent`/`ChannelOutbox` без organization/property-scope — риск межтенантной утечки при любом новом коде, который обойдёт `property-ref.ts`.
- Отсутствие Row Level Security — вся изоляция держится на дисциплине, не на СУБД.
- `AuthService.register()` безусловно создаёт hotel `Property` для каждой новой организации — нет ветвления по вертикали.
- Противоречие ADR-056 («одна установка — одна гостиница») и ADR-061/мультитенантность в коде — открытый Q-157, не позволяет объявить единую стратегию.

**P1 — создаст серьёзные проблемы при Beauty:**
- Отсутствие Resource-абстракции (только Room/Bed) — Beauty нельзя «включить конфигом», нужен параллельный набор таблиц/модулей.
- Хардкод-таймзона +5ч в трёх местах вместо `Property.timezone` — салон в другой таймзоне получит неверные расчёты.
- Шахматка — hotel-типизированный `<table>` без generic timeline-примитива на фронте.
- `/onboarding` жёстко требует Room/Bed/Apartment — нет альтернативного пути.
- Навигация — статический хардкод-массив без per-vertical конфигурации.
- Ценовой календарь (`DailyRate`/`Restriction`) — по ночам/occupancy, не подходит для длительности услуги.

**P2 — желательно исправить при дальнейшем развитии:**
- `Property`/`Organization` концептуально слиты (модуль называется «настройки гостиницы», хотя это профиль организации).
- `_head()`-шаблон промпта ИИ-продавца хардкодит hospitality-вокабуляр внутри «неприкасаемого» ядра.
- `knowledge/facts.py` в ai-seller хардкодит `kind: Literal["room","bed"]`.
- ~16-20 файлов сервис-путей резолвят объект по имени вместо организации (работает сейчас, но не масштабируется).

**P3 — косметический/архитектурный долг:**
- Тестовые фикстуры с «Luxx» повсюду (не риск, но затрудняет чтение диффов).
- `packages/domain/src/reservations/cutover-match.ts` — одноразовый Exely-миграционный хелпер, мёртвый груз после завершения миграции.
- Два параллельных механизма логина (email-код и пароль) — «пока владелец не выбрал (Q-146)».

### I.2 Риски универсализации (что нельзя просто «обобщить»)

- **`Room → Resource`**: технически `Allocation` уже похож на generic resource-booking, GiST-constraint не заботится о семантике ресурса — переименование безопасно на уровне БД. Но всё, что *вокруг* (`AccommodationType.kind`, DATE-only гранулярность, `DailyRate`/`Restriction` календарь) придётся менять реальной логикой, а не переименованием — риск задеть Channex (ARI полностью построен на room-type/rate-plan), шахматку (типы `ChessboardUnit`), availability (сигнатуры функций), pricing (occupancy-модель), Exely-сверку (историческая привязка к `accommodationTypeId`), живые бронирования (production data).
- **Итог:** обобщение возможно и безопасно только *в изоляции* от текущего hospitality-контура — то есть Beauty должен получить свой параллельный набор таблиц/типов, а не расширение существующих enum. Попытка «просто добавить значение в enum» (например, `InventoryUnitKind = ROOM|BED|CHAIR`) моментально сломает всю цепочку Channex→ARI→шахматка→availability→pricing, которая ожидает ровно эти два значения и hotel-семантику вокруг них.

---

## J. Repository Map (сводный индекс по разделам выше)

Ключевые файлы, на которые ссылается этот отчёт (полный список — в теле каждого раздела; здесь — самые важные точки для будущей работы):

- **Тенант-резолюция:** `apps/api/src/database/property-ref.ts`, `apps/api/src/auth/{auth.guard.ts,author.interceptor.ts,request-context.ts}`
- **Хардкод-константа:** `packages/domain/src/property/index.ts:11-21` (`LUXX_APARTS_PROPERTY`)
- **Регистрация/онбординг:** `apps/api/src/auth/auth.service.ts:276-345` (`register()`), `apps/api/src/hotel/onboarding.ts`, `apps/web/src/app/onboarding/onboarding-form.tsx`
- **Шахматка (движок):** `packages/domain/src/chessboard/build.ts`; **(UI):** `apps/web/src/app/chessboard/board-grid.tsx`
- **Availability:** `packages/domain/src/availability/{availability,category}.ts`
- **Reservations:** `packages/domain/src/reservations/reservations.ts`, `apps/api/src/reservations/reservations.service.ts`
- **Finance (ядро):** `packages/domain/src/finance/finance.ts`
- **RBAC:** `packages/domain/src/accounts/roles.ts`, `packages/database/prisma/schema.prisma:1055-1073` (`MembershipRole`, `Membership`), `apps/api/src/platform/admin.ts`
- **AI-seller onboarding (образец vertical-agnostic паттерна):** `apps/api/src/wizard/*`, `apps/web/src/app/create/wizard-fields.tsx`, `apps/ai-seller/src/integrations/providers.py`
- **AI-seller hospitality-коупл:** `apps/ai-seller/src/ai/seller_prompt.py:94-108` (`_head()`), `apps/ai-seller/src/ai/engine.py:61` (`REFUSAL_REPLY`), `apps/ai-seller/src/knowledge/facts.py`
- **Дизайн-система:** `design/tokens.json`, `apps/web/src/components/ui.tsx`, `DESIGN.md §8`
- **Схема БД:** `packages/database/prisma/schema.prisma` (1356 строк, все модели)
- **Тесты изоляции:** `tests/integration/organization-isolation.test.ts`, `apps/ai-seller/tests/test_orgs_isolation.py`

---

## K. Recommended Architecture

### K.1 Нужен ли общий Booking Core?

**Да, но не через расширение существующих таблиц.** `Reservation→ReservationItem→Allocation` уже несёт универсальную механику (source/confirmationNumber/pricing-по-диапазону/status-guards) вперемешку с hospitality-policy (restrictions/occupancy/check-in-требует-юнит). Рекомендация: выделить на уровне `packages/domain` тонкий слой «core booking primitives» (статус-machine, source enum, confirmation number, диапазонное прайсинг) как переиспользуемые функции — но **не трогать существующие Prisma-модели**. Для Hospitality они продолжают жить как есть (`Reservation`/`ReservationItem`/`Allocation`); для Beauty — параллельная модель (`Appointment`), которая на уровне domain-функций пользуется тем же core-слоем, но со своими Prisma-таблицами и своей DATE/timestamp-гранулярностью.

### K.2 Нужен ли общий Resource Core?

**Архитектурно — да как концепция, но не как немедленный рефакторинг.** `Allocation` структурно уже «ресурс+диапазон». Правильный путь — не переименовывать `InventoryUnit` в `Resource` (это сломает Channex/ARI/шахматку/availability/pricing/Exely-сверку, все завязанные на текущую hotel-семантику), а:
1. Оставить `InventoryUnit`/`Room`/`Bed` как специализацию Hospitality.
2. Завести отдельную generic-таблицу/интерфейс `Resource` только на уровне будущего Beauty-модуля (`Master`/`Chair`/`Cabinet`), реализующую тот же паттерн «ресурс забронирован на диапазон» (по образцу `Allocation`+GiST exclusion), но без наследования от `InventoryUnit`.
3. Если через несколько кварталов появится третья вертикаль — тогда имеет смысл вынести общий интерфейс `BookableResource`, которому оба конкретных типа (`InventoryUnit`, `Master`) соответствуют по контракту (TypeScript interface / Prisma abstract pattern), но это отдельное решение, не блокирующее запуск Beauty.

### K.3 Предлагаемая граница Core / Hospitality / Beauty

```
WETOP CORE
├── Organization, Membership, Role, PlatformAdmin, OrganizationExtension   — уже готово
├── User, Session, Invite, PasswordReset, EmailVerification               — уже готово
├── Finance ядро (Folio/Charge/Payment/Refund арифметика)                 — уже готово
├── Web-analytics (TrackedSite/WebSession/WebPageview/WebEvent)           — уже готово
├── AuditLog / SystemIncident / UserError (ops)                          — готово, но AuditLog требует org-scope
├── AI-seller онбординг-паттерн (niche/businessName/botType, Provider-интерфейсы) — образец для остальных вертикалей
├── Design tokens + UI-примитивы (Button/Table/Panel/Badge/...)          — уже готово
└── Notifications (mail/telegram)                                        — уже готово

HOSPITALITY (существующий, не трогаем)
├── AccommodationType / InventoryUnit / PhysicalRoom / Building / Floor
├── Reservation / ReservationItem / Allocation (текущая DATE-based модель)
├── RatePlan / DailyRate / Restriction
├── Housekeeping
├── Chessboard (UI + hotel-типизированные интерфейсы)
├── ChannelMapping / ExternalEvent / ChannelOutbox + Channex/Exely/eQonaq
└── Onboarding-мастер номерного фонда

BEAUTY — требуется построить
├── Location (обобщённые рабочие часы, отдельно от Property-хотел-полей)
├── Customer (обобщение Guest минус гражданство/документ, + org-scope)
├── Master / Employee bookable resource (новая сущность)
├── Service catalog (новая сущность, цена по длительности)
├── Appointment (параллель Reservation, timestamp-based, без occupancy)
├── Staff calendar (новый фронтенд-грид, не шахматка; можно переиспользовать CSS/drag-plan паттерн теста)
├── Beauty-онбординг (параллель hotel/onboarding.ts, по образцу apps/api/src/wizard)
└── Beauty-навигация (параллельная секция в lib/navigation.ts)

LUXX APARTS
└── Только организация/конфигурация/данные (Property row + связанные данные), без изменений
```

---

## L. Migration Plan (последовательность, без выполнения)

**Phase 0 — Закрыть открытые вопросы владельца, определяющие стратегию.**
- Q-157 (что обещает публичный сайт: заявка или регистрация — определяет, действует ли ADR-056 или ADR-061).
- Q-152 (доизоляция Guest/AuditLog/поиска по id).
- Что не трогаем: код. Риски: без ответа любая дальнейшая работа по мультивертикальности опирается на два взаимоисключающих решения. Тесты: нет (решенческий этап).

**Phase 1 — Закрыть P0-долг изоляции (без Beauty, чисто hardening текущей мультитенантности).**
- Вынести ключи Channex/почты/PII-шифрования из `.env` в per-organization хранилище.
- Добавить `organization_id`/`property_id` к `Guest`, `AuditLog`, `ExternalEvent`, `ChannelOutbox` (nullable, backfill на текущий единственный tenant).
- Что не трогаем: существующие бизнес-таблицы Hospitality, UI. Риски: миграция production-БД — только владелец, только после бэкапа (уже существующий регламент `DATA_MODEL.md §16.4`). Тесты: расширить `tests/integration/organization-isolation.test.ts` на новые таблицы; должны быть красными до миграции, зелёными после.

**Phase 2 — Развязать Property от Organization концептуально (без смены схемы).**
- В `packages/domain/src/property/settings.ts` и `apps/api/src/hotel/hotel.module.ts` явно разделить «профиль организации» (название/BIN/контакты) от «параметров объекта» (checkInTime/checkOutTime/таймзона), даже если физически это одна таблица — как подготовка к тому, что Beauty-организация не будет иметь check-in/check-out.
- Заменить хардкод +5ч (`reservations.ts`, `alerts.ts`, `guard.service.ts`) на чтение `Property.timezone`.
- Что не трогаем: сами таблицы. Риски: низкий — рефакторинг функций, не схемы. Тесты: существующие тесты таймзоны должны остаться зелёными плюс новый тест «объект в другой таймзоне даёт верный номер подтверждения».

**Phase 3 — Спроектировать и утвердить DATA_MODEL для Beauty-сущностей (документ, не код — по правилу AGENTS.md §1).**
- `Location`, `Customer` (или обобщение `Guest`), `Master`/bookable resource, `Service catalog`, `Appointment`.
- Явно решить: Beauty-организация создаётся как отдельный `Organization.vertical`-флаг (новое поле, которого сейчас нет) или как отдельная линейка продукта. Рекомендация: добавить `Organization.vertical: 'HOSPITALITY' | 'BEAUTY'` enum — единственное новое поле в существующей таблице, определяющее ветвление онбординга/навигации/фичей.
- Что не трогаем: Hospitality-таблицы. Риски: сам факт появления `vertical`-поля обязывает пересмотреть весь код, который сегодня безусловно создаёт `Property` при регистрации (`AuthService.register()`).

**Phase 4 — Реализовать Beauty vertical как параллельный набор модулей.**
- Новые Prisma-модели (не расширение существующих enum).
- Параллельный онбординг (по образцу `apps/api/src/wizard` — уже доказанный vertical-agnostic паттерн).
- Параллельная навигация (секция в `lib/navigation.ts`, гейтуемая `Organization.vertical`).
- Новый фронтенд-календарь (не шахматка) — переиспользовать дизайн-токены/UI-примитивы, `drag-plan`-паттерн тестирования, но не сам `board-grid.tsx`.
- Переиспользовать без изменений: Finance ядро, Web-analytics, AI-seller онбординг, Roles, Notifications.
- Тесты: полный аналог существующих Hospitality-сьютов (create/move/extend appointment, availability, org isolation) — обязательное условие «Definition of Done» по аналогии с текущим MVP (`SPEC.md`).

**Phase 5 — (опционально, только если появится третья вертикаль) Вынести общий интерфейс `BookableResource`/`Booking` как контракт, которому Hospitality и Beauty соответствуют по типу, без физического объединения таблиц.**

---

## Приложение: что аудит подтвердил из истории проекта

- `SPEC.md` изначально держал SaaS/мультитенантность/AI за скоупом MVP, но explicitly сохранил сущность `Property` «на будущее»: «база не должна содержать предположение «в мире существует только один отель»» (`SPEC.md`, раздел «Но архитектуру не делаем тупиковой»). Это решение 07.09.2026 напрямую объясняет, почему сегодняшняя схема вообще имеет отдельную `Property`, а не просто хардкодит всё в `Organization`.
- Черновой план ADR-019 («арендатор → объект (с типом вертикали) → ресурс») от 14.09.2026 был **снят владельцем** 11.09.2026 до реализации («убери пока из контекста», `plans/plan-2026-09-14-platform-model.md`) — то есть амбициозная Tenant/vertical-модель обсуждалась, но никогда не строилась; вместо неё органически выросла более простая мультитенантность через ADR-046/055/060/061.
- `reports/isolation-2026-09-20.md` (владелец: «делай как надо») зафиксировал на 20.09 три пути изоляции (А — одна установка/одна гостиница, Б — демо-стенд, В — настоящая изоляция с RLS) и рекомендовал путь А как временный; в тот же день было принято одновременно ADR-055 (регистрация открыта) и ADR-056 (одна установка — одна гостиница) — их сосуществование и есть источник открытого Q-157.
- ADR-083 (25.09.2026) закрыл вопрос ролей (`OWNER`/`STAFF`) и ввёл `OrganizationExtension` как расширяемый механизм платных опций — это единственное место в текущей архитектуре, которое уже прямо задумано как «список фич, которые можно включать/выключать по организации», и потенциально годится как модель для будущего `vertical`-переключателя.
