-- Права чеков расходов (ADR-MKT-B7, §51) вынесены из создающей миграции 118, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Файл не правится, только
-- добавляется и удаляется (удаление пишется в журнал приложением): UPDATE у роли нет.
GRANT SELECT, INSERT, DELETE ON "marketing_expense_files" TO wetop_app, wetop_service;
REVOKE UPDATE ON "marketing_expense_files" FROM wetop_app, wetop_service;
