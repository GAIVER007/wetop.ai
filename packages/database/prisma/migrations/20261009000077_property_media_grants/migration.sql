-- Права файлов объекта (ADR-158, §32.3) вынесены из создающей миграции 76, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Запись не удаляется физически:
-- удаление это deleted_at, объект остаётся в хранилище.
GRANT SELECT, INSERT, UPDATE ON "property_media" TO wetop_app, wetop_service;
REVOKE DELETE ON "property_media" FROM wetop_app, wetop_service;
