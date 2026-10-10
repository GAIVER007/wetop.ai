-- ADR-MKT-B1, DATA_MODEL §32 (v2.16): учёт бюджета и расходов маркетинга (этапы МКТ-В1/В2 ТЗ «Модуль Маркетинг» 1.0).
-- Деньги BigInt в minor units (ADR-008): amount в валюте ввода, base_amount в валюте отчётности организации
-- по курсу fx_rate на дату операции (ТЗ §8.3). Привязка к филиалу (Location), как у прочих таблиц маркетинга.
-- Права ролей отдельной миграцией 082. Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "MarketingPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'WHATSAPP', 'SITE', 'PHONE', 'OTHER');

-- CreateTable
CREATE TABLE "marketing_expenses" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "platform" "MarketingPlatform" NOT NULL,
    "campaign" VARCHAR(200),
    "category" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "fx_rate" DECIMAL(14,6) NOT NULL,
    "base_amount" BIGINT NOT NULL,
    "counted_in_budget" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_budgets" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_expenses_location_id_date_idx" ON "marketing_expenses"("location_id", "date");
CREATE UNIQUE INDEX "marketing_budgets_location_id_month_key" ON "marketing_budgets"("location_id", "month");

-- AddForeignKey
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_budgets" ADD CONSTRAINT "marketing_budgets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Суммы и курс строго положительные, валюта кодом ISO, статья не пустая, месяц плана первым числом
ALTER TABLE "marketing_expenses"
  ADD CONSTRAINT "marketing_expenses_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "marketing_expenses_base_amount" CHECK ("base_amount" > 0),
  ADD CONSTRAINT "marketing_expenses_fx_rate" CHECK ("fx_rate" > 0),
  ADD CONSTRAINT "marketing_expenses_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "marketing_expenses_category" CHECK (length(btrim("category")) > 0);

ALTER TABLE "marketing_budgets"
  ADD CONSTRAINT "marketing_budgets_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "marketing_budgets_month" CHECK ("month" = date_trunc('month', "month")::date);

-- Изоляция (ADR-103): через филиал → бизнес → организация, как у таблиц маркетинга (§29.9)
ALTER TABLE "marketing_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_expenses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_budgets" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_expenses" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "marketing_budgets" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
