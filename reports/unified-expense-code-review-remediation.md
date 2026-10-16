# Независимое ревью expense slice: состояние исправлений

Основание: `/srv/hermes/cache/delegation/subagent-summary-0-20261016_071822_826450.txt`. Обновлено 16.10.2026 отдельным sole writer; это не разрешение выпуска.

## Закрыто с runtime evidence

- Alias c → hc исправлен родителем; положительная hotel ветка и отказ неизвестной historical currency проходят.
- Runtime RLS SELECT своей/чужой организации и INSERT чужой организации под `wetop_app` проходят. UPDATE/cross-location ещё не полное покрытие.
- P1 supplier false debt: временный failclosed заменён transactional backfill всех BarSupplierPayment при INSERT/смене supplier reference документа и AFTER INSERT hook старой выплаты. Hook invoker-rights, не SECURITY DEFINER. Проверяются receipt location/amount/currency, supplier source/amount, canonical scope/currency; VOIDED история сохраняется, paid считает только COMPLETED. Старый payReceipt сериализуется location NO KEY UPDATE → receipt; исходные проверки долга/кассы сохранены. Hotel writer при включённом feature записывает snapshot только новой операции, без historical inference. CREATE API принимает валидный supplierReceiptId; новая форма выплаты не добавлена. Источник остаётся прежней кассовой строкой, категория явно выбирается.
- P1 Property relocation/link race: settlement берёт Property FOR SHARE до cash FOR UPDATE; UPDATE properties держит штатный row update lock. Location serialization у ExpenseStore и trigger заменена на FOR NO KEY UPDATE: она совместима с FK KEY SHARE переноса, в отличие от прежнего FOR UPDATE, и не вводит property→location FK inversion. Property trigger не получает location lock. Реальные два соединения: A вставляет settlement без commit; B переносит Property; pg_blocking_pids доказывает ожидание; после commit A перенос получает `linked property scope immutable`. Существующие cash inserts используют совместимый FK KEY SHARE. Полная матрица всех legacy writers не объявляется доказанной.
- Idempotency key проверяется на API обоих POST: непустой printable ASCII без пробелов, до200 символов; плохие значения400.
- Неизвестные POST ошибки теперь sanitized503, лог только константа `expense_write_unavailable`, без serialization exception/meta/message.409 только allowlist23505/23503/23514, точные известные P0001 domain messages или typed ExpenseIntentConflict. Тест принудительно подставляет outage P1001/unknown SQL42703 и known23505, проверяет коды и отсутствие SQL/DSN/PII в логах. Это fault injection, не отключение живого сервера и не HTTP e2e.

## Точные RED/GREEN

Все запуски через `npm run test:record`, threads/maxWorkers1.

- RED integration: `tests/runs/logs/2026-10-16T07-34-18Z-integration-3e3b.log` —2/10 красных: supplier INSERT ошибочно успешен; Property move не ждёт settlement.
- RED API: `tests/runs/logs/2026-10-16T07-34-20Z-unit-176d.log` —5/6 красных supplier/key; `tests/runs/logs/2026-10-16T07-36-22Z-unit-4abd.log` —4/10 красных outage/key settlements.
- GREEN final expense integration: `tests/runs/logs/2026-10-16T07-37-46Z-integration-04ac.log` —10/10.
- GREEN final API: `tests/runs/logs/2026-10-16T07-37-42Z-unit-e96d.log` —10/10.
- Lint: `tests/runs/logs/2026-10-16T07-37-48Z-lint-ebc7.log` — runner включает `eslint .`, поэтому весь репозиторий проверен; один посторонний existing blocker `tests/integration/bar-location-children.test.ts:19 no-explicit-any`. В изменённых expense файлах ошибок не выведено. Чужой файл не исправлялся.

Только собственная БД `owner_home_test@127.0.0.1:55516/wetop_owner_home`, search_path=pms_test,public. Для итерации применены точные CREATE OR REPLACE двух guard-функций из held SQL. Reset/удаление данных/production/Supabase/.env не использовались. gbrain callers+blast вернули not_built/not_found; выполнен fallback source refs.

## Открыто — до enable/release

1. P2 rollback package: down.sql НЕ реализован и isolated fresh-schema apply/down НЕ выполнен в ограниченном слоте. README честно сохраняет этот release blocker; финансовые записи не удалялись.
2. Supplier happy path реализован и проверен реальным PrismaBarRepository.payReceipt (scope resolver подменён synthetic location). Supplier payReceipt теперь принимает intent key при включённом feature; см. continuation ниже. Общий rollout остальных legacy writers не выполнен; browser e2e supplier формы ещё не доказан. Supplier-specific RLS writes, hotel supplier runtime, VOIDED-before-link и принудительная матрица обоих порядков lock требуют дополнительных тестов.
3. Reverse order move-first/link-second, матрица legacy writer locks, multi-row links, полный HTTP и UPDATE/cross-location RLS coverage ещё нужны.
4. Полные unit/e2e/release gate на итоговом коде не прогонялись. Typecheck root/API/web прошёл (2026-10-16T07-45-31Z-typecheck-ee51). Прежние owner-money/revenue файлы не изменены; их результаты принадлежат предыдущей сессии.
5. История загрузки, unified UI, сверки, currency snapshot writer rollout и historical proof остаются вне этого bounded fix.

Feature default-off; миграция остаётся в hold. Commit/push/deploy/production migration не выполнялись. Родительские dirty файлы сохранены.


## Supplier retry continuation (sole writer)

RED integration: `2026-10-16T07-49-48Z-integration-cf60` — реальный повтор payReceipt создавал второй id и уменьшал due повторно. RED caller: `2026-10-16T07-50-17Z-unit-6e36` — ключ отсутствовал в API body. GREEN integration `2026-10-16T07-52-00Z-integration-dfd6`:11/11, включая два отдельных Prisma clients, committed replay, changed amount409, missing key400, concurrent same-key, pending advisory claim409, default-off два самостоятельных платежа. GREEN unit `2026-10-16T07-52-51Z-unit-d185`:36/36 (actions/controller/methods). Typecheck запуск после правок прерван timeout100s на root tsc; итоговые API/web типы не доказаны. Добавлены минимальные sessionStorage draft keys в единственную supplier форму; browser transport-error/remount/success lifecycle не прогнан, end-to-end retry-safe НЕ объявляется. Supplier RLS/hotel/VOIDED-before-link не расширялись. Модель/held SQL не менялись; replay использует исходный audit результат по intent.result_id. gbrain not_built/not_found, fallback source search не обнаружил aliases supplier endpoint. Helper root не запускался, config disabled.

## Supplier continuation evidence

RED: 2026-10-16T07-42-43Z-integration-41cb, supplier CREATE падает на прежнем failclosed. GREEN final: 2026-10-16T07-45-28Z-integration-3f12, 10/10; API 2026-10-16T07-44-38Z-unit-5a9a, 10/10. Реальный writer платит20000 после backfill40000/100000; paid60000 и remaining40000 согласованы с legacy due. Void сохраняет две связи и paid20000. Concurrent create/pay и повтор CREATE дают один settlement; amount/currency mismatch отвергаются. Backfill не меняет cash sum. Own DB обновлена только CREATE OR REPLACE guards/new functions и тремя новыми triggers, без reset или удаления старых данных.
