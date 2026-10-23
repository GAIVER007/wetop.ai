-- CONTENT-DRAFTS-20261022 (утверждено владельцем 23.10.2026): черновики постов «Контента», docs/marketing/content-drafts-proposal.md.
-- Одна новая таблица; существующие не меняются. Откат: down.sql (только пустая таблица). На рабочей базе применяет владелец.

CREATE TABLE "content_drafts" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "creation_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "topic" VARCHAR(500) NOT NULL,
    "title" VARCHAR(200),
    "body" TEXT NOT NULL,
    "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cta" VARCHAR(20),
    "origin" VARCHAR(10) NOT NULL,
    "planned_on" DATE,
    "status" VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_drafts_location_id_creation_id_key" ON "content_drafts"("location_id", "creation_id");
CREATE INDEX "content_drafts_location_id_planned_on_idx" ON "content_drafts"("location_id", "planned_on");
CREATE INDEX "content_drafts_location_id_status_created_at_idx" ON "content_drafts"("location_id", "status", "created_at");

ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
  ADD CONSTRAINT "content_drafts_channel" CHECK ("channel" IN ('INSTAGRAM', 'FACEBOOK', 'TELEGRAM', 'WHATSAPP_STATUS')),
  ADD CONSTRAINT "content_drafts_cta" CHECK ("cta" IS NULL OR "cta" IN ('BOOK_ONLINE', 'WHATSAPP', 'CALL', 'VISIT', 'NONE')),
  ADD CONSTRAINT "content_drafts_origin" CHECK ("origin" IN ('AI', 'MANUAL')),
  ADD CONSTRAINT "content_drafts_status" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  ADD CONSTRAINT "content_drafts_body" CHECK (length(btrim("body")) > 0 AND char_length("body") <= 2200),
  ADD CONSTRAINT "content_drafts_hashtags" CHECK (cardinality("hashtags") <= 10),
  ADD CONSTRAINT "content_drafts_revision" CHECK ("revision" >= 1),
  ADD CONSTRAINT "content_drafts_published" CHECK (("status" = 'PUBLISHED') = ("published_at" IS NOT NULL));

-- Место, автор и происхождение неизменны; архив окончателен
CREATE OR REPLACE FUNCTION content_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF (NEW.location_id, NEW.creation_id, NEW.origin, NEW.created_by_id, NEW.created_at)
     IS DISTINCT FROM (OLD.location_id, OLD.creation_id, OLD.origin, OLD.created_by_id, OLD.created_at)
  THEN RAISE EXCEPTION 'Content draft identity is immutable'; END IF;
  IF OLD.status = 'ARCHIVED' THEN RAISE EXCEPTION 'Archived content draft is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.content_draft_guard() SET search_path = %s',s,path);
END $$;

CREATE TRIGGER content_draft_guard BEFORE UPDATE ON "content_drafts"
  FOR EACH ROW EXECUTE FUNCTION content_draft_guard();

-- Изоляция (ADR-103): через филиал → бизнес → организация
ALTER TABLE "content_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_drafts" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "content_drafts" TO wetop_app USING (EXISTS (
  SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
   WHERE l.id = location_id AND b.organization_id = app_current_org()));

-- Права: черновик правится и архивируется, не удаляется
GRANT SELECT, INSERT, UPDATE ON "content_drafts" TO wetop_app, wetop_service;
REVOKE DELETE ON "content_drafts" FROM wetop_app, wetop_service;
