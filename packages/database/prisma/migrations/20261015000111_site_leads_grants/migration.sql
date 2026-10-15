-- Права `site_leads` (SITE-5, DATA_MODEL §46) по фактическим операциям API: заявку заводят и меняют ей статус, не
-- удаляют. Отдельной чистой миграцией прав: восстановление рабочей базы (`db-restore-prod.sh`) повторяет только такие.
REVOKE ALL ON "site_leads" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "site_leads" TO wetop_app, wetop_service;
