-- Права запуска рекламы (ADR-MKT-LAUNCH, §57) вынесены из создающей миграции 126, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Креатив не меняется и не удаляется,
-- запуск не удаляется (завершённый неизменен, триггер), шаги только дописываются.
GRANT SELECT, INSERT ON "marketing_ad_creatives" TO wetop_app, wetop_service;
REVOKE UPDATE, DELETE ON "marketing_ad_creatives" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "marketing_ad_launches" TO wetop_app, wetop_service;
REVOKE DELETE ON "marketing_ad_launches" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT ON "marketing_ad_launch_steps" TO wetop_app, wetop_service;
REVOKE UPDATE, DELETE ON "marketing_ad_launch_steps" FROM wetop_app, wetop_service;
