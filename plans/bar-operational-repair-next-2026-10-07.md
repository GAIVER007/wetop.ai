# BAR: три исправления и окончательная приёмка

Статус: D1/D2/D3 и матрица прав подтверждены владельцем 07.10.2026. Реализация разрешена в ранее согласованном локальном QA-контуре. C12 остаётся BLOCKED.
Поручение: продолжить три исправления, затем доказать права, read-only, полный цикл и CI.
Готовый фикс фактического REVERSED из PR279 сохраняется, повторная реализация не нужна.

## Исходное состояние

Рабочая ветка codex/bar-operational-acceptance-20261007, чистый собственный checkout,
HEAD 8b088b62d0d86cdcf86751441d7480eb34db6c07. Чужое дерево не используется.
На проверке remote main:867a3914ca065f1c452c8613adc8aa8a53c39032.
Upstream не меняет BAR/Finance, но содержит общие schema/RLS изменения и migrations62/63.
PR279 draft и конфликтует с main. Исторические результаты не заменяют прогон synced head.
Своя PostgreSQL16:127.0.0.1:55893, отдельный PGDATA. Сейчас остановлена.

Подтверждённые воспроизведения: reports/bar-operational-20261007/policy-observations.json.
Два одинаковых запроса оплаты создают две оплаты, списания дважды уменьшают склад.
Finance void расхода не меняет supplierPaid/debt BAR. При no-restock reversal
132000 minor units исключаются и из COGS, и из WRITE_OFF.

## Решения владельца

D1. Принято: постоянный ключ намерения клиента и серверный журнал BAR-операций:
Property + тип операции + ключ уникальны. Контракт охватывает supplier payment, write-off, retail sale и Folio sale. Один ключ и одинаковый нормализованный
payload возвращают исходную операцию, без нового эффекта. Иной payload даёт409.
Новая намеренная операция имеет новый ключ. Незавершённый concurrent запрос ожидает исходную транзакцию либо получает retryable503 с сохранением того же ключа; persisted processing state не вводится. Записи не истекают автоматически.
Ключ сохраняется при pending, ошибке сети, неизвестном результате и reload/relogin, в scope user + Business + Location + operation;
успешный результат либо явное начало нового намерения освобождает текущий ключ.
Payload содержит receipt/product, сумму/количество, метод и reason/note.
Хеш не заменяет сами согласованные параметры. Ключ без payload не считается
достаточной защитой. Две вкладки с одним ключом защищены сервером; независимые
намерения с разными ключами не объединяются по совпадению суммы/времени.
Нужны forward migration и новая сущность, согласовать до кода.
Старым операциям ключи не придумывать; historical duplicates не удалять автоматически.

D2. Принято: учитывать оплату поставщику только при linked cash.status=COMPLETED.
Finance void сохраняет BarSupplierPayment и audit, добавляет уникальную связанную компенсацию оплаты, переводит cash в VOIDED,
восстанавливает долг на сумму оплаты. Склад, приходы, себестоимость неизменны.
Повтор void409, повтор исходного payment key возвращает ту же уже VOIDED операцию,
не создаёт новый расход. Повторная фактическая оплата требует нового намерения/ключа.
Все BAR readers (приходы, paid/due, suppliers/report) считают сумму одинаково.
Предложенный пример: paid60000/debt220000 -> void -> paid0/debt280000;
касса увеличивается на60000, товарные остатки не меняются.
Связанный Finance путь сохраняет refunds, права не расширяются.
Race pay/void сериализуется по receipt, затем cash, с одинаковым порядком locks.

D3. Принято: отдельный показатель nonRestockedLossMinor, равный сохранённой
FIFO-себестоимости REVERSED продаж с restock=false; уникальная связанная запись BarCostLoss создаётся в транзакции отмены. Не создавать второе складское
списание. COGS и grossProfit относятся только к POSTED продажам; WRITE_OFF сохраняет
значение обычных списаний. В UI отдельная явная строка убытка, её нельзя выдавать за0.
Для C10: revenue0/COGS0/grossProfit0/WRITE_OFF0, loss132000, stock148000.
Не вводить netProfit до отдельного определения всех его составляющих.
Альтернатива: включить132000 в денежный показатель списаний (без повторного движения
склада). Тогда меняется смысл WRITE_OFF и требуется согласованный новый контракт.
Нужен устойчивый признак restock для новых reversals. Предлагается nullable поле
BarSale.reversalRestocked, сохраняемое в той же транзакции. Для старых продаж отдельно
оценить однозначность SALE_RETURN evidence; сомнительные строки не считать restock=false
молча. Backfill и его доказательство входят в migration runbook.

D4. Принято: OWNER/MANAGER могут BAR reverse и Finance void через refunds;
STAFF может читать, проводить приход, оплачивать поставщика, продавать, списывать и
инвентаризировать через существующий desk, но не reverse/Finance void и не settings.
READ_ONLY является статусом организации, не новой ролью: чтение допустимо, все BAR
mutations запрещены реальным SessionGuard. Внешние права не расширяются.
Если STAFF должен отменять продажи, требуется отдельное явное решение.
Paid/closed Folio reversal остаётся незакрытым финансовым вопросом C12; его нельзя
считать принятым за счёт согласования этих трёх исправлений.

## Этапы после согласования

1. Синхронизировать собственную ветку PR279 с повторно fetched origin/main.
   Вручную свести root docs и test journals, сохранить upstream schema/RLS и BAR55-57.
   Ещё раз перечитать AGENTS, DATA_MODEL, DECISIONS, SECURITY и migration directory.
   Следующий номер сейчас кандидат64, до создания заново проверить; старые SQL не менять.
2. Зафиксировать D1-D4 как accepted в DATA_MODEL/DECISIONS. После этого schema/migration.
   Согласовать точный contract replay/void/loss, сохранить миграцию backup/validation/down.
3. RED: lost response after commit, same key/same payload, same key/different payload,
   simultaneous same key, new key, reload, tenant isolation; payment/write-off по два
   HTTP запроса создают один эффект. Проверка после server restart, не только памяти процесса.
4. Реализовать transaction-backed replay. Запись ключа и ledger effects атомарны;
   unique conflict/serialization превращается в replay/conflict, а не500.
   Ошибка/rollback не оставляет успешный ключ без эффекта. FORCE RLS, app/service guards,
   immutable Property; новые functions с pinned current_schema(),public,pg_temp,
   без SECURITY DEFINER. Изоляция проверяется и под service BYPASSRLS.
5. RED -> GREEN debt after actual Finance void; pay/void race и overpayment.
   Audit и исходные строки сохраняются, no purge и no automatic historical cleanup.
6. RED -> GREEN loss: restock true даёт loss0 и возврат склада, false loss132000,
   repeat reverse не меняет метрики, mixed ordinary write-off не удваивает FIFO cost.
   Paid/closed Folio variants только после решения C12.
7. Реальные SessionGuard/AuthService identities OWNER/MANAGER/STAFF и READ_ONLY org.
   Проверить каждый read/mutation, refunds/settings, обход direct API и server actions,
   no partial effects после403. Подмена RoleGuard/SessionGuard не доказательство прав.
8. Полный синтетический C01-C16 через реальные API/PostgreSQL; критический путь в
   браузере с reload, persistent intent replay, screenshots и accounting reconciliation.
   Fixture cleanup только собственных строк; audit сохраняется.
9. Финальные recorded unit/integration/e2e, root/API/web typecheck, lint, migrations,
   schema drift/all downs и diff-check. Для полного release CI выполнить весь
   documented workflow, включая bot/site/UI, на итоговом согласованном source SHA;
   не выдавать частичный прогон за полный. No new skips/assertion weakening/timeouts.
10. Обновить report, migration runbook, PR279 с финальными SHA/counts/матрицей.
    Draft снять только при полном DoD. Merge/deploy/release/production не выполнять
    без отдельного разрешения. Food/MV8/new POS/новые денежные правила вне scope.

## Уточнение принятой модели

BarOperationIntent: propertyId/kind/key, normalized request, result JSON и author/time; unique(propertyId,kind,key). Transactional registry для четырёх операций, без TTL. Для replay статус продажи/связанного cash читается заново.
BarSupplierPaymentReversal: unique paymentId, immutable propertyId, amountMinor, author/time, ссылка на исходную оплату; создаётся атомарно с Finance void.
BarCostLoss: unique saleId, immutable propertyId, amountMinor, reason/author/time; только no-restock reversal, без warehouse movement.
Все новые связи проверяются независимыми ownership guards для app и service; FORCE RLS и pinned функции. Legacy migration backfill проводится только для однозначных связей; сомнительные legacy записи блокируют приёмку.
