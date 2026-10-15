-- SITE-5 (ADR-185 п. 3, plans/site-seo-flow-2026-10-15.md §2 и D3; DATA_MODEL §46, v2.30): заявка с сайта без слота
-- («Перезвоните мне»). Строку заводит публичный `POST /w/lead` от имени организации сайта; читает и ведёт статус стойка
-- (`/marketing/site/leads`). Повтор той же формы с тем же ключом запроса не заводит вторую заявку.
-- Миграцию применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "SiteLeadKind" AS ENUM ('CALLBACK', 'OTHER');
CREATE TYPE "SiteLeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'SPAM');

-- CreateTable
CREATE TABLE "site_leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "tracked_site_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "comment" VARCHAR(2000),
    "kind" "SiteLeadKind" NOT NULL DEFAULT 'CALLBACK',
    "status" "SiteLeadStatus" NOT NULL DEFAULT 'NEW',
    "request_key" VARCHAR(64) NOT NULL,
    "request_fingerprint" VARCHAR(64) NOT NULL,
    "source" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_leads_tracked_site_id_request_key_key" ON "site_leads"("tracked_site_id", "request_key");
CREATE INDEX "site_leads_location_id_created_at_idx" ON "site_leads"("location_id", "created_at");
CREATE INDEX "site_leads_organization_id_idx" ON "site_leads"("organization_id");

-- AddForeignKey
ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_tracked_site_id_fkey" FOREIGN KEY ("tracked_site_id") REFERENCES "tracked_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_values" CHECK (
  btrim("name") <> '' AND btrim("phone") <> '' AND btrim("request_key") <> ''
  AND ("source" IS NULL OR jsonb_typeof("source") = 'object')
);

-- Заявка принадлежит филиалу своего сайта и организации этого филиала; после создания меняются только статус и время
CREATE FUNCTION site_lead_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.organization_id <> OLD.organization_id OR NEW.location_id <> OLD.location_id
     OR NEW.tracked_site_id <> OLD.tracked_site_id OR NEW.name <> OLD.name OR NEW.phone <> OLD.phone
     OR NEW.comment IS DISTINCT FROM OLD.comment OR NEW.kind <> OLD.kind OR NEW.request_key <> OLD.request_key
     OR NEW.request_fingerprint <> OLD.request_fingerprint OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.created_at <> OLD.created_at) THEN
  RAISE EXCEPTION 'site_leads: у заявки меняется только статус';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM tracked_sites t JOIN locations l ON l.id = t.location_id JOIN businesses b ON b.id = l.business_id
    WHERE t.id = NEW.tracked_site_id AND l.id = NEW.location_id AND b.organization_id = NEW.organization_id) THEN
  RAISE EXCEPTION 'site_leads: сайт заявки принадлежит другому филиалу или организации';
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.site_lead_guard() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER site_lead_guard BEFORE INSERT OR UPDATE ON "site_leads"
  FOR EACH ROW EXECUTE FUNCTION site_lead_guard();

-- Изоляция (§17): по цепочке филиал → бизнес → организация, как у соседних таблиц сайта (`marketing_sites`,
-- `site_builder_entitlements`) и правил брони столов
ALTER TABLE "site_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_leads" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "site_leads" TO wetop_app
  USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
                  WHERE l.id = location_id AND b.organization_id = app_current_org()))
  WITH CHECK (organization_id = app_current_org() AND EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
                  WHERE l.id = location_id AND b.organization_id = app_current_org()));

-- Права ролей приложения: отдельной миграцией 111 (восстановление базы повторяет только чистые миграции прав)
