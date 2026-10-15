# MV1 vertical foundation, 04.10.2026

Работа разрешена владельцем: master plan принят; последним поручением разрешена параллельная работа. Использован отдельный clone от main 1909267e, ветка codex/mv1-vertical-foundation-20261004. Общий checkout, индекс, Supabase и процессы соседней сессии не изменялись. Локальная база localhost:55753 с собственным PGDATA и вымышленными данными. MV2 не начинался.

## Изменения

- BusinessVertical получает FOOD_SERVICE, без новых domain tables и backfill.
- Canonical domain contract содержит три ID; registry labels/capabilities/availability заморожен. HOSPITALITY AVAILABLE, BEAUTY/FOOD_SERVICE PILOT. Enum не включает self-service signup.
- RequestActor и LocationRef используют canonical type. integrationPropertyId Channex сохранён.
- resolveBusinessVertical читает активный Business своей организации; unknown/missing vertical не становится HOSPITALITY.
- RequiresBusinessCapability на перечисленных Hospitality controllers проверяется AuthorInterceptor после trusted scope, перед domain handler. Неверный explicit scope не делает fallback в гостиницу mixed Organization.
- Legacy запрос без scope использует существующий Property resolver и проверенную Location/Business цепочку. Дополнительная проверка цепочки стоит двух чтений при legacy запросе; выбранный scope использует уже разрешённый vertical.
- Public webhook остаётся на provider binding, не на legacy installation Property. Public routes не заявляются защищёнными этим decorator, их mapping/site binding остаётся отдельной доменной границей.
- Model/Architecture/ADR amendment и принятые продуктовые ограничения записаны в документах. Существующая Beauty implementation не переписывалась.

## Red before green

1. FOOD_SERVICE schema assertion падал на двухзначном enum, затем прошёл.
2. HTTP boundary: три теста падали на существующем AuthorInterceptor (Beauty/Food пропускались к handler, malformed scope делал fallback), после guard прошли.
3. Public provider regression красный: inherited capability пыталась найти installation Property до webhook adapter. После исключения Public route прошёл.
4. Два первых прогона контрактов не смогли импортировать ещё не существующие модули. Это не считается runtime red evidence; реальные красные assertions выше отдельно сохранены.

Логи и журнал в tests/runs коммитятся вместе с изменением.

## Database evidence

migration-rehearsal.txt: down отказался при FOOD_SERVICE business и сохранил строку; после удаления синтетической строки down возвращает два значения, up возвращает три, Business count сохраняется. Проверялось на полной мигрированной локальной базе. Prisma migrate diff показывает пустую миграцию, schema совпадает с БД.

Правило PostgreSQL: enum value, добавленное внутри transaction, нельзя использовать до commit ([PostgreSQL 16 ALTER TYPE](https://www.postgresql.org/docs/16/sql-altertype.html)). Up не использует новое значение в той же транзакции. Down блокирует businesses и не делает destructive backfill. Source production backup, validation и owner-applied migration отдельно, здесь не выполнялись.

## Security and regression

HTTP integration с реальным Prisma/RLS wetop_app проверяет mixed Organization, Hospitality allow, Beauty/Food deny, foreign/archived/invalid scope deny до handler, legacy Hospitality allow. Отдельный rls-isolation подтверждает DB boundary. Full integration проверяет остальной домен на собственной базе, результаты финальных прогонов ниже.

Первый full unit запуск на загруженном Mac: 21 падение, включая 5-second timeouts и macOS Bash locale errors в неизменённых scripts/ops. Второй с LC_ALL=C и двумя workers: остались три auto-deploy timeouts. Ни tests/unit, ни scripts/ops не изменялись (git diff подтверждает). Финальный запуск использует LC_ALL=C, maxWorkers=2 и CLI testTimeout=30000 для shell subprocess tests; assertions и repository timeout config не меняются, тесты не исключаются.

## Scope and limitations

UI не менялся, screenshots не создаются. Food routes/domain, registration selector, onboarding, Calendar/Floor Plan, deposits/POS вне среза. Общие analytics/finance/AI adapters и публичные domain guards не выдаются за завершённую multi-vertical конверсию, точное покрытие в route-coverage.md. Новые permissions/trial engines не создавались.

Production migration не применена. Обычная выкладка разрешена переданными владельцем правилами §18, но ограничения §14/15 на production migration остаются. Этот срез включает изменение enum, поэтому deployment требует отдельно согласованной миграции и release-checks. В checkout также записано более строгое правило API release от 02.10 (ADR-137/139). Release здесь не перематывается. Результат подаётся как MV1 foundation PR, не как выпуск Beauty/Food или production acceptance. Процедура миграции в migration-runbook.md.

Повторный fetch main: f48d8d15, единственный новый diff касается tests/ui/branches.spec.ts. Чувствительные request-context/schema/channels не изменены.

## Финальные результаты

Typecheck и lint прошли на итоговом коде (логи 12-25-16Z-typecheck-a300 и 12-25-16Z-lint-b700). Full integration: 312 passed, 9 existing skipped, 0 failed (12-25-16Z-integration-1904); Full unit: 3282 passed, 4 existing skipped, 0 failed (12-25-16Z-unit-d2d4). npm run test:status подтверждает оба набора на текущем коде. E2E/UI не запускались, интерфейс не менялся. Предыдущий unit запуск 12-16 прервался при остановке сессии, результата ему не приписываем. После отчёта STOP, MV2 только по отдельному подтверждению.
