-- Откат ADR-MKT-LAUNCH, §57: шаги, запуски, креативы, активы кабинета. Объекты креативов в хранилище остаются;
-- кампании, созданные в Meta, тоже: откат базы их не останавливает.
DROP POLICY IF EXISTS rls_tenant ON "marketing_ad_launch_steps";
DROP POLICY IF EXISTS rls_tenant ON "marketing_ad_launches";
DROP POLICY IF EXISTS rls_tenant ON "marketing_ad_creatives";
DROP TRIGGER IF EXISTS marketing_ad_launch_guard ON "marketing_ad_launches";
DROP FUNCTION IF EXISTS marketing_ad_launch_guard();
DROP TABLE IF EXISTS "marketing_ad_launch_steps";
DROP TABLE IF EXISTS "marketing_ad_launches";
DROP TABLE IF EXISTS "marketing_ad_creatives";
ALTER TABLE "marketing_ad_connections" DROP CONSTRAINT IF EXISTS "marketing_ad_connections_assets";
ALTER TABLE "marketing_ad_connections" DROP COLUMN IF EXISTS "pixel_id", DROP COLUMN IF EXISTS "instagram_user_id", DROP COLUMN IF EXISTS "page_id";
DROP TYPE IF EXISTS "MarketingLaunchStatus";
DROP TYPE IF EXISTS "MarketingAdDestination";
DROP TYPE IF EXISTS "MarketingAdGoal";
DROP TYPE IF EXISTS "MarketingCreativeKind";
