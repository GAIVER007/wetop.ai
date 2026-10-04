# MV4: Beauty Domain Acceptance & Hardening

2026-10-04. Основание: утверждённый владельцем scope после приёмки MV3.
MV3 PR #240 влит в main: `bc9b179f22ec97a7b6cbbdd6ba5fb4590fb11b7d`.
Перед merge повторно проверены main/base, неизменный head, MERGEABLE, отсутствие review и комментариев.
Production не обновлялся. Миграции 51 и 52 остаются отдельным rollout владельца.

## AS-IS и принятые части

| Область | Уже было в main | Результат MV4 |
|---|---|---|
| Модель | Customer, CustomerBusiness, Employee, EmployeeLocation, BeautyService, LocationService, EmployeeService, WorkingHours, TimeOff, Appointment | Таблицы, связи и enum сохранены |
| Миграции | 44: таблицы, FK, ownership triggers, RLS, EXCLUDE; 45: search_path шести функций | Проверены на локальной PostgreSQL; исходные миграции не редактировались |
| Каталог | Создание, PATCH, архив active=false; minor units, currency, duration | Принято; добавлены capabilities и transactional write gate |
| Филиальные услуги | Включение/выключение, price/duration overrides | Принято; требуется явный проверенный Location |
| Мастера | Business, active/archive, EmployeeLocation, EmployeeService | Принято; пустой EmployeeService теперь запрещает запись |
| График | Недельные интервалы, TimeOff, локальные даты и timezone, audit | Принято; явный Location для текущего schedule API |
| Клиенты | Канонический Customer на Organization, CustomerBusiness внутри транзакции создания записи | Добавлен только GET /beauty/customers с обязательным CustomerBusiness-фильтром |
| Запись | Один клиент, мастер, услуга и филиал; снимки цены; перенос; статусы | Сохранено; гонки статусов и обработка конфликта БД исправлены |
| READ_ONLY | SessionGuard защищал HTTP, прямой сервис мог писать | Проверка перед операцией и повторно внутри транзакции |

## Исправленные пробелы

- Нет fallback на первый Business или Location. Сервис требует signed-in actor и explicit Business с server-resolved BEAUTY; база повторно проверяет ACTIVE и Organization ownership.
- Неверный явный Location не превращается в Business scope. Проверяются ACTIVE и принадлежность выбранному Business.
- Beauty capability без scope отказывается до legacy Property lookup. Hospitality legacy compatibility не менялась.
- Все 18 endpoints покрыты registry capabilities и существующими permissions. Новых ролей или прав нет.
- Все 13 mutation handlers проверяют возможность записи. Внутри транзакции родительские Organization/Business/выбранный Location блокируются FOR SHARE, затем статус и контекст проверяются повторно.
- EmployeeService требуется явно. Мастер без умений не оказывает все услуги автоматически.
- Архивный Customer не получает новую запись или новую связь CustomerBusiness; повторное обращение по телефону также проверяет статус.
- PostgreSQL exclusion conflict возвращается как 409 «Мастер в это время уже занят» после rollback транзакции.
- Status и move используют conditional update по исходным status/updatedAt: устаревшее изменение отклоняется с 409, audit проигравшей транзакции не сохраняется.

## Точный контракт API

Для всех строк Business обязателен: authenticated, verified, ACTIVE, принадлежит Organization, vertical BEAUTY.
Если передан Location, он всегда проверяется, даже для Business-only чтения.
`Да` в Location означает обязательный явный verified ACTIVE Location данного Business.
Body и query не заменяют tenant context. HTTP pointer `X-Wetop-Scope` сначала разрешается AuthorInterceptor.

| Method | Route | Capability | Permission | Business | Location | READ_ONLY |
|---|---|---|---|---|---|---|
| GET | /beauty/services | beauty.services | desk | Да | Нет, optional для overrides | Читать |
| POST | /beauty/services | beauty.services | rates | Да | Нет | 403 |
| PATCH | /beauty/services/:id | beauty.services | rates | Да | Нет | 403 |
| PUT | /beauty/services/:id/location | beauty.services | rates | Да | Да | 403 |
| GET | /beauty/employees | beauty.employees | desk | Да | Нет | Читать |
| POST | /beauty/employees | beauty.employees | property | Да | Нет; если выбран, привязка создаётся | 403 |
| PATCH | /beauty/employees/:id | beauty.employees | property | Да | Нет | 403 |
| PUT | /beauty/employees/:id/services | beauty.employees | property | Да | Нет | 403 |
| GET | /beauty/customers | beauty.customers | desk | Да | Нет | Читать |
| GET | /beauty/schedule | beauty.employees | desk | Да | Да | Читать |
| PUT | /beauty/employees/:id/working-hours | beauty.employees | property | Да | Да | 403 |
| POST | /beauty/employees/:id/time-offs | beauty.employees | property | Да | Да, для timezone | 403 |
| DELETE | /beauty/employees/:id/time-offs/:timeOffId | beauty.employees | property | Да | Да, для ответа | 403 |
| PUT | /beauty/employees/:id/locations | beauty.employees | property | Да | Да, текущий schedule-контракт | 403 |
| GET | /beauty/appointments | beauty.appointments | desk | Да | Да | Читать |
| POST | /beauty/appointments | beauty.appointments | desk | Да | Да | 403 |
| PATCH | /beauty/appointments/:id | beauty.appointments | desk | Да | Да | 403 |
| POST | /beauty/appointments/:id/status | beauty.appointments | desk | Да | Да | 403 |

GET customers возвращает `{items: [{id, firstName, lastName, phone, status}]}` только по связи CustomerBusiness.
Это список текущего Business, не глобальный поиск Organization. Архивные клиенты видимы с status,
но не допускаются к новой записи. Customer mutation API в MV4 не добавлялся.
POST appointment может подтвердить существующего клиента своей Organization и атомарно добавить его
CustomerBusiness при реальном обращении в этот Business, как утверждено в модели. До этого список его не показывает.

Employee locations меняются полным списком только в пределах того же Business. Снятие филиала с будущими
записями отклоняется. TimeOff действует на мастера целиком; текущий Location нужен для timezone вычислений.
Перекрывающиеся недельные интервалы отклоняются. TimeOff не отменяет существующие записи автоматически.

Состояния сохранены: BOOKED -> CONFIRMED/DONE/NO_SHOW/CANCELLED; CONFIRMED -> DONE/NO_SHOW/CANCELLED.
DONE, NO_SHOW, CANCELLED терминальные. DONE удерживает исторический интервал, NO_SHOW/CANCELLED освобождают его.
Перенос открытой записи пересчитывает снимок цены по выбранной услуге/филиалу, как в существующем контракте.
Изменение каталога само по себе не переписывает цену уже созданной записи.

## Доказательства

Все данные вымышленные. Отдельный clone и отдельная PostgreSQL на loopback 55753, схема pms_test.
Общая Supabase и исходное чужое рабочее дерево не использовались.

Красные проверки до исправлений:
- `tests/runs/logs/2026-10-04T14-32-47Z-unit-08e4.log`: 6 отказов, implicit context и отсутствующие capabilities.
- `tests/runs/logs/2026-10-04T14-34-15Z-integration-d053.log`: 5 отказов, пустые умения, READ_ONLY, сырая ошибка overlap, гонка terminal status.
- `tests/runs/logs/2026-10-04T14-36-46Z-integration-fd18.log`: нет customer list; архивный клиент получал запись.
- `tests/runs/logs/2026-10-04T14-39-47Z-unit-7e6c.log`: Beauty без scope обращался к legacy Property.

Новый PostgreSQL acceptance: 23 теста, включая два бизнеса одной организации, два филиала, cross-tenant,
архивные scope и сущности, все мутации READ_ONLY, minor units, timezone, CustomerBusiness, audit,
реальные конкурентные транзакции, RLS всех десяти таблиц и фактический EXCLUDE/search_path.
Существующие Beauty integration сохраняют все прежние assertions; fixtures теперь явно задают
проверенный BEAUTY context и ACTIVE подписку, мастеру назначена услуга.

HTTP acceptance поднимает настоящий Nest, использует настоящие RoleGuard, AuthorInterceptor,
Beauty controllers/services и PostgreSQL. Только identity предоставлена синтетическим middleware.
Проверены все пять читающих маршрутов для Beauty, Hospitality/Food, missing/foreign scope, STAFF mutation denial.
Реальный вход, письмо, browser UI и production этим тестом не проверяются.

Полные результаты на текущем коде:

| Набор | Результат | Лог |
|---|---|---|
| Unit | 3333 passed, 4 прежних skip | `tests/runs/logs/2026-10-04T14-53-25Z-unit-2bb5.log` |
| Integration | 347 passed, 9 прежних skip | `tests/runs/logs/2026-10-04T14-44-53Z-integration-e9c9.log` |
| Typecheck root/API/web | PASS | `tests/runs/logs/2026-10-04T14-52-05Z-typecheck-9464.log` |
| Lint | PASS | `tests/runs/logs/2026-10-04T14-52-05Z-lint-0f8e.log` |

Перед PR ветка перенесена без конфликтов на main `85afbb2c` (правка Hospitality-календаря).
Beauty/schema/auth в этом upstream-коммите не менялись. Integration fingerprint остался актуальным.
Полный unit после rebase обнаружил устаревший design-slop baseline: CSS нарушений стало 10 вместо 12.
Исправлен только счётчик `space-off-scale` для board.css, порог усилен, UI не менялся.
Красный лог: `tests/runs/logs/2026-10-04T14-47-05Z-unit-3851.log`.
Перед финальной публикацией такой же baseline fix пришёл в main `ca30eb34`.
Ветка перенесена на него без изменения итогового кода; все четыре fingerprints актуальны.
Изменение baseline больше не входит в diff PR MV4.

В полном integration также прошли существующие Hospitality и MV2/MV3 regression tests.
В одном повторном unit-прогоне был `socket hang up` в существующем analytics.controller.test.ts
(`2026-10-04T14-50-17Z-unit-8885.log`). Отдельный повтор всех 13 analytics tests прошёл без изменений
(`2026-10-04T14-53-12Z-unit-cf7e.log`). Причина транспортного сбоя окончательно не установлена. Финальный полный повтор без правок кода прошёл: 3333 passed.
Новые skip, ослабление assertions и исключения из наборов не добавлялись.
Финальный diff рассмотрен по scope, tenancy, capability/permission, транзакциям и audit.
`git diff --check` для исходников и документов чистый; записанные runner logs сохраняются как raw evidence.

## Границы и передача

- Схема, Prisma, миграции 44/45/51/52 и статусы не изменены. Rollback кода не требует преобразования данных.
- Legacy Beauty-клиент без выбранного context теперь получает отказ и должен выбрать Business/Location.
- Защита RLS остаётся на уровне Organization; Business visibility обеспечивается predicates сервисов.
- Прямые SQL writers должны соблюдать eligibility: DB triggers держат ownership/overlap, а права,
  активность услуги/мастера, EmployeeService и расписание проверяются API.
- Не построены Calendar, Today, новый клиентский UI, Food domain или аналитика.
- Скриншоты не нужны для этого backend-only этапа. Полный UI E2E и production release-checks не заявлены.
- Production не обновлялся, release не перематывался. Миграции 51/52 требуют отдельного rollout владельца.
- После отчёта STOP. MV5 не начат и требует отдельного разрешения.
