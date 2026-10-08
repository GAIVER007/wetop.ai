-- Откат MKT9.2 (20261008000068_licensed_site_builder). Разговоры, закладки и лицензии теряются; знания проекта тоже.
-- Прежний словарь ошибок сборки вернётся, только если задач с LICENSE_UNAVAILABLE нет, иначе откат остановится на нём.
-- Частичный UNIQUE «один неархивный сайт на филиал» возвращается как был в …060. Откат только до того, как
-- лицензиями и разговором начали пользоваться.
DROP POLICY IF EXISTS rls_tenant ON "marketing_site_version_bookmarks";
DROP POLICY IF EXISTS rls_tenant ON "site_ai_runs";
DROP POLICY IF EXISTS rls_tenant ON "site_builder_entitlements";
DROP TRIGGER IF EXISTS marketing_site_bookmark_guard ON "marketing_site_version_bookmarks";
DROP TRIGGER IF EXISTS site_ai_run_guard ON "site_ai_runs";
DROP TRIGGER IF EXISTS site_builder_entitlement_guard ON "site_builder_entitlements";
DROP FUNCTION IF EXISTS marketing_site_bookmark_guard();
DROP FUNCTION IF EXISTS site_ai_run_guard();
DROP FUNCTION IF EXISTS site_builder_entitlement_guard();
ALTER TABLE "generation_runs" DROP CONSTRAINT IF EXISTS "generation_runs_error_code";
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_error_code" CHECK ("error_code" IS NULL OR "error_code" IN (
    'SCHEMA_INVALID', 'MODEL_UNAVAILABLE', 'BUDGET_EXCEEDED', 'TIMEOUT', 'REJECTED_CONTENT',
    'USAGE_UNAVAILABLE', 'BRIEF_CHANGED', 'BASE_VERSION_CHANGED', 'BUDGET_DAY_CHANGED'));
DROP TABLE IF EXISTS "marketing_site_version_bookmarks";
DROP TABLE IF EXISTS "site_ai_runs";
DROP TABLE IF EXISTS "site_builder_entitlements";
DROP TYPE IF EXISTS "SiteAiRunStatus";
DROP TYPE IF EXISTS "SiteAiRunMode";
DROP INDEX IF EXISTS "marketing_sites_location_id_key";
CREATE UNIQUE INDEX "marketing_sites_location_active_key" ON "marketing_sites"("location_id") WHERE "state" <> 'ARCHIVED';
CREATE INDEX "marketing_sites_location_id_idx" ON "marketing_sites"("location_id");
ALTER TABLE "marketing_sites" DROP COLUMN IF EXISTS "builder_instructions";
