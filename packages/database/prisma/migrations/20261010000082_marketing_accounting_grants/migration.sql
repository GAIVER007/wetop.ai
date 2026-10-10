-- Права учёта маркетинга (ADR-MKT-B1, §32) вынесены из создающей миграции 081, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Расход правится и удаляется
-- (учётная запись оператора, не финансовый документ; правки идут в журнал организации). План месяца не
-- удаляется: он меняется правкой суммы.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_expenses" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "marketing_budgets" TO wetop_app, wetop_service;
REVOKE DELETE ON "marketing_budgets" FROM wetop_app, wetop_service;
