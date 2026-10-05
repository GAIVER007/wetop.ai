# MV6 Food Service backend

Основание: утверждённое владельцем ТЗ MV6 от 05.10.2026. Production и release не выполняются. MV7 закрыт до отдельного разрешения.

## AS-IS и результат

База реализации: main `abe59d83693655f87c51059a8e1915196d35d07f`. BAR-FIX #244 и MV5 #242 уже вошли в main. Последующее upstream изменение №54 включает FORCE RLS для BAR. До MV6 Food имел registry, pilot signup и onboarding, но не имел собственных таблиц или API. Поиск выполнен до добавления модели.

MV6 добавляет только DiningArea, DiningTable, ServicePeriod, RestaurantReservation и TableAssignment. Используются существующие Customer/CustomerBusiness, Organization/Business/Location, RequestActor, permissions, capabilities, trial/read-only и AuditLog. Business.vertical остаётся единственным источником vertical. Hospitality, Beauty и BAR не становятся общим доменом бронирований.

Модель записана до Prisma в DATA_MODEL §28, решение в ADR-MV6. Новый модуль `apps/api/src/food-service`; доменные правила `packages/domain/src/food`. Связи и проверки принадлежности закреплены migration `20261005000055_food_service_domain`. Применённые upstream migrations не изменялись.

## Поведение

- Все запросы требуют signed-in actor, явный ACTIVE FOOD_SERVICE Business своей Organization и явный ACTIVE Location этого Business. Scope разрешает сервер из X-Wetop-Scope. Body/query не заменяют контекст. Без scope отказ до legacy Property lookup.
- Каталог поддерживает создание, частичное изменение и архивирование active=false. Parent IDs неизменяемы. Название стола уникально внутри зала. Снижение capacity ниже partySize действующих назначений отклоняется.
- DESK создаёт BOOKED с необязательным столом; WALK_IN создаёт SEATED и требует стол. ONLINE отсутствует.
- BOOKED -> CONFIRMED/SEATED/CANCELLED/NO_SHOW; CONFIRMED -> SEATED/CANCELLED/NO_SHOW; SEATED -> COMPLETED. Терминальные брони неизменяемы. Снять стол можно только у BOOKED/CONFIRMED.
- startsAt приходит с offset, хранится в UTC. endsAt вычисляется сервером из ServicePeriod.defaultDurationMinutes. Проверяется полное окно в Location.timezone, включая предыдущий день для overnight периода. Клиент не может прислать endsAt.
- Один стол, достаточная capacity, пересечение [startsAt,endsAt) запрещено для BOOKED/CONFIRMED/SEATED. Терминальное состояние освобождает занятость, assignment может остаться как история.
- Организация и Business блокируются FOR SHARE; Location FOR UPDATE сериализует мутации ресторана. Затем блокируются reservation и целевой DiningTable FOR UPDATE. Это осознанный консервативный выбор v1, не обещание высокой параллельной пропускной способности внутри одного ресторана.
- expectedStatus + expectedUpdatedAt обязательны для изменения брони, статуса и назначения. Устаревший запрос получает 409; updatedAt возрастает даже при изменениях в одну миллисекунду.
- Unique(locationId,creationKey), SHA-256 нормализованного payload. Одинаковый повтор возвращает сохранённую бронь; иной payload с тем же ключом получает 409. Проверка replay предшествует новой проверке активности каталога. CustomerBusiness, новый Customer, reservation, assignment и audit создаются атомарно.
- READ_ONLY проверяется до транзакции и после parent locks. Чтение разрешено.
- Audit содержит автора, организацию, идентификатор сущности и before/after. В каталогах сохраняется снимок, в бронях только операционные поля; notes и контакты клиента в audit не копируются.

## Endpoint matrix

Для каждой строки Business и Location обязательны, оба проверяются сервером. Capability food.floorPlan пока не используется, floor-plan endpoint/UI не создавался.

| Method | Route | Capability | Permission | Business required | Location required | READ_ONLY |
|---|---|---|---|---|---|---|
| GET | /food-service/areas | food.tables | desk | Да | Да | Читать |
| POST | /food-service/areas | food.tables | property | Да | Да | 403 |
| PATCH | /food-service/areas/:id | food.tables | property | Да | Да | 403 |
| GET | /food-service/tables | food.tables | desk | Да | Да | Читать |
| POST | /food-service/tables | food.tables | property | Да | Да | 403 |
| PATCH | /food-service/tables/:id | food.tables | property | Да | Да | 403 |
| GET | /food-service/service-periods | food.tables | desk | Да | Да | Читать |
| POST | /food-service/service-periods | food.tables | property | Да | Да | 403 |
| PATCH | /food-service/service-periods/:id | food.tables | property | Да | Да | 403 |
| GET | /food-service/customers | food.tableReservations | desk | Да | Да | Читать |
| GET | /food-service/reservations | food.tableReservations | desk | Да | Да | Читать |
| POST | /food-service/reservations | food.tableReservations | desk | Да | Да | 403 |
| PATCH | /food-service/reservations/:id | food.tableReservations | desk | Да | Да | 403 |
| POST | /food-service/reservations/:id/status | food.tableReservations | desk | Да | Да | 403 |
| PUT | /food-service/reservations/:id/table | food.tableReservations | desk | Да | Да | 403 |
| DELETE | /food-service/reservations/:id/table | food.tableReservations | desk | Да | Да | 403 |

Lists: `{items,nextCursor}`, limit 1..100 (default 100), optional cursor UUID. Каталоги и customers упорядочены по ID; sortOrder передаётся для UI. Брони упорядочены startsAt,id; date=YYYY-MM-DD обязателен и выбирает начала бронирований в локальных сутках, не все пересекающие сутки интервалы. Ответ включает Customer, nullable table с area, ServicePeriod, status/source/notes, updatedAt, nextStatuses. Клиенты показываются только ACTIVE через CustomerBusiness текущего Business. Новый клиент задаётся внутри POST reservation; отдельного customer CRUD нет.

POST reservation: заголовок Idempotency-Key, servicePeriodId, startsAt с offset, partySize, customerId XOR customer {firstName,lastName?,phone?}; optional tableId/notes/source. PATCH: expectedStatus, expectedUpdatedAt плюс startsAt/servicePeriodId/partySize/notes. PUT table: токен и tableId. DELETE table: токен в JSON body. POST status: токен и status. Неизвестные поля отклоняются.

HTTP errors: 400 input/window, 403 scope/capability/permission/READ_ONLY, 404 недоступная scoped entity, 409 stale/terminal/capacity/overlap/idempotency. Каталог не меняет уже сохранённые интервалы сам по себе; последующее изменение брони пересчитывает интервал по текущему периоду.

## Red/green и реальные проверки

- Первый доменный red: `2026-10-05T06-03-03Z-unit-38ef.log`; green 5/5: `2026-10-05T06-04-23Z-unit-35e1.log`.
- Первый backend red (нет сервиса): `2026-10-05T06-09-48Z-integration-b8e4.log`.
- Календарная дата и отсутствие Food legacy fallback: red 2 failures `2026-10-05T06-19-15Z-unit-6e9d.log`, green 8/8 `2026-10-05T06-20-05Z-unit-6b9a.log`.
- HTTP scope и audit actions: red `2026-10-05T06-19-35Z-integration-7935.log`, green 19/19 `2026-10-05T06-20-26Z-integration-a7af.log`.
- DB assignment parent immutability: red `2026-10-05T06-23-43Z-integration-4c1e.log`; green вместе с pinned functions 6/6 `2026-10-05T06-24-22Z-integration-c09c.log`.
- RLS: все пять таблиц реально заполнены в двух организациях. wetop_app видит/изменяет только свои строки, не видит/не изменяет/не удаляет чужие, не вставляет чужие; без app.org_id пусто и вставка запрещена; wetop_service видит обе цепочки.
- DB guards: чужой ServicePeriod, стол, Customer, перенос parent, Food в Beauty, невалидные capacity/weekday/partySize/end, SEATED без assignment. Populated down отказывается, данные сохраняются.
- Сервис: idempotent concurrency, конкурирующие create/reassign/move/status, assign vs move, cancel vs assign; capacity/overlap rollback, без orphan Customer/audit, CustomerBusiness visibility, архивы, READ_ONLY все 11 mutation families.
- HTTP: настоящий Nest, RoleGuard, AuthorInterceptor, controllers/services и PostgreSQL. Синтетическая только identity middleware. Создание, unassign/reassign, перенос, CONFIRMED/SEATED/COMPLETED и reload сохранённой брони; все 16 маршрутов проверены на scopes/verticals, catalog STAFF и READ_ONLY. Browser/UI в MV6 не добавлялись.

Все fixtures синтетические. Проверки выполняются в изолированном clone и localhost PostgreSQL 16, схема pms_test. Общая dev Supabase и production не используются. Параметры стабильной среды: Node 24.15.0, LC_ALL=C, unit maxWorkers=2, caffeinate; repository timeouts и assertions не ослаблялись.

Full integration финального кода: 371 PASS / 9 прежних skips, `2026-10-05T06-38-06Z-integration-d00e.log`. После сбоя первого cleanup синтетические строки точечно удалены из своей локальной pms_test; повторный full integration подтвердил отсутствие загрязнения fixtures. Assertions старого backfill теста сохранены. Проверка READ_ONLY race наблюдает фактический waiter через pg_blocking_pids перед commit родительского изменения.

## Финальная проверка

| Проверка | Результат | Evidence |
|---|---|---|
| Full unit | 3374 PASS, 4 прежних skips | [unit log](../../tests/runs/logs/2026-10-05T06-32-38Z-unit-7080.log) |
| Full integration | 371 PASS, 9 прежних skips | [integration log](../../tests/runs/logs/2026-10-05T06-38-06Z-integration-d00e.log) |
| root/API/web typecheck | PASS | [typecheck log](../../tests/runs/logs/2026-10-05T06-37-35Z-typecheck-2f6c.log) |
| lint | PASS | [lint log](../../tests/runs/logs/2026-10-05T06-37-35Z-lint-4293.log) |
| check-migrations | 61 migrations, full chain, no Prisma drift, all down snapshots OK | [migration log](check-migrations.log) |
| Populated down | Refusal, data retained | MV6 database integration test |

Новые MV6 тесты не пропущены. Прежние skips относятся к repository environment-dependent checks; их условия не менялись. Browser suite не заявляется как прогнанный на MV6, UI в этом срезе отсутствует. Полный unit после добавления карты новых routes прошёл; после этого менялась только локальная переменная integration-теста для lint, поэтому unit fingerprint сохранился, а integration прогнан полностью повторно.

Проверка diff: scope/permissions, rollback транзакций и audit, tenant paths, catalog immutability, SQL parameter binding, bounded lists, duplicate-create races. Дополнительных таблиц, roles, generic abstractions, dependencies или runtime flags нет. Ограничение v1: записи в одном Location сериализованы; прямые SQL writers обязаны соблюдать протокол блокировок API для overlap/capacity, отдельного EXCLUDE на assignment не вводилось.

Свежий origin/main повторно проверен: abe59d83, без новых коммитов относительно базы. Production, release branch и migration apply на сервере не трогались. MV6 передаётся в PR на review, merge не выполняется. MV7, Food UI, POS, деньги, аналитика, public online booking и AI tools не начинались.

Migration handoff: [migration-runbook.md](migration-runbook.md). После отчёта STOP.
