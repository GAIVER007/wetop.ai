-- Phase 2 «Location foundation» (ADR-100 §17.1, DATA_MODEL v2.2 §17.6; поручение владельца 27.09.2026).
-- Применяет владелец (AGENTS.md §15): backup → migrate deploy → проверка → откат (down.sql).
--
-- Location — точка бизнеса организации; Property НЕ переименовывается, её существующие FK не меняются,
-- она получает nullable location_id (1:1) — окно совместимости, properties.organization_id остаётся рабочим.
-- Business в этой фазе не добавляется (Phase 2.5).

CREATE TYPE "LocationVertical" AS ENUM ('HOSPITALITY', 'BEAUTY');

CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vertical" "LocationVertical" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "locations_organization_id_idx" ON "locations"("organization_id");

ALTER TABLE "locations"
  ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "properties" ADD COLUMN "location_id" UUID;

CREATE UNIQUE INDEX "properties_location_id_key" ON "properties"("location_id");

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_location_id_fkey" FOREIGN KEY ("location_id")
  REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Backfill (детерминированный, v1 §D.3): каждой строке properties без location_id — ровно одна Location
-- копией полей точки бизнеса. Для Luxx — одна строка. NOT NULL на location_id не вводится.
WITH src AS (
  SELECT p."id" AS property_id, gen_random_uuid() AS location_id,
         p."organization_id", p."name", p."address", p."phone", p."email", p."timezone", p."currency"
    FROM "properties" p
   WHERE p."location_id" IS NULL
), ins AS (
  INSERT INTO "locations" ("id", "organization_id", "vertical", "name", "address", "phone", "email", "timezone", "currency")
  SELECT location_id, "organization_id", 'HOSPITALITY', "name", "address", "phone", "email", "timezone", "currency"
    FROM src
  RETURNING "id"
)
UPDATE "properties" p
   SET "location_id" = s.location_id
  FROM src s
 WHERE p."id" = s.property_id;

-- Row Level Security (DATA_MODEL §17 v1.13, ADR-103): locations — арендаторская таблица, организация в строке.
-- Роли и функция app_current_org() заведены миграциями 20260927000026_rls_roles / …027; политика — как в …028.
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "locations" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
