# Фактическая история ресторана

Held release, capture по умолчанию выключен. Production не менялся; весь owner home НЕ завершён.

## Lifecycle

`table_occupancy_sessions` хранит наблюдаемые UTC endpoints, не плановые даты. `table_occupancy_commands` хранит типизированное намерение и результат для idempotency replay. POST `/food-service/occupancy-sessions`, `/:id/closure`, `/:id/relocations` используют существующий FoodService. Прямые SEAT/MOVE/RELEASE синхронизируют связанную бронь, назначение, статус и audit в одной транзакции. Legacy create WALK_IN / status / assign hooks используют тот же lifecycle. Заказ CLOSED/оплата сами не освобождают стол. Уже сидящих гостей нельзя backfill-ить из брони.

`RESTAURANT_OCCUPANCY_CAPTURE=true` разрешён только после held migration. Ранний feature-off guard прямой команды возвращает 503 до обращения к таблицам occupancy. Пустой результат SQL-команды также возвращает 503.

## История и пагинация

GET `/food-service/occupancy-sessions?from=…&to=…&limit=…&cursor=…`: обязательные UTC from/to, непустой период максимум 31 день. Выбираются пересекающие окно сеансы. limit — строковое целое 1–500, по умолчанию 100. Сортировка и keyset по UUID `id ASC` (не хронологическая); равные timestamps и микросекунды PostgreSQL не теряются из-за округления Date. Читается limit+1, наружу только limit строк. `hasMore` и `nextCursor` обозначают продолжение; последняя страница имеет false/null. Cursor — ограниченный base64url JSON v1 с locationId, нормализованными from/to и валидным UUID after; другой период/филиал и повреждённый cursor отвергаются. Cursor не является разрешением доступа: scope определяется текущим пользователем, SQL всегда ограничен его locationId.

Это live keyset, **не snapshot**: вставки/изменения между HTTP-запросами не замораживаются. `hasMore=false` означает только исчерпание текущей выборки, НЕ достоверность всех событий. Всегда `status=PARTIAL`, `reason=CAPACITY_AND_COVERAGE_NOT_AVAILABLE`, `coverage=UNAVAILABLE`; при выключенном capture — UNAVAILABLE/CAPTURE_DISABLED. 501 никогда не выдаётся за полную историю.

## Исторический scope

Held SQL запрещает изменение location/table/reservation/order links существующих сеансов и команд. Parent triggers проверяют table→area→location, reservation/order→location, location→business и business→organization при наличии retained history. Обычные изменения имени/вместимости/статуса сохраняются. Уже существующая модель Food запрещает смену area_id стола даже внутри филиала; это правило здесь не ослабляется.

Link guard берёт SHARE-lock на business/location/area/table/reservation/order: он конфликтует и с non-key UPDATE scope, в отличие от KEY SHARE. Проверки выполняются после захвата locks. Набор проверяет реальную блокировку двух отдельных соединений: writer удерживает вставленную историю, mover меняет scope; третий observer видит `pg_blocking_pids`, после COMMIT изменение отвергается. Sleep-догадок нет.

## Проверки 16.10.2026

Только собственная локальная PostgreSQL `:55516/wetop_owner_home`, схема `pms_test`; без reset, Supabase и production. Обновлённые функции/триггеры из held migration применены локально без пересоздания данных. Production chain не менялась.

- RED scopes/pagination: `tests/runs/logs/2026-10-16T08-19-31Z-integration-a142.log`.
- GREEN integration 7/7: `tests/runs/logs/2026-10-16T08-25-19Z-integration-7c86.log` — lifecycle FoodService/Prisma, runtime wetop_app SQL success, tenant isolation, conflicts/replay, retained scope, равные timestamps/cursor, observed two-connection lock.
- GREEN unit 2/2: `tests/runs/logs/2026-10-16T08-25-24Z-unit-11ec.log`.
- Полный typecheck GREEN: `tests/runs/logs/2026-10-16T08-24-11Z-typecheck-a4da.log` (до финальной правки только интеграционного теста; production TS после него не менялся).

Все тесты через test:record, maxWorkers=1, pool=threads. Предупреждение pg concurrent query остаётся в существующем Prisma/FoodService пути; новый lock-test использует независимые clients, не concurrent query на одном client. Источник предупреждения отдельно не устранён.

## Незакрытые gates

Полный HTTP/Nest boot ещё не проверен. Runtime-role success доказан для SQL lifecycle, не для всего HTTP/FoodService. Нужны дополнительные негативные проверки order/ancestor parent guards и обратного порядка гонки (scope update первым), проверка полного HTTP с wetop_app, независимый SQL/security review. Не заявляется exhaustive race/deadlock proof.

Capacity/coverage read adapter и observed table revisions добавлены следующим ограниченным срезом: см. `restaurant-capacity-coverage.md` (точный DTO и evidence). Подтверждённого графика физической работы в существующей схеме нет; настоящий denominator/процент остаётся UNAVAILABLE/OPENING_SCHEDULE_NOT_CONFIRMED. Synthetic complete intervals проверены только в тесте, не подставляются в рабочие данные. Owner home и полноценный restaurant schedule source не завершены; выпуск запрещён до source и security/concurrency gates.
