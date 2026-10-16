-- Права кампаний (ADR-MKT-B3, §53) вынесены из создающей миграции 120, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Кампания не удаляется (завершается
-- статусом): DELETE у роли нет. День статистики можно стереть.
GRANT SELECT, INSERT, UPDATE ON "marketing_campaigns" TO wetop_app, wetop_service;
REVOKE DELETE ON "marketing_campaigns" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_campaign_stats" TO wetop_app, wetop_service;
