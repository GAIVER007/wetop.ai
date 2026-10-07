-- Откат MKT6 (20261007000062_generation_run_core). Версии ИИ ссылаются на задачи: прежний CHECK «только MANUAL»
-- вернётся, только если таких версий нет, иначе откат остановится на нём. Откат только до того, как генерацией
-- начали пользоваться.
DROP POLICY IF EXISTS rls_tenant ON "generation_runs";
DROP TRIGGER IF EXISTS marketing_site_version_run_guard ON "marketing_site_versions";
DROP TRIGGER IF EXISTS generation_run_guard ON "generation_runs";
DROP FUNCTION IF EXISTS marketing_site_version_run_guard();
DROP FUNCTION IF EXISTS generation_run_guard();
ALTER TABLE "marketing_site_versions" DROP CONSTRAINT IF EXISTS "marketing_site_versions_source_provenance";
ALTER TABLE "marketing_site_versions" ADD CONSTRAINT "marketing_site_versions_source_manual" CHECK ("source" = 'MANUAL');
ALTER TABLE "marketing_site_versions" DROP CONSTRAINT IF EXISTS "marketing_site_versions_generation_run_id_fkey";
DROP INDEX IF EXISTS "marketing_site_versions_generation_run_id_key";
ALTER TABLE "marketing_site_versions" DROP COLUMN IF EXISTS "generation_run_id";
DROP TABLE IF EXISTS "generation_runs";
DROP TYPE IF EXISTS "GenerationRunStatus";
DROP TYPE IF EXISTS "GenerationRunType";
