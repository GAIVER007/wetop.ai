-- Откат ADR-MKT-META, §55: сверки, подключения, поправки §53 (уникальность имени возвращается всем кампаниям:
-- если кабинет успел завести кампании с одинаковыми именами, откат на этом шаге остановится, их нужно переименовать)
DROP POLICY IF EXISTS rls_tenant ON "marketing_sync_runs";
DROP POLICY IF EXISTS rls_tenant ON "marketing_ad_connections";
DROP TABLE IF EXISTS "marketing_sync_runs";
DROP TABLE IF EXISTS "marketing_ad_connections";
ALTER TABLE "marketing_campaign_stats" DROP CONSTRAINT IF EXISTS "marketing_campaign_stats_spend";
ALTER TABLE "marketing_campaign_stats" DROP COLUMN IF EXISTS "spend_currency", DROP COLUMN IF EXISTS "spend_minor", DROP COLUMN IF EXISTS "source";
DROP INDEX IF EXISTS "marketing_campaigns_location_id_platform_external_id_key";
DROP INDEX IF EXISTS "marketing_campaigns_manual_name_key";
CREATE UNIQUE INDEX "marketing_campaigns_location_id_platform_name_key" ON "marketing_campaigns"("location_id", "platform", "name");
ALTER TABLE "marketing_campaigns" DROP COLUMN IF EXISTS "external_id";
DROP TYPE IF EXISTS "MarketingConnectionStatus";
DROP TYPE IF EXISTS "MarketingStatSource";
