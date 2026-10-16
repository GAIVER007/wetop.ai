-- ADR-MKT-META, DATA_MODEL §55 (v2.38): рекламный кабинет филиала (ключ зашифрован), журнал сверок; поправки §53:
-- номер кампании в кабинете, источник и расход кабинета у дня статистики. Права ролей миграцией 124.
-- Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "MarketingStatSource" AS ENUM ('MANUAL', 'META');
CREATE TYPE "MarketingConnectionStatus" AS ENUM ('ACTIVE', 'FAILED', 'DISCONNECTED');

-- §53: имя уникально только у ручных кампаний, у кампаний кабинета уникален их номер
ALTER TABLE "marketing_campaigns" ADD COLUMN "external_id" VARCHAR(64);
DROP INDEX "marketing_campaigns_location_id_platform_name_key";
CREATE UNIQUE INDEX "marketing_campaigns_manual_name_key" ON "marketing_campaigns"("location_id", "platform", "name") WHERE "external_id" IS NULL;
CREATE UNIQUE INDEX "marketing_campaigns_location_id_platform_external_id_key" ON "marketing_campaigns"("location_id", "platform", "external_id");

ALTER TABLE "marketing_campaign_stats"
  ADD COLUMN "source" "MarketingStatSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "spend_minor" BIGINT,
  ADD COLUMN "spend_currency" CHAR(3),
  ADD CONSTRAINT "marketing_campaign_stats_spend" CHECK (
    ("source" = 'MANUAL' AND "spend_minor" IS NULL AND "spend_currency" IS NULL) OR
    -- IS NOT NULL явно: NULL >= 0 даёт «неизвестно», а CHECK такую строку пропускает
    ("source" = 'META' AND "spend_minor" IS NOT NULL AND "spend_minor" >= 0
      AND "spend_currency" IS NOT NULL AND "spend_currency" ~ '^[A-Z]{3}$'));

-- CreateTable
CREATE TABLE "marketing_ad_connections" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "platform" "MarketingPlatform" NOT NULL,
    "ad_account_id" VARCHAR(40) NOT NULL,
    "account_name" VARCHAR(200),
    "currency" CHAR(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "token_ciphertext" TEXT NOT NULL,
    "status" "MarketingConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_synced_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "connected_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_ad_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_sync_runs" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "trigger" VARCHAR(10) NOT NULL,
    "since" DATE NOT NULL,
    "until" DATE NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "campaigns" INTEGER,
    "days" INTEGER,
    "error" VARCHAR(500),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketing_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_ad_connections_location_id_platform_key" ON "marketing_ad_connections"("location_id", "platform");
CREATE INDEX "marketing_sync_runs_connection_id_started_at_idx" ON "marketing_sync_runs"("connection_id", "started_at");

ALTER TABLE "marketing_ad_connections" ADD CONSTRAINT "marketing_ad_connections_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_connections" ADD CONSTRAINT "marketing_ad_connections_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_sync_runs" ADD CONSTRAINT "marketing_sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketing_ad_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketing_ad_connections"
  ADD CONSTRAINT "marketing_ad_connections_account" CHECK ("ad_account_id" ~ '^[0-9]{1,40}$'),
  ADD CONSTRAINT "marketing_ad_connections_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
  -- ключ хранится только шифром pii-crypto (v1:iv:tag:data); у отключённого кабинета ключ стёрт
  ADD CONSTRAINT "marketing_ad_connections_token" CHECK (
    ("status" = 'DISCONNECTED' AND "token_ciphertext" = '') OR "token_ciphertext" LIKE 'v1:%');
ALTER TABLE "marketing_sync_runs"
  ADD CONSTRAINT "marketing_sync_runs_trigger" CHECK ("trigger" IN ('NIGHTLY', 'MANUAL')),
  ADD CONSTRAINT "marketing_sync_runs_status" CHECK ("status" IN ('RUNNING', 'OK', 'FAILED')),
  ADD CONSTRAINT "marketing_sync_runs_period" CHECK ("until" >= "since");

-- Изоляция (ADR-103): подключения через филиал → бизнес → организация, сверки через подключение
ALTER TABLE "marketing_ad_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_ad_connections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_sync_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_sync_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_ad_connections" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "marketing_sync_runs" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_ad_connections c JOIN locations l ON l.id = c.location_id JOIN businesses b ON b.id = l.business_id
   WHERE c.id = connection_id AND b.organization_id = app_current_org()));
