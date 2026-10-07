-- Откат MKT7 (20261007000064_marketing_publication_domains). Журнал публикаций и домены теряются, указатель сайта
-- брони филиала снимается: ИИ-продавец останется без котировки, пока срез не вернут. Откат только до того, как
-- публикацией начали пользоваться.
DROP POLICY IF EXISTS rls_tenant ON "site_domains";
DROP POLICY IF EXISTS rls_tenant ON "marketing_site_publications";
DROP TRIGGER IF EXISTS location_booking_site_guard ON "locations";
DROP TRIGGER IF EXISTS site_domain_guard ON "site_domains";
DROP TRIGGER IF EXISTS marketing_site_publication_immutable ON "marketing_site_publications";
DROP TRIGGER IF EXISTS marketing_site_publication_guard ON "marketing_site_publications";
DROP FUNCTION IF EXISTS location_booking_backfill();
DROP FUNCTION IF EXISTS location_booking_site_guard();
DROP FUNCTION IF EXISTS site_domain_guard();
DROP FUNCTION IF EXISTS marketing_site_publication_immutable();
DROP FUNCTION IF EXISTS marketing_site_publication_guard();
DROP TABLE IF EXISTS "site_domains";
DROP TABLE IF EXISTS "marketing_site_publications";
ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "locations_booking_tracked_site_id_fkey";
DROP INDEX IF EXISTS "locations_booking_tracked_site_id_idx";
ALTER TABLE "locations" DROP COLUMN IF EXISTS "booking_tracked_site_id";
DROP TYPE IF EXISTS "SiteDomainVerificationMethod";
DROP TYPE IF EXISTS "SiteDomainStatus";
DROP TYPE IF EXISTS "SiteDomainKind";
DROP TYPE IF EXISTS "SitePublicationAction";
