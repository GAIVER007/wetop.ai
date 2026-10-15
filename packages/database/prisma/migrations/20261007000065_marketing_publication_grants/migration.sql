-- Права публикации управляемого сайта (MKT7) вынесены из создающей миграции 64, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TYPE и CREATE TABLE.
-- Права по умолчанию из 26 выдали бы все четыре. Журнал публикаций только читается и дописывается; домен не удаляется:
-- снятие это состояние REMOVED.
GRANT SELECT, INSERT ON "marketing_site_publications" TO wetop_app, wetop_service;
REVOKE UPDATE, DELETE ON "marketing_site_publications" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON "site_domains" TO wetop_app, wetop_service;
REVOKE DELETE ON "site_domains" FROM wetop_app, wetop_service;
