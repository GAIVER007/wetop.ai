-- Права плана по каналам (ADR-MKT-B7, §52) вынесены из создающей миграции 116, чтобы восстановление копии
-- (scripts/ops/db-restore-prod.sh) повторило их без повторного CREATE TABLE. Канал убирается из плана удалением
-- строки, поэтому DELETE есть (в отличие от общего плана месяца, 098).
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_budget_lines" TO wetop_app, wetop_service;
