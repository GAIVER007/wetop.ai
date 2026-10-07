-- Права задач генерации (MKT6) вынесены из создающей миграции 62, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TYPE и CREATE TABLE.
-- Права по умолчанию из 26 выдали бы все четыре. Запрос человека (wetop_app) только читает и ставит задачу;
-- состояние, расход и результат меняет воркер служебным путём. Задачи не удаляются.
GRANT SELECT, INSERT ON "generation_runs" TO wetop_app;
REVOKE UPDATE, DELETE ON "generation_runs" FROM wetop_app;
GRANT SELECT, INSERT, UPDATE ON "generation_runs" TO wetop_service;
REVOKE DELETE ON "generation_runs" FROM wetop_service;
