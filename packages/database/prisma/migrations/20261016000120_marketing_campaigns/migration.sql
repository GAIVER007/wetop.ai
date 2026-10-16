-- ADR-MKT-B3, DATA_MODEL §53 (v2.36): рекламные кампании филиала и их статистика по дням (ручной ввод, позже
-- кабинеты), кампания у расхода. Деньги кампании это её расходы (§41.1), отдельной суммы нет. Права ролей миграцией
-- 121. Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "platform" "MarketingPlatform" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_on" DATE,
    "ends_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaign_stats" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "leads" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_campaign_stats_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "marketing_expenses" ADD COLUMN "campaign_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "marketing_campaigns_location_id_platform_name_key" ON "marketing_campaigns"("location_id", "platform", "name");
CREATE UNIQUE INDEX "marketing_campaign_stats_campaign_id_date_key" ON "marketing_campaign_stats"("campaign_id", "date");
CREATE INDEX "marketing_expenses_campaign_id_idx" ON "marketing_expenses"("campaign_id");

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaign_stats" ADD CONSTRAINT "marketing_campaign_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "marketing_campaigns"
  ADD CONSTRAINT "marketing_campaigns_name" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "marketing_campaigns_dates" CHECK ("ends_on" IS NULL OR "starts_on" IS NULL OR "ends_on" >= "starts_on");
ALTER TABLE "marketing_campaign_stats"
  ADD CONSTRAINT "marketing_campaign_stats_counts" CHECK ("impressions" >= 0 AND "clicks" >= 0 AND "leads" >= 0),
  ADD CONSTRAINT "marketing_campaign_stats_clicks" CHECK ("clicks" <= "impressions");

-- Изоляция (ADR-103): кампании через филиал → бизнес → организация, статистика через кампанию
ALTER TABLE "marketing_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_campaigns" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_campaign_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_campaign_stats" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_campaigns" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "marketing_campaign_stats" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_campaigns c JOIN locations l ON l.id = c.location_id JOIN businesses b ON b.id = l.business_id
   WHERE c.id = campaign_id AND b.organization_id = app_current_org()));
