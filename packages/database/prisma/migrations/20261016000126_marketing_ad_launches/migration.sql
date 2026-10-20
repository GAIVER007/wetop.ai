-- ADR-MKT-LAUNCH, DATA_MODEL §57 (v2.40): запуск рекламы из WETOP: файл креатива, запуск, журнал шагов в Meta;
-- поправка §55: страница, Instagram и пиксель по умолчанию у кабинета. Права ролей миграцией 127.
-- Откат: down.sql. На рабочей базе применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "MarketingCreativeKind" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "MarketingAdGoal" AS ENUM ('LEADS', 'MESSAGES', 'WEBSITE');
CREATE TYPE "MarketingAdDestination" AS ENUM ('LEAD_FORM', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT', 'WEBSITE');
CREATE TYPE "MarketingLaunchStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- §55: активы по умолчанию для мастера (номера Meta, не ключи)
ALTER TABLE "marketing_ad_connections"
  ADD COLUMN "page_id" VARCHAR(40),
  ADD COLUMN "instagram_user_id" VARCHAR(40),
  ADD COLUMN "pixel_id" VARCHAR(40),
  ADD CONSTRAINT "marketing_ad_connections_assets" CHECK (
    ("page_id" IS NULL OR "page_id" ~ '^[0-9]{1,40}$') AND
    ("instagram_user_id" IS NULL OR "instagram_user_id" ~ '^[0-9]{1,40}$') AND
    ("pixel_id" IS NULL OR "pixel_id" ~ '^[0-9]{1,40}$'));

-- CreateTable
CREATE TABLE "marketing_ad_creatives" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "kind" "MarketingCreativeKind" NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "storage_ref" VARCHAR(500) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "sha256" CHAR(64) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_ad_creatives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_ad_launches" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "source" VARCHAR(10) NOT NULL,
    "goal" "MarketingAdGoal" NOT NULL,
    "destination" "MarketingAdDestination" NOT NULL,
    "daily_budget_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "fx_rate" DECIMAL(14,6) NOT NULL,
    "daily_budget_base_minor" BIGINT NOT NULL,
    "settings" JSONB NOT NULL,
    "proposal" JSONB,
    "creative_id" UUID,
    "status" "MarketingLaunchStatus" NOT NULL DEFAULT 'RUNNING',
    "step" VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
    "external_campaign_id" VARCHAR(64),
    "external_adset_id" VARCHAR(64),
    "external_creative_id" VARCHAR(64),
    "external_ad_id" VARCHAR(64),
    "campaign_id" UUID,
    "error" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketing_ad_launches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_ad_launch_steps" (
    "id" UUID NOT NULL,
    "launch_id" UUID NOT NULL,
    "step" VARCHAR(10) NOT NULL,
    "attempt" SMALLINT NOT NULL,
    "status" VARCHAR(12) NOT NULL,
    "external_id" VARCHAR(64),
    "error_code" INTEGER,
    "error" VARCHAR(500),
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_ad_launch_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_ad_creatives_storage_ref_key" ON "marketing_ad_creatives"("storage_ref");
CREATE UNIQUE INDEX "marketing_ad_creatives_location_id_sha256_key" ON "marketing_ad_creatives"("location_id", "sha256");
CREATE UNIQUE INDEX "marketing_ad_launches_request_key_key" ON "marketing_ad_launches"("request_key");
CREATE INDEX "marketing_ad_launches_location_id_created_at_idx" ON "marketing_ad_launches"("location_id", "created_at");
CREATE INDEX "marketing_ad_launches_connection_id_status_idx" ON "marketing_ad_launches"("connection_id", "status");
CREATE INDEX "marketing_ad_launch_steps_launch_id_at_idx" ON "marketing_ad_launch_steps"("launch_id", "at");

-- AddForeignKey
ALTER TABLE "marketing_ad_creatives" ADD CONSTRAINT "marketing_ad_creatives_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_creatives" ADD CONSTRAINT "marketing_ad_creatives_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_launches" ADD CONSTRAINT "marketing_ad_launches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_launches" ADD CONSTRAINT "marketing_ad_launches_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketing_ad_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_launches" ADD CONSTRAINT "marketing_ad_launches_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "marketing_ad_creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_launches" ADD CONSTRAINT "marketing_ad_launches_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_launches" ADD CONSTRAINT "marketing_ad_launches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_ad_launch_steps" ADD CONSTRAINT "marketing_ad_launch_steps_launch_id_fkey" FOREIGN KEY ("launch_id") REFERENCES "marketing_ad_launches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ключ объекта выводится из строки целиком (как §51): нельзя сослаться на чужой объект хранилища
ALTER TABLE "marketing_ad_creatives"
  ADD CONSTRAINT "marketing_ad_creatives_mime" CHECK (
    ("kind" = 'IMAGE' AND "mime_type" IN ('image/jpeg', 'image/png')) OR
    ("kind" = 'VIDEO' AND "mime_type" IN ('video/mp4', 'video/quicktime'))),
  ADD CONSTRAINT "marketing_ad_creatives_size" CHECK (
    "byte_size" >= 1 AND "byte_size" <= CASE "kind" WHEN 'IMAGE' THEN 8388608 ELSE 209715200 END),
  ADD CONSTRAINT "marketing_ad_creatives_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "marketing_ad_creatives_name" CHECK (length(btrim("file_name")) > 0),
  ADD CONSTRAINT "marketing_ad_creatives_ref" CHECK (
    "storage_ref" = 'marketing-ad-creatives/' || "location_id" || '/' || "id" || '/' || "sha256" ||
      CASE "mime_type" WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'video/mp4' THEN '.mp4' ELSE '.mov' END);

ALTER TABLE "marketing_ad_launches"
  ADD CONSTRAINT "marketing_ad_launches_source" CHECK ("source" IN ('SCREEN', 'TELEGRAM')),
  ADD CONSTRAINT "marketing_ad_launches_destination" CHECK (
    ("goal" = 'LEADS' AND "destination" = 'LEAD_FORM') OR
    ("goal" = 'WEBSITE' AND "destination" = 'WEBSITE') OR
    ("goal" = 'MESSAGES' AND "destination" IN ('WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT'))),
  ADD CONSTRAINT "marketing_ad_launches_money" CHECK (
    "daily_budget_minor" > 0 AND "daily_budget_base_minor" > 0 AND "fx_rate" > 0 AND "currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "marketing_ad_launches_settings" CHECK (jsonb_typeof("settings") = 'object'),
  ADD CONSTRAINT "marketing_ad_launches_step" CHECK ("step" IN ('MEDIA', 'CAMPAIGN', 'ADSET', 'CREATIVE', 'AD', 'DONE')),
  ADD CONSTRAINT "marketing_ad_launches_external" CHECK (
    ("external_campaign_id" IS NULL OR "external_campaign_id" ~ '^[0-9]{1,64}$') AND
    ("external_adset_id" IS NULL OR "external_adset_id" ~ '^[0-9]{1,64}$') AND
    ("external_creative_id" IS NULL OR "external_creative_id" ~ '^[0-9]{1,64}$') AND
    ("external_ad_id" IS NULL OR "external_ad_id" ~ '^[0-9]{1,64}$')),
  -- исход: успех со всеми номерами и кампанией WETOP, отказ со словами; оба с временем завершения
  ADD CONSTRAINT "marketing_ad_launches_outcome" CHECK (
    ("status" = 'RUNNING' AND "finished_at" IS NULL) OR
    ("status" = 'SUCCEEDED' AND "finished_at" IS NOT NULL AND "step" = 'DONE' AND "campaign_id" IS NOT NULL
      AND "external_campaign_id" IS NOT NULL AND "external_adset_id" IS NOT NULL
      AND "external_creative_id" IS NOT NULL AND "external_ad_id" IS NOT NULL) OR
    ("status" = 'FAILED' AND "finished_at" IS NOT NULL AND "error" IS NOT NULL));

ALTER TABLE "marketing_ad_launch_steps"
  ADD CONSTRAINT "marketing_ad_launch_steps_step" CHECK ("step" IN ('MEDIA', 'CAMPAIGN', 'ADSET', 'CREATIVE', 'AD', 'DONE')),
  ADD CONSTRAINT "marketing_ad_launch_steps_attempt" CHECK ("attempt" BETWEEN 1 AND 5),
  ADD CONSTRAINT "marketing_ad_launch_steps_status" CHECK ("status" IN ('OK', 'FAILED', 'ROLLED_BACK'));

-- Кабинет, креатив и кампания запуска того же филиала; что ушло в Meta, не переписывается; завершённый запуск неизменен
CREATE OR REPLACE FUNCTION marketing_ad_launch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM marketing_ad_connections c WHERE c.id = NEW.connection_id AND c.location_id = NEW.location_id)
 THEN RAISE EXCEPTION 'Launch connection belongs to another location'; END IF;
 IF NEW.creative_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM marketing_ad_creatives f WHERE f.id = NEW.creative_id AND f.location_id = NEW.location_id)
 THEN RAISE EXCEPTION 'Launch creative belongs to another location'; END IF;
 IF NEW.campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM marketing_campaigns m WHERE m.id = NEW.campaign_id AND m.location_id = NEW.location_id)
 THEN RAISE EXCEPTION 'Launch campaign belongs to another location'; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF OLD.status <> 'RUNNING' THEN RAISE EXCEPTION 'Finished launch is immutable'; END IF;
  IF (NEW.location_id, NEW.connection_id, NEW.request_key, NEW.source, NEW.goal, NEW.destination, NEW.daily_budget_minor,
      NEW.currency, NEW.fx_rate, NEW.daily_budget_base_minor, NEW.settings, NEW.proposal, NEW.creative_id,
      NEW.created_by_id, NEW.created_at)
     IS DISTINCT FROM (OLD.location_id, OLD.connection_id, OLD.request_key, OLD.source, OLD.goal, OLD.destination,
      OLD.daily_budget_minor, OLD.currency, OLD.fx_rate, OLD.daily_budget_base_minor, OLD.settings, OLD.proposal,
      OLD.creative_id, OLD.created_by_id, OLD.created_at)
  THEN RAISE EXCEPTION 'Launch settings are immutable'; END IF;
  IF (OLD.external_campaign_id IS NOT NULL AND NEW.external_campaign_id IS DISTINCT FROM OLD.external_campaign_id) OR
     (OLD.external_adset_id IS NOT NULL AND NEW.external_adset_id IS DISTINCT FROM OLD.external_adset_id) OR
     (OLD.external_creative_id IS NOT NULL AND NEW.external_creative_id IS DISTINCT FROM OLD.external_creative_id) OR
     (OLD.external_ad_id IS NOT NULL AND NEW.external_ad_id IS DISTINCT FROM OLD.external_ad_id)
  THEN RAISE EXCEPTION 'Launch external ids are immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.marketing_ad_launch_guard() SET search_path = %s',s,path);
END $$;

CREATE TRIGGER marketing_ad_launch_guard BEFORE INSERT OR UPDATE ON "marketing_ad_launches"
  FOR EACH ROW EXECUTE FUNCTION marketing_ad_launch_guard();

-- Изоляция (ADR-103): креативы и запуски через филиал → бизнес → организация, шаги через запуск
ALTER TABLE "marketing_ad_creatives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_ad_creatives" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_ad_launches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_ad_launches" FORCE ROW LEVEL SECURITY;
ALTER TABLE "marketing_ad_launch_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_ad_launch_steps" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "marketing_ad_creatives" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "marketing_ad_launches" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));
CREATE POLICY rls_tenant ON "marketing_ad_launch_steps" TO wetop_app USING (EXISTS (
  SELECT 1 FROM marketing_ad_launches a JOIN locations l ON l.id = a.location_id JOIN businesses b ON b.id = l.business_id
   WHERE a.id = launch_id AND b.organization_id = app_current_org()));
