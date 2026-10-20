# Restaurant capacity: backend и UI, 16.10.2026

## Готовность UI физического расписания

Реальный путь: существующие настройки ресторана → `/restaurant-settings` (по умолчанию `section=hours`) → «Часы работы зала». Периоды ServicePeriod теперь находятся в «Бронирования», с явной подписью, что это не физические часы. Новая постоянная навигация не добавлялась.

Форма редактирует интервалы недели, явный переход на следующий день, effective dates и закрытые физические даты с причиной. Сохранение всего филиала требует checkbox подтверждения; area-only источник отмечен как неполный и его замена явно описана. При ошибке draft не очищается, refresh/retry не запускается. Успех обновляет серверный источник, reload читает GET. Нет fallback 24h/booking periods. Есть unavailable/disabled/неподтверждённое состояние, recorded_at источника и пояснение observedAt: история до наблюдения не восстанавливается.

Typed API использует существующий authenticated scoped transport. Реальный GET возвращает массив snake_case, PUT принимает camelCase; это преобразовано явно. Server action проверяет FOOD_SERVICE selected scope, вход, property permission, readOnly и оба флага. Backend capability, permission и organization write lock не менялись. При выключенном любом capture-флаге web не вызывает новый GET/PUT. Оба флага нужно включить также для web.

Доказательства этого среза:
- RED отсутствующая форма: `2026-10-16T11-05-23Z-unit-4f24`.
- GREEN 8/8: `2026-10-16T11-09-07Z-unit-df07`, SSR формы, explicit confirmation, validation, exact payload, disabled без вызовов API, error без retry, snake_case GET reload mapping и backend parser.
- GREEN 3/3: `2026-10-16T11-09-11Z-integration-bcfc`, реальный OpeningService → materialization → owner-summary, DST, tenant isolation. Только собственная БД `127.0.0.1:55516/wetop_owner_home`, pms_test, без reset.
- `npm run typecheck:web` и адресный `npx eslint apps/web/src/app/restaurant-settings/opening* apps/web/src/app/restaurant-settings/page.tsx apps/web/src/app/food/settings-board.tsx apps/web/src/lib/opening-api.ts`: exit 0. Это не полный typecheck/lint gate.

Осталось: интерактивный браузерный save/reload, authenticated HTTP end-to-end, mobile/keyboard/axe. SSR и mocked API actions не выдаются за полный round-trip. Остальные SQL/security/concurrency/release blockers ниже сохраняются. Релиз не разрешён.


## Actual implemented path

Approved basis: DATA_MODEL §49.4 and approved plan §4/§10.3 explicitly cover RestaurantOpeningSchedule location/area, weekday, localStart/localEnd, endsNextDay, IANA timezone, effective dates, recordedAt/source revision and auditable closures. No booking-setting reinterpretation.

`PUT /food-service/opening-schedule` requires `property` permission and `food.tables` capability. Direct service also checks permission, selected FOOD_SERVICE scope and existing organization write-lock transaction. `GET` requires `reports`. Server uses selected location timezone, never client-supplied timezone/location/org. Feature is default-off: both RESTAURANT_CAPACITY_CAPTURE and RESTAURANT_OCCUPANCY_CAPTURE must equal true. PUT is full replacement and NOT retry-idempotent: repeat creates another observed revision.

Input: `{areaId?: UUID, effectiveFrom: YYYY-MM-DD, effectiveTo: YYYY-MM-DD, intervals: [{weekday: 0..6, localStart: HH:mm, localEnd: HH:mm, endsNextDay: boolean}], closures: [{day: YYYY-MM-DD, reason: string}]}`. Sunday=0. Effective dates inclusive, bounded to 366-day difference. No wildcard weekday or fallback 24h. A full-day window must be explicitly `00:00 → 00:00, endsNextDay:true`. Overnight is explicit, at most 24h. Empty weekday means no opening interval. Closures are physical full local-calendar-date closures (subtract from overnight spill too), not booking closures. Closure edits replace the version; old config/closure reasons remain recorded.

Held 116 now consists of `migration.sql` THEN `opening.sql` (same separate release; neither in live chain). opening.sql adds versioned typed configuration and replaces existing capture function, not a parallel capacity subsystem. It materializes normalized unions into existing resource_capacity_intervals atomically with active table/area snapshots and closes old revision validity at observation. Existing table/area/timezone triggers recapture; booking ServicePeriod/FoodClosedDay triggers removed as unrelated. No retrospective source reconstruction. UTC endpoints are validated by round-trip unique offset candidates: ambiguous/nonexistent local times reject with `LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS`, requiring corrected input, not guessed offset. Timezone changes invalidate confirmation until reconfirmed.

Whole-location confirmation can establish COMPLETE coverage from max(observedAt,effectiveFrom midnight) through midnight after effectiveTo. Last-day overnight spill outside that coverage is conservatively not counted. Area-scoped configuration materializes only that area but does NOT claim whole-location completeness: UNAVAILABLE/AREA_SCOPE_NOT_FULL_LOCATION. One current config per location; simultaneous independent area schedules are not yet supported.

## Existing workload DTO

FOOD_SERVICE owner-summary reads existing real occupancy sessions and materialized capacity. Basis ACTUAL_TABLE_OCCUPANCY; unit TABLE_MILLISECOND; calculationVersion restaurant-capacity-v1. Numerator/denominator are decimal integer duration strings, union per physical table, clipped to revision validity, coverage and now. Percent only for complete requested coverage and positive denominator; PARTIAL percent=null, coveredPercent describes measured portion only. Unknown earlier month never receives fabricated zero/history. Zero denominator remains UNAVAILABLE/NO_AVAILABLE_CAPACITY_OR_SCHEDULE (including confirmed closed date; detailed closure reason currently lives in schedule read, not summary). Other reasons: CAPTURE_DISABLED, HISTORY_NOT_CAPTURED, OPENING_SCHEDULE_NOT_CONFIRMED, INCOMPLETE_PERIOD_COVERAGE, AREA_SCOPE_NOT_FULL_LOCATION.

## Evidence / remaining gates

Only own PostgreSQL :55516/wetop_owner_home pms_test, no reset/.env/shared database/PII/production.

- RED missing SQL writer/DST resolver: 08-39-19Z-integration-1797.
- RED missing service/parser: 08-40-38Z-unit-c79f.
- GREEN 12 selected unit tests: 08-41-47Z-unit-22e3.
- Integration found and fixed real Prisma first-capture void-deserialization failure (08-42-27Z-integration-8879); capture result now casts to text.
- GREEN final 3 integration: 2026-10-16T08-45-39Z-integration-15fa: real OpeningService confirmation → FoodService physical seat → owner-summary month PARTIAL/percent null; full observed-window projection COMPLETE with positive real numerator; table edit preserves old denominator; closure yields no current capacity; effective coverage boundary; runtime wetop_app success and foreign-tenant read/write denial; DST gap/fold rejection. No manually inserted capacity fixture in these tests.
- Full typecheck GREEN 2026-10-16T08-44-32Z-typecheck-5ecc (current TS source).
- One additional run hit host ENOSPC, including test-journal write; it is not passing evidence. Final rerun passed without deleting/resetting anything.

Remaining release blockers: UI/settings connection implemented above; authenticated HTTP end-to-end not exercised; concurrent confirmation/catalog race suite, immutability/security review of direct runtime SQL grants, independent area aggregation, specific summary closed-day reason and full exact ratio service scenario (projection union/50% tested separately in prior unit suite). No claim owner home is finished. Release prohibited. Graph lookup capture_restaurant_capacity/foodTransaction not_built/not_found; fallback refs scope.ts, FoodService write/catalog, held 116 triggers and workload.ts inspected. No commit/push/merge/deploy.
