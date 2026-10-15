-- Права управляемого сайта (MKT3) вынесены из создающей миграции 60, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TYPE и CREATE TABLE.
-- Права по умолчанию из 26 выдали бы все четыре: версии только читаются и дописываются,
-- сайт не удаляется (архив это состояние, MKT7).
GRANT SELECT, INSERT, UPDATE ON "marketing_sites" TO wetop_app, wetop_service;
REVOKE DELETE ON "marketing_sites" FROM wetop_app, wetop_service;
GRANT SELECT, INSERT ON "marketing_site_versions" TO wetop_app, wetop_service;
REVOKE UPDATE, DELETE ON "marketing_site_versions" FROM wetop_app, wetop_service;
