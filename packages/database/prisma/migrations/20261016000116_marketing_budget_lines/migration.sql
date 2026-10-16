-- ADR-MKT-B7, DATA_MODEL §52 (v2.35): план бюджета маркетинга по каналам, разбивка общего плана месяца
-- (marketing_budgets, §41.2). Деньги BigInt в minor units валюты отчётности (ADR-008). Привязка к филиалу, как у
-- §41. Права ролей отдельной миграцией 117. Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateTable
CREATE TABLE "marketing_budget_lines" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "platform" "MarketingPlatform" NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_budget_lines_location_id_month_platform_key" ON "marketing_budget_lines"("location_id", "month", "platform");

-- AddForeignKey
ALTER TABLE "marketing_budget_lines" ADD CONSTRAINT "marketing_budget_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketing_budget_lines"
  ADD CONSTRAINT "marketing_budget_lines_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "marketing_budget_lines_month" CHECK ("month" = date_trunc('month', "month")::date);

-- Изоляция (ADR-103): через филиал → бизнес → организация, как у §41
ALTER TABLE "marketing_budget_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_budget_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_budget_lines" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
