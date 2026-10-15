-- Права библиотеки изображений сайта (MKT8) вынесены из создающей миграции 66, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TYPE и CREATE TABLE.
-- Права по умолчанию из 26 выдали бы все четыре. Ассет не удаляется физически: удаление это состояние DELETED, а
-- объект, нужный истории публикаций, остаётся в хранилище.
GRANT SELECT, INSERT, UPDATE ON "site_assets" TO wetop_app, wetop_service;
REVOKE DELETE ON "site_assets" FROM wetop_app, wetop_service;
