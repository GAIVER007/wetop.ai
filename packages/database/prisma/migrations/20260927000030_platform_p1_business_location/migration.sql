-- Platform P1 — Business + Location foundation (ADR-104, DATA_MODEL §18, план
-- plans/phase-business-location-2026-09-27.md, подтверждён владельцем 27.09.2026 — Q-199 вариант Б).
-- Применяет владелец (AGENTS.md §15): backup → migrate deploy → проверка → откат (down.sql).
--
-- Additive: Hospitality-таблицы не трогаются, ни один существующий ID не меняется. Canonical vertical —
-- ТОЛЬКО Business.vertical; у locations нет ни organization_id (§18.3), ни vertical. properties.location_id
-- nullable на миграционное окно; properties.organization_id остаётся рабочим (замок ADR-061 без правки кода).
-- Временная миграция 20260927000029_phase2_location линии ADR-100 удалена до применения куда-либо.

CREATE TYPE "BusinessVertical" AS ENUM ('HOSPITALITY', 'BEAUTY');
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "LocationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "vertical" "BusinessVertical" NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "businesses_organization_id_idx" ON "businesses"("organization_id");
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" VARCHAR(500),
    "phone" TEXT,
    "email" TEXT,
    "timezone" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "LocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "locations_business_id_idx" ON "locations"("business_id");
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_business_id_fkey" FOREIGN KEY ("business_id")
  REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "properties" ADD COLUMN "location_id" UUID;
CREATE UNIQUE INDEX "properties_location_id_key" ON "properties"("location_id");
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_location_id_fkey" FOREIGN KEY ("location_id")
  REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizations" ADD COLUMN "reporting_currency" VARCHAR(3) NOT NULL DEFAULT 'KZT';

-- ── Backfill (детерминированный, та же транзакция; план §2 + уточнения владельца) ────────────────────────────
-- Организация с объектами → ОДИН Business (vertical HOSPITALITY, имя организации, updated_at = now()).
INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "status", "updated_at")
SELECT gen_random_uuid(), o."id", o."name", 'HOSPITALITY', 'ACTIVE', now()
  FROM "organizations" o
 WHERE EXISTS (SELECT 1 FROM "properties" p WHERE p."organization_id" = o."id")
   AND NOT EXISTS (SELECT 1 FROM "businesses" b WHERE b."organization_id" = o."id");

-- По одной Location на каждый объект организации, поля — из Property; связка через CTE с заранее
-- вычисленными id (по имени не сопоставляем — имя не уникально).
WITH src AS (
  SELECT p."id" AS property_id, gen_random_uuid() AS location_id,
         (SELECT b."id" FROM "businesses" b
           WHERE b."organization_id" = p."organization_id"
           ORDER BY b."created_at" ASC LIMIT 1) AS business_id,
         p."name", p."address", p."phone", p."email", p."timezone", p."currency"
    FROM "properties" p
   WHERE p."location_id" IS NULL
), ins AS (
  INSERT INTO "locations" ("id", "business_id", "name", "address", "phone", "email", "timezone", "currency", "status", "updated_at")
  SELECT location_id, business_id, "name", "address", "phone", "email", "timezone", "currency", 'ACTIVE', now()
    FROM src
  RETURNING "id"
)
UPDATE "properties" p
   SET "location_id" = s.location_id
  FROM src s
 WHERE p."id" = s.property_id;

-- reporting_currency — из фактической валюты объектов, только где она ОДНОЗНАЧНА (ровно одна различная);
-- неоднозначное и организации без объектов остаются на DEFAULT 'KZT' (§18.4) — ложных данных молча не создаём,
-- остаток виден проверочным запросом отчёта.
UPDATE "organizations" o
   SET "reporting_currency" = src.currency
  FROM (
    SELECT p."organization_id", min(p."currency") AS currency
      FROM "properties" p
     GROUP BY p."organization_id"
    HAVING count(DISTINCT p."currency") = 1
  ) src
 WHERE src."organization_id" = o."id";

-- ── Row Level Security (ADR-103, приём миграции …028) — сразу под финальную цепочку ─────────────────────────
-- businesses: организация прямо в строке; locations: через родителя-Business (его политика и режет).
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "businesses" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "locations" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "locations"."business_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "locations"."business_id"));
