-- Права области доступа (STAFF2.3b) вынесены из создающей миграции 070, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Приложение ставит, меняет и снимает
-- назначения (проверку роли делает API по §16.5); служебная роль нужна принятию приглашения и фоновым задачам.
GRANT SELECT, INSERT, UPDATE, DELETE ON "membership_scopes" TO wetop_app, wetop_service;
