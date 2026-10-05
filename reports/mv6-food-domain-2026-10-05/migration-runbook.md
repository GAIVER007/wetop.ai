# MV6 migration 55 handoff

Production apply НЕ выполнен и требует отдельного разрешения. Migration additive; нет backfill или обновления Business/Location/Beauty/Hospitality. Старая версия приложения может работать при сохранённой новой схеме. Новая версия API требует schema 55 до включения Food маршрутов.

## Preflight и backup

1. Подтвердить approved release SHA и фактическую цепочку migrations. Канонический каталог: `packages/database/prisma/migrations/20261005000055_food_service_domain`.
2. Проверить PostgreSQL version, current_schema(), applied migrations, отсутствие неучтённых schema changes. Проверить wetop_app и wetop_service, права и BYPASSRLS последней.
3. Снять полный backup через действующий secret-managed connection, проверить читаемость архива и восстановление в отдельную локальную/изолированную БД. Не писать DSN или backup с клиентскими данными в Git/логи отчёта.
4. Зафиксировать количества organizations/businesses/locations/customers/customer_businesses/properties/reservations/appointments и распределение Business.vertical. Зафиксировать отсутствие пяти новых таблиц, если migration ещё не применялась.
5. Проверить активные транзакции/блокировки и согласовать окно. Food pilot allowlists остаются отдельной server-side конфигурацией MV2; migration их не открывает.

## Apply, только после разрешения

Использовать штатный migration runner из deploy runbook с approved artifact и защищённым подключением. Не выполнять весь набор SQL вручную в случайном search_path. Не менять уже применённые migrations.

## Validation

- Пять таблиц, два enum, FK/checks, Unique(area_id,name), Unique(location_id,creation_key), PK assignment.reservation_id, индексы на месте.
- ENABLE + FORCE RLS всех пяти, policies и grants wetop_app/wetop_service. RLS registry включает те же пять таблиц.
- food_ownership_guard и food_seated_guard закреплены на фактическую схему, затем public и pg_temp. Когда current_schema() = public, public не дублируется.
- Счётчики и Business.vertical до/после не изменились; все Food таблицы пусты до первых пилотных записей.
- Hospitality/Beauty smoke: вход, чтение существующего рабочего календаря и справочников. Не отправлять OTA/eQonaq/fiscal или внешние production события.
- При отдельном разрешении на пилотные записи проверить синтетическую полную цепочку Food через API, RLS и audit; cleanup audit только штатным разрешённым механизмом. Не смешивать её с реальными гостями.

## Rollback

Application rollback: отключить Food entry points/вернуть предыдущий approved application SHA, сохранить таблицы и Food данные. Не удалять новые данные ради отката приложения.

Destructive schema rollback возможен только на подтверждённо пустых пяти Food таблицах и после backup/отключения Food writers. `down.sql` предварительно проверяет все пять таблиц и выбрасывает `Food data present: refuse destructive rollback`, если найдена хотя бы одна строка. Исполнять в одной transaction с ON_ERROR_STOP; иначе ручной SQL-клиент может продолжить после ошибки. При заполненных таблицах STOP: сохранять данные, отдельное решение владельца о восстановлении/переносе. Не обходить guard, не удалять Food rows автоматически.

## Rehearsal

Локальная PostgreSQL 16, порт 55753. `scripts/ops/check-migrations.sh` создаёт отдельные временные _mig_before/_mig_after базы, проверяет всю цепочку на пустой БД, drift Prisma и каждый down snapshot. Фактический результат: PostgreSQL 16.14, 61 migrations, full chain OK, Prisma drift отсутствует, все down snapshots OK, включая 55. Лог: [check-migrations.log](check-migrations.log).

Пополненные таблицы проверены тестом `tests/integration/mv6-food-database.test.ts`: down отказывается, существующая reservation сохраняется. Новая ещё не опубликованная migration уточнялась в ходе red/green; обе локальные схемы получили исправленный guard. Финальный full-chain rehearsal проверяет канонический файл с нуля.
