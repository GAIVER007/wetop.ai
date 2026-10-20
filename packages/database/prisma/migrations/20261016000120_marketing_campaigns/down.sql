-- Откат ADR-MKT-B3, §53: кампании и статистика (поле расхода, политики, таблицы, тип); расходы остаются
ALTER TABLE "marketing_expenses" DROP CONSTRAINT IF EXISTS "marketing_expenses_campaign_id_fkey";
DROP INDEX IF EXISTS "marketing_expenses_campaign_id_idx";
ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "campaign_id";
DROP POLICY IF EXISTS rls_tenant ON "marketing_campaign_stats";
DROP POLICY IF EXISTS rls_tenant ON "marketing_campaigns";
DROP TABLE IF EXISTS "marketing_campaign_stats";
DROP TABLE IF EXISTS "marketing_campaigns";
DROP TYPE IF EXISTS "MarketingCampaignStatus";
