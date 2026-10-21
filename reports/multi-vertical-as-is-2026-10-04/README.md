# Multi-vertical AS-IS, 04.10.2026

Статус: статический аудит локального изменяемого checkout. Это не production acceptance. Код, миграции, тесты, production и внешние API не изменялись. В tests/runs/.locks на момент проверки замков нет. Git показывает чужие изменения в apps/, packages/, DATA_MODEL.md и DECISIONS.md. Поэтому по AGENTS §17 индекс не используется, тесты не запускаются; стабильный SHA и полнота дерева требуют повторной проверки после завершения соседней работы. Некоторые операции Git и чтения файлов задерживались; отсутствие ответа не трактуется как отсутствие файла.

## Источники и доказательства

| Источник | Подтверждённый факт |
|---|---|
| AGENTS.md §1,2,9,14,17 | План до кода; модель до schema; production migration отдельно; чужой код не трогать |
| CLAUDE.md §1,5 | Читать актуальные решения; явный список своих файлов для commit; test:record |
| ARCHITECTURE.md начало, §1,9 | ADR-104/v3 заморожен; canonical Business.vertical; Beauty отдельный домен; freeze Customer на Organization |
| DATA_MODEL.md §18 | businesses и locations уже описаны; Property.location_id NOT NULL с миграции 032 |
| DATA_MODEL.md §19 vs QUESTIONS.md Q-198 | Устаревший business_id Customer против утверждённого Organization + CustomerBusiness |
| packages/database/prisma/schema.prisma:26,44,63 | enum HOSPITALITY/BEAUTY, Business.organizationId, Location.businessId; у Location нет vertical |
| packages/database/src/property-chain.ts | createPropertyInChain ищет первый Hospitality Business и создаёт Location + Property |
| apps/api/src/auth/auth.service.ts:289 | register принимает hotelName, создаёт org/TRIAL, цепочку Property, user/OWNER до отправки verification |
| apps/api/src/auth/auth.controller.ts | POST register, email confirm/resend; лимит регистрации |
| apps/api/src/auth/request-context.ts | RequestScope и проверенные businessId/locationId/vertical уже существуют; enum продублирован union |
| apps/api/src/auth/scope.ts | resolveScope читает vertical из Business своей организации; неверный указатель даёт ORGANIZATION |
| apps/api/src/auth/role.guard.ts | Общая проверка @Access и роли; platform и service отдельно |
| apps/web/src/lib/scope-pointer.ts | wetop_scope пересылается как X-Wetop-Scope; это намерение, а не право |
| apps/web/src/components/shell/branch-switcher.tsx | Есть выбор филиала, поиск, серверное действие selectBranch |
| apps/web/src/lib/navigation.ts | Централизованный гостиничный реестр, фильтр по роли; vertical-фильтра нет в NavigationAccess |
| apps/web/src/app/register/page.tsx | /register делает redirect через publicAuthUrl, форма не живёт здесь |
| apps/site/src/components/auth-dialog.tsx | Существующий публичный auth shell, обязательная точка следующего аудита MV2 |
| apps/api/src и packages/domain/src | В просмотренных доменных каталогах Hospitality модули; Beauty/Food модулей не обнаружено |
| SECURITY.md §2,3 | PII_STORAGE и обезличивание до хранения в РК; секретные файлы агент не читает |
| DESIGN.md начало | Общие токены и компоненты; сайт имеет собственный §19 |
| TESTING.md §1-3 | test:status перед test:record, одна общая база, документы не меняют fingerprint |

Это свидетельства структуры кода, а не доказательство прохождения тестов или поведения на сервере. Полный перечень контроллеров, route coverage и актуальные production counts должны быть приложены к MV1 после освобождения дерева.

## A. REUSE

Повторно использовать auth, password hashing, email verification/resend/reset, Organization, memberships OWNER/MANAGER/STAFF, общую permission engine, trial/access, audit, RLS, платформенный кабинет, уведомления и shell. RequestActor.scope и scope resolver уже являются основой, создавать второй actor нельзя. AI framework и integration framework можно сохранять как платформенные границы, но существующие инструменты и настройки считаются Hospitality до проверки конкретного endpoint.

Общее наличие страницы /finance, /connections или /ai-agents не делает её данные универсальными. Нужны раздельные domain adapters и серверные capabilities. Organization-level сводка допускает только показатели с одинаковой семантикой и подтверждённой валютой.

## B. HOSPITALITY

Сохраняются Property, AccommodationType, InventoryUnit, PhysicalRoom, Reservation/Item/Allocation, RatePlan/DailyRate/Restriction, housekeeping, folio/charge/payment/refund, Channex, сайт и AI Seller. Существующие ID, FK, RLS и [arrival, departure) не меняются. Деньги целые minor units. Не вводятся GenericBooking/GenericResource. MV1 сохраняет текущее меню и URL гостиницы побайтно там, где это проверяют тесты; целевую перегруппировку делать отдельным UI-срезом.

## C. BEAUTY GAP

Есть canonical enum и утверждённая целевая архитектура §19, это не реализованный салон. В просмотренных каталогах отсутствуют отдельные рабочие domain modules календаря, appointments, услуг и мастеров. Нужны Customer + CustomerBusiness, Employee + EmployeeLocation, BeautyService + LocationService + EmployeeService, WorkingHours, TimeOff, Appointment; RLS, same-business constraints, overlap constraint по мастеру между всеми филиалами. Нужно привести §19 к уже закрытому Q-198. BeautyResource не вводится без потребности и review.

Не путать /staff (учётки организации) с Employee (исполнитель услуги); Employee.user_id может быть NULL. BeautyService не совпадает с гостиничной дополнительной услугой.

## D. FOOD_SERVICE GAP

Enum и целевой домен отсутствуют в проверенной canonical модели. Предложение: DiningArea, DiningTable, RestaurantReservation, ServicePeriod, TableAssignment. Customer reuse только после определения границы Food и связи с CustomerBusiness. Нужны план зала, слоты, party size, назначение стола, arrival/seated/completed/no-show, онлайн-вход, RLS, event idempotency, audit. POS/Menu/Order/Kitchen/Delivery/Inventory вне первого scope. Оплата депозита не считается выручкой ресторана автоматически.

## E. REGISTRATION

AS-IS: /register редиректит в публичный auth entry. register API использует hotelName; транзакция уже создаёт Organization, Hospitality Business, Location, Property, user и membership, затем отправляет письмо. Поэтому буквальное перенесение создания Organization после verification изменяет существующую архитектуру. Рекомендация: сохранить timing и атомарность, добавить explicit vertical в регистрационный DTO и первый Business. Для Beauty/Food создавать Location без Property; createPropertyInChain остаётся гостиничным helper. Не переименовывать его в generic helper с гостиничными defaults.

Выбор проходит redirect, auth-dialog, submit, API и email-return. Нужны тесты сохранения выбранного значения при ошибке/повторе/verification. Query лишь предвыбор, server whitelist и доступность релиза решают окончательно. До domain acceptance Beauty/Food только gated onboarding или «запускаем», без обещания календаря/зала. Предварительно выбранный vertical не становится свойством аккаунта.

## F. NAVIGATION

Точная целевая таблица в master plan. Сейчас один Hospitality registry с role-filter, BranchSwitcher и scope cookie уже есть. Gap: Business grouping/label, vertical registry, capabilities, route guards, scope-aware caches и destination при переходе с гостиничного URL в Beauty. Неизвестный API access сегодня может показывать Hospitality menu; для vertical нужен fail-closed состав модулей, не догадка HOSPITALITY.

## G. DATA MODEL

MV1: добавить только FOOD_SERVICE в BusinessVertical, без новых таблиц; убрать drift union типов через canonical contract. Beauty и Food таблицы вводятся отдельными model review. Никаких Organization.vertical/Location.vertical/subtype enum сейчас. Наличие NOT NULL vertical означает, что второй backfill HOSPITALITY для всех бизнесов недопустим: фактическое значение сохраняется.

## H. ROUTES

Shared shell /today, /management/analytics, /finance, /ai-agents, /connections; каждая страница выбирает серверный adapter. Existing Hospitality URLs сохраняются. Предлагаемые новые UI /calendar, /appointments, /customers, /employees, /services, /floor-plan, /table-reservations, /dining-areas; новые API /beauty/* и /food-service/* дают явные границы. Конкретные suffix/DTO утверждаются контрактом соответствующего среза. Публичные booking/agent endpoints и фоновые service calls должны resolve Business из доверенной связи, не из actor человека и не из query vertical.

## I. PERMISSIONS

Сохранить can(role, permission), RoleGuard, trial и RLS. Capabilities обозначают наличие модуля, permission обозначает действие пользователя. Нужны hospitality.reservations/inventory/rates/channels, beauty.appointments/customers/employees/services, food.tableReservations/floorPlan/tables. Read/write/cancel и finance actions конкретизируются вместе с domain contract; новый role template не придумывается. Видимость = released modules ∩ vertical capabilities ∩ permissions ∩ entitlements. READ_ONLY сохраняет чтение, блокирует mutation на API и worker entrypoints, а не скрывает целиком модуль.

## J. MIGRATION / PRODUCTION

Live counts не получены. Не считать записи CLAUDE текущими production данными. Перед MV1 read-only reconciliation: businesses total/by vertical, missing/invalid vertical, organizations без Business, Locations без Business, Property без Location, mismatch Property.organizationId/Business.organizationId, archives и Luxx chain. Выводить counts и technical IDs без PII. Зафиксировать baseline Hospitality counts и финансовые агрегаты до/после. Enum migration additive; PostgreSQL enum value нельзя удалить обычным DROP VALUE: down должен проверять отсутствие FOOD rows и зависимостей, пересоздавать enum со старым набором под контролируемым окном. Rollback с Food rows требует сохранения данных и остановки, не подмены на HOSPITALITY. Backup/restore rehearsal, owner production migration, deploy compatible code, SHA/images/health/user route checks.

## K. ROADMAP

MV1-MV11 и acceptance находятся в master plan. Каждый этап завершается отчётом и STOP. MV2 отдельно подтверждается после MV1. Schema expansion не означает выпуск бизнес-функций.

## L. QUESTIONS

Реальные нерешённые правила вынесены в master plan. Q-198, canonical Business.vertical, отсутствие POS и единый бренд повторно спрашивать не нужно. Новые номера QUESTIONS/ADR не резервируются на изменяемом чужой сессией документе; перенос после освобождения дерева обязателен до кода.
