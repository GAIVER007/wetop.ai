-- Права кабинета (ADR-MKT-META, §55) вынесены из создающей миграции 123, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Подключение не удаляется
-- (отключение это статус), сверки только дописываются и закрываются: DELETE у роли нет.
GRANT SELECT, INSERT, UPDATE ON "marketing_ad_connections" TO wetop_app, wetop_service;
REVOKE DELETE ON "marketing_ad_connections" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "marketing_sync_runs" TO wetop_app, wetop_service;
REVOKE DELETE ON "marketing_sync_runs" FROM wetop_app, wetop_service;
