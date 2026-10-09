-- Права лицензированного конструктора (MKT9.2) вынесены из создающей миграции 68, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TYPE и CREATE TABLE.
-- Права по умолчанию из 26 выдали бы все четыре.
-- Лицензию приложение только читает: выдаёт, продлевает и выключает главный администратор служебной ролью; строки не
-- удаляются никем (выключение это OFF).
GRANT SELECT ON "site_builder_entitlements" TO wetop_app;
REVOKE INSERT, UPDATE, DELETE ON "site_builder_entitlements" FROM wetop_app;
GRANT SELECT, INSERT, UPDATE ON "site_builder_entitlements" TO wetop_service;
REVOKE DELETE ON "site_builder_entitlements" FROM wetop_service;
-- Разговор ИИ: человек ставит и читает, состояние, расход и ответ пишет воркер; задачи не удаляются
GRANT SELECT, INSERT ON "site_ai_runs" TO wetop_app;
REVOKE UPDATE, DELETE ON "site_ai_runs" FROM wetop_app;
GRANT SELECT, INSERT, UPDATE ON "site_ai_runs" TO wetop_service;
REVOKE DELETE ON "site_ai_runs" FROM wetop_service;
-- Закладки: человек ставит, переименовывает и снимает
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_site_version_bookmarks" TO wetop_app, wetop_service;
