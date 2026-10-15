# WETOP multi-vertical master plan, 04.10.2026

Статус на 09.10.2026: MV1–MV9 влиты в `main` (последний MV9, PR #269) и выложены вместе с `release` `ecb0d629`; MV10 открыт отдельным PR #286 (не влит, отстал от `main`, перед решением нужен прогон на свежей базе); MV11 не начат. Исходный статус: master plan принят владельцем 04.10.2026, MV1 разрешён после фиксации решений. MV2 отдельно разрешён владельцем после merge PR #238 (d91c207a), выполняется по plans/mv2-registration-2026-10-04.md. Позднейшим поручением владелец разрешил параллельный MV1 в изолированном clone с отдельной локальной БД; выполнение описано в ../reports/mv1-vertical-foundation-2026-10-04/README.md. Основание: поручение владельца из приложенного master prompt; факты: ../reports/multi-vertical-as-is-2026-10-04/README.md. Дерево содержит чужие изменения, поэтому этот документ не подтверждает стабильный SHA и production readiness.

## Решения и границы

Сохранить ADR-104/v3: Organization → Business → Location → отдельный domain. Добавить FOOD_SERVICE на Business, единственном canonical источнике. Organization может иметь несколько вертикалей; Location наследует тип через FK, без копии enum. Это расширение замороженной архитектуры, до MV1 оформить proposed amendment ARCHITECTURE/DATA_MODEL и proposed ADR в DECISIONS, затем утверждение владельца. Не трактовать план как уже принятый ADR.

Shared core сохраняется. Hospitality tables и URL сохраняются. Не вводить GenericBooking, GenericResource, отдельный auth/trial/permission engine. Registry описывает composition, не хранит бизнес-данные и не выдаёт права. Subtype и дополнительные ресурсы сейчас не вводятся.

Есть важное уже принятое решение: Customer на Organization, видимость через CustomerBusiness (Q-198). Перед Beauty привести DATA_MODEL §19 в соответствие. Finance Hospitality не превращать в универсальный ledger без отдельной модели; Food без POS не показывает revenue/average check.

## Целевые registry и access boundaries

Canonical contract без зависимостей от Prisma в UI: id, label, terminology, capability IDs, release availability. Server composition и UI composition используют эти ID; server-only tool adapters не экспортируются в browser bundle. Onboarding/navigation/Today/analytics/toolset подключаются постепенно, отсутствие реализации означает недоступность модуля, а не пустые фиктивные KPI.

resolveBusinessVertical опирается на существующий resolveScope и verified entity chain, не делает второй независимый поиск выбранного Business. Для authenticated domain route проверяется активный Business своей Organization; Location проверяется в этом Business. Unknown/missing vertical не становится HOSPITALITY по умолчанию. Organization-scope открывает агрегаты, но не location mutation. Legacy гостиничный путь разрешается только через существующую проверенную Property → Location → Business цепочку. У service/public/webhook/agent запросов свой доверенный binding и vertical check; отсутствие user не обход.

Route guard получает требуемую capability, разрешение пользователя и режим записи. Отказ cross-vertical 403, чужие/несуществующие entity IDs 404 без разглашения существования; точный совместимый response contract фиксируется в MV1. Ни browser, ни LLM не выбирают разрешённый toolset. Проверку делать до доменного чтения/изменения.

READ_ONLY общий: вычисление истечения trial сохраняется (ADR-102), новые модули пользуются существующим gate. В UI доступ на чтение сохраняется. Subscription availability и entitlement проверяются отдельно от vertical и role.

## Точная целевая навигация

Это конечная карта, не обещание готовности. В MV1 гостиничное меню не перегруппировывается. Beauty/Food ссылки появляются только после реализации и приёмки модуля.

| Группа | Hospitality, label → route | Beauty, label → proposed route | Food Service, label → proposed route |
|---|---|---|---|
| Главное | Сегодня → /today | Сегодня → /today | Сегодня → /today |
| Работа | Шахматка → /chessboard; Брони → /reservations; Гости → /guests; Номерной фонд → /inventory; Свободные места → /rooms/availability | Календарь → /calendar; Записи → /appointments; Клиенты → /customers; Сотрудники → /employees; Услуги → /services | План зала → /floor-plan; Бронирования → /table-reservations; Гости → /customers; Залы и столы → /dining-areas |
| Продажи | Тарифы → /rates; Каналы продаж → /channels; Сайт и онлайн-бронирование → /website | Онлайн-запись → /website (после реализации) | Онлайн-бронирование → /website (после реализации) |
| Управление | Деньги → /finance; Аналитика → /management/analytics; ИИ-агенты → /ai-agents; Интеграции → /connections | Те же shared URLs с Beauty adapters | Те же shared URLs с Food adapters; Деньги только после deposit model acceptance |
| Система | Настройки объекта → /hotel-settings | Настройки салона → /business-settings | Настройки ресторана → /business-settings |
| Общие служебные | Сотрудники и доступ → /staff; Журнал → /journal | Те же URLs, отделены от мастеров | Те же URLs |
| Платформа | /platform и /platform/support только platformAdmin | То же | То же |

Не добавлять акции, промокоды, кабинеты и меню ресторана автоматически. Hospitality /hotel-settings/services остаётся гостиничным каталогом, Beauty /services отдельный домен. Public /register расположен в auth entry сайта; alias стойки должен сохранять safe preselection query.

## API и routing

Существующие Hospitality controllers сохраняют адреса и получают coverage vertical guard. New API boundaries: /beauty/services, /beauty/employees, /beauty/appointments; /food-service/areas, /food-service/tables, /food-service/reservations. Shared /auth, team, platform и scope endpoints сохраняются. Контракт конкретных read/write endpoints, pagination, idempotency и ошибок выпускается перед domain slice.

Switcher расширяет существующий BranchSwitcher: Business name + vertical label + Location, server select action и wetop_scope. При смене инвалидируются все scope-dependent данные, Today, analytics, toolset и drawer. Недоступный текущей вертикали URL переводится на её рабочий экран после серверного подтверждения. Next navigation/refresh допустимы без полного document reload, если сохранение и очистка кэшей доказаны тестом. Незавершённый form draft не переносится в другой Business автоматически.

## Registration и onboarding

Сохранить текущую атомарную регистрацию и verification. Сейчас register принимает hotelName и создаёт Hospitality chain до письма; план не переносит создание сущностей после email. DTO добавить explicit vertical и нейтральное название первого бизнеса с совместимым переходом hotelName для прежнего клиента. Утвердить DTO до кода. Existing trial startsAt/endsAt не менять без решения.

Selector «Чем вы управляете?» даёт три карточки и safe query preselection. API валидирует whitelist плюс release gate; query/body enum не означает разрешение выпуска. Hospitality создаёт Property через текущий helper, Beauty/Food создают только Business/Location. Сетевые повторы не создают orphan цепочек; email resending сохраняет выбор. Актуальность имени организации и имени Business не выводить из hotelName для последующих бизнесов.

Shared onboarding shell использует vertical steps. Hospitality: формат, имя/адрес/timezone/currency, категории/единицы/тариф. Beauty: имя/Location, услуги (duration/price), Employee/services/schedule. Food: имя/Location/hours, DiningArea/tables/capacity. Domain step availability зависит от релиза. Пустые состояния вертикальные, без вызова гостиничного onboarding gate для Beauty/Food.

## Data model и миграции

MV1: enum FOOD_SERVICE, без новых сущностей и изменения FK. Миграции P1/032 повторно не исполняются. До code предложить amendment DATA_MODEL §18.1 и записать стратегию rollback. Schema.prisma, generated client и request-context union должны согласованно понимать три ID.

MV4: Customer/CustomerBusiness, Employee/EmployeeLocation, BeautyService/LocationService/EmployeeService, WorkingHours/TimeOff/Appointment. PK/FK/index/RLS/CHECK и exclusion constraint ревью отдельно; мастер не имеет перекрытия даже между филиалами. Статусы и финансовые события утверждаются перед реализацией. Платёжные поля не добавлять как float.

MV6: предложить Food раздел DATA_MODEL с DiningArea/DiningTable/RestaurantReservation/ServicePeriod/TableAssignment и решёнными правилами длительности, объединения столов и смены назначений. Пока это candidate model, не утверждённая schema. Никаких POS/Order/Menu.

## Preflight, сохранение Luxx и rollback

1. Освободить рабочее дерево; git status, tests/runs/.locks, stable SHA и актуальная ветка/remote. Не удалять чужие замки.
2. Read-only reconciliation SQL по canonical enum/цепочкам, counts без персональных данных: Businesses total/by vertical/missing/invalid; Organization без Business; Location без Business; Property без Location; cross-organization mismatch; Luxx chain. Не выдавать исторические counts за свежие.
3. Backup и проверка восстановления. Устаревшие/битые цепочки блокируют миграцию до решения, не заполняются догадкой.
4. Additive enum migration в отдельной транзакционной стратегии PostgreSQL: новый enum value может требовать commit до использования. Проверить реальную версию PG на sandbox.
5. Down: old enum replacement только при отсутствии FOOD_SERVICE rows и зависимостей, с проверкой defaults, casts и блокировок. При наличии данных остановка и data-preserving rollback plan; преобразование Food в Hospitality запрещено. Application rollback и DB rollback различаются.
6. Production migration выполняет владелец отдельно. Deploy не означает её автоматическое разрешение. После каждого согласованного code slice commit/push/deploy по docs/deploy.md; проверить deployed SHA, image IDs, health и настоящий пользовательский маршрут, затем STOP.
7. Luxx до/после: цепочка и ID неизменны, reservation/allocation/inventory counts и balances сверены, chessboard/rates/website/AI работают; внешние OTA/Channex production writes не отправляются.

## Roadmap и приёмка

Каждый MV разбивается на checkpoints размером примерно 3-5 файлов; большой MV не является одним PR. После каждой законченной части evidence, отчёт, затем owner review. Тесты только через test:record после test:status. Business rules и bugfix сначала красный тест. Полный repeat только если fingerprint/поведение изменилось.

| Срез | Зависимости и файлы | Результат и acceptance | Проверка |
|---|---|---|---|
| MV1 Vertical foundation | Утверждённые model/ADR; schema, canonical contract, auth/scope, guard | Три canonical ID; resolve из trusted chain; хотя бы один защищённый Hospitality boundary и полный endpoint coverage manifest; гостиничный UX сохранён | Red/green enum/invalid/foreign/archive/missing-scope/cross-vertical; sandbox migration/up/down; RLS под wetop_app; typecheck/lint; Hospitality regression |
| MV2 Registration selector | MV1 + отдельное «да»; site auth-dialog, auth DTO/service, chain factory, redirect | Explicit first Business vertical сохраняется; Beauty/Food без Property; auth/email/trial прежние; unavailable vertical честно gated | Три signups, invalid/tampered/query, concurrent duplicate submit, resend/confirm/reload, rollback транзакции; 1440/390 light/dark keyboard/axe |
| MV3 Onboarding shell | MV2; onboarding/gate и registry | Общие шаги + vertical extension points; Hospitality flow работает; Beauty/Food не требуют номеров | Resume/reload/skip и permissions; отсутствие fake steps; shell screenshots |
| MV4 Beauty domain | MV1/MV3 + утверждённый §19; domain/database/API | Реальная запись client/service/master/Location/time, status transition и overlap | DB overlap concurrency между филиалами, CustomerBusiness visibility, RLS, invalid links, READ_ONLY, integer money; evidence до UI |
| MV5 Beauty UI | MV4; web calendar/appointments/services/employees | Календарь и основной workflow, реальная persistence | Browser → API → DB → reload, две ширины/темы, axe, empty/errors, role deny |
| MV6 Food domain | MV1/MV3 + Food model review; domain/database/API | Table reservation и assignment/state, без POS | Capacity/time/assignment concurrency, RLS, идемпотентность, READ_ONLY; подтверждённые правила |
| MV7 Food UI | MV6; floor-plan/reservations/areas | План зала и reservation workflow | Browser persistence/reload, две темы/ширины, role deny и empty/errors |
| MV8 Vertical Today | MV5/MV7; today API/adapters, switcher | Дневные KPI и attention только из реальных данных; смена бизнеса без чужого кэша | UI numbers = API за одну дату в timezone Location; invalid route redirect; быстрые переключения и reload |
| MV9 Analytics/Finance | MV4/MV6 и financial model review | Vertical metrics раздельны; Food deposit только если внедрён, Revenue не выдуман | Reconciliation, minor units, валюты, repeat/no-show denominators, Organization mixed scope без смешения ADR/RevPAR |
| MV10 AI tools | MV4/MV6, location/agent binding | Server-selected toolset; shared UI знаний/каналов/тестов | Чужой Business/Location/tool отвергнут, LLM override невозможен, sandbox tool outputs и недоступный адаптер |
| MV11 Public launch | MV2 deep links ранее; MV5/7/8/10 production acceptance | Обновить карточки/CTA и availability status | Deep link end-to-end, keyboard/mobile, claims соответствуют реально выпущенным модулям |

MV1 checkpoints: (1) model/ADR/route manifest и failing tests; (2) enum contract/registry и sandbox migration; (3) resolver/guard с tenant/service/public cases; (4) regression и отчёт. Не добавлять selector, календарь, зал или Beauty/Food schema. Остальные domain endpoints подключаются при их появлении, но существующие Hospitality API нельзя объявить защищёнными только по одному примеру.

После MV1 STOP, отдельно подтверждается MV2. MV6 можно планировать после MV3, выполнение в одном дереве последовательно, без агентов/параллельных DB runs. MV11 deep link plumbing входит MV2, финальный маркетинговый выпуск после acceptance.

## Открытые продуктовые вопросы для QUESTIONS.md

Перенести эти вопросы в QUESTIONS.md с незанятыми номерами после окончания чужой работы. Сейчас файл не правится, чтобы не конкурировать с текущими решениями. Они не блокируют статический аудит; соответствующие domain slice блокируют.

1. Разрешать self-service создание Beauty/Food Business до их operational acceptance или пока только закрытый пилот? Это определяет release gate MV2, а не canonical enum.
2. В какой момент пустой Business считается непереключаемым: завершение onboarding или первая domain запись? Кто может менять тип и как проверять отсутствие всех данных/агентов/интеграций атомарно? До решения endpoint смены типа не выпускать.
3. Beauty: одна услуга/мастер на запись или несколько, какие буферы, длительность и переходы статуса? Как учитывать отмену и no-show при overlap? Нужны до MV4.
4. Food: длительность посадки по умолчанию/по service period, объединение столов, capacity и hold TTL, бронь без назначенного стола и приоритет walk-in? Нужны до MV6.
5. Food: на первом релизе только бронирования или также депозиты? Если депозиты, политика возврата и момент финансового признания отдельно до MV9. POS остаётся вне scope.
6. Применяется ли принятая Customer + CustomerBusiness база и к Food guests с теми же PII constraints, либо Food использует отдельную сущность? Определить до Food model review.

Не спрашивать повторно про canonical vertical, Organization multi-business, единый бренд, отсутствие POS и Q-198. Меню не получает новую permission engine; изменение default role action matrix запрашивается только при реальной необходимости доменного среза.

## Definition of Done и текущая остановка

Для этого этапа: AS-IS с source pointers, различение facts/target/unknown, A-L coverage, точная целевая карта меню, staged dependencies и acceptance, модель/rollback proposal, реальные вопросы. Документы проверены на U+2014 и наличие разделов. Runtime screenshots и passing code tests не заявляются: UI не менялся и чужая работа не завершена.

Для MV1: утверждённые amendment/ADR и свободное дерево, red/green recorded evidence, migration rehearsal, security route coverage, Hospitality regression, commit/push и согласованная выкладка с SHA/health/route evidence. Production migration и внешние writes требуют отдельного разрешения. После отчёта STOP.


## Принятые владельцем решения, 04.10.2026

Источник: прямое поручение владельца в приложенном тексте, master plan принят, начало MV1 разрешено. Эти решения заменяют открытые развилки выше. До реализации перенести согласованные model amendments в DATA_MODEL.md и ADR в DECISIONS.md после завершения чужой работы в этих файлах. Подтверждение MV1 не разрешает production migration и MV2.

1. Release availability: HOSPITALITY = AVAILABLE; BEAUTY = PILOT; FOOD_SERVICE = PILOT. Публичный self-service Beauty/Food закрыт до production acceptance. На сайте допустимы «Запускаем» и «Подключение по заявке». Canonical enum и release gate раздельны. Selector/API registration adaptation остаются MV2.
2. Смена Business.vertical только Organization Owner и только для полностью пустого Business: нет domain records, integrations, AI Agents и public booking/widget. После появления данных тип неизменяем, создаётся новый Business. Endpoint смены типа в MV1 не добавляется.
3. Beauty v1: Appointment связывает ровно одного Customer, одну BeautyService, одного Employee и одну Location. Service содержит durationMinutes, bufferBeforeMinutes, bufferAfterMinutes. Статусы: SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW. База запрещает overlap Employee между филиалами. Multi-service и multi-employee appointments вне v1. Точная семантика интервалов и transitions фиксируется перед MV4, без догадок.
4. Food v1: Customer, DiningArea, DiningTable, RestaurantReservation, TableAssignment, ServicePeriod. Бронь без стола разрешена; объединение столов запрещено; default duration из ServicePeriod; partySize <= table.capacity; walk-in поддерживается как источник/тип. Online temporary hold позже с online booking. POS, Order, Kitchen, Delivery, Warehouse, Menu вне scope.
5. Food v1 без депозитов. Deposits/Payment/Refund policy/Cancellation идут отдельным будущим срезом. Food finance tile не обещает депозиты или выручку первого релиза.
6. Food использует Customer + CustomerBusiness, отдельный RestaurantGuest не создаётся. DATA_MODEL §19 привести к Q-198 до Beauty implementation. Существующий Hospitality Guest в MV1 сохраняется; миграция его данных или замена таблицы не разрешена этим срезом.

MV1 строго: model/ADR amendment, FOOD_SERVICE enum, canonical vertical contract, registry, resolveBusinessVertical, route/capability guard foundation, migration + rollback rehearsal, security tests, Hospitality regression. Без selector, Beauty/Food tables и UI, Calendar, Floor Plan, нового onboarding и public launch. Screenshots только если UI фактически затронут. После MV1 отчёт и STOP.

Текущий blocker: git status 04.10.2026 по-прежнему показывает чужие изменения channels, request-context.ts, schema.prisma, UI и model/ADR документов. DB lock отсутствует, но это не отменяет §17. Код, tests, index, commit/push/deploy не запускаются до освобождения дерева. Принятые решения сохранены здесь, без перезаписи чужой модели.


## Исполнение MV1 в отдельном checkout

Владелец прямо разрешил параллельную работу последним поручением. Checkout /Users/urijzapojnov/wetop-mv1-20261004, ветка codex/mv1-vertical-foundation-20261004 от main 1909267e. База PostgreSQL только localhost:55753, отдельный PGDATA. Основное дерево и база соседней сессии не меняются. Impact main учтён: Beauty module уже существует, RequestActor сохраняет integrationPropertyId, Channex multi-property mapping не переписывается.


## Уточнение владельца после MV3 (2026-10-04): MV4 Acceptance & Hardening

MV3 принят и влит PR #240, merge bc9b179f. MV4 переопределён: принять и укрепить уже существующий
Beauty backend (миграции 44/45), не создавать таблицы повторно. Исполнительный план:
`plans/mv4-beauty-hardening-2026-10-04.md`; итог: `reports/mv4-beauty-hardening-2026-10-04/README.md`.

Это решение заменяет прежнее описание Beauty v1 в пункте 3 выше: сохраняются BOOKED, CONFIRMED,
DONE, NO_SHOW, CANCELLED. SCHEDULED, COMPLETED, IN_PROGRESS и buffer-поля сейчас не добавляются.
Одна запись связывает одного Customer, BeautyService, Employee и Location. CANCELLED/NO_SHOW
не удерживают слот; overlap одного Employee запрещён и между Locations. Explicit verified Business
обязателен; для филиальных операций explicit verified Location. Beauty no-scope fallback закрывается.
Production rollout отдельно; MV5 UI только после отдельного разрешения владельца.
