-- Откат MKT3 (20261006000060_marketing_site_core). Версии неизменяемы, поэтому сторож снимается раньше таблиц;
-- указатели сайта на версии и версии на сайт сняты вместе с таблицами. Данные сайтов теряются: откат только до
-- того, как разделом начали пользоваться.
DROP POLICY IF EXISTS rls_tenant ON "marketing_site_versions";
DROP POLICY IF EXISTS rls_tenant ON "marketing_sites";
DROP TRIGGER IF EXISTS marketing_site_version_immutable ON "marketing_site_versions";
DROP TRIGGER IF EXISTS marketing_site_version_guard ON "marketing_site_versions";
DROP TRIGGER IF EXISTS marketing_site_guard ON "marketing_sites";
DROP FUNCTION IF EXISTS marketing_site_version_immutable();
DROP FUNCTION IF EXISTS marketing_site_version_guard();
DROP FUNCTION IF EXISTS marketing_site_guard();
ALTER TABLE "marketing_sites" DROP CONSTRAINT IF EXISTS "marketing_sites_latest_version_id_fkey";
ALTER TABLE "marketing_sites" DROP CONSTRAINT IF EXISTS "marketing_sites_published_version_id_fkey";
DROP TABLE IF EXISTS "marketing_site_versions";
DROP TABLE IF EXISTS "marketing_sites";
DROP TYPE IF EXISTS "SiteVersionSource";
DROP TYPE IF EXISTS "MarketingSiteState";
