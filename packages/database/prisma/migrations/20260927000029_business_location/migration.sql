-- Фаза Business + Location (DATA_MODEL v2.0/v2.2 §18, ADR-104; план plans/phase-business-location-2026-09-27.md,
-- утверждён владельцем 27.09.2026 с восемью уточнениями). Одна additive-миграция: уровни владения между
-- организацией и объектом. Ничего не удаляется и не переименовывается; ни один существующий ID не меняется.
-- Применяет владелец (AGENTS.md §14–§15): копия базы → миграция → проверка (отчёт
-- scripts/ops/phase-business-location-report.sql) → путь отката (down.sql).
--
-- reporting_currency — NULL, БЕЗ DEFAULT (уточнение 4): слепой 'KZT' создал бы ложные данные организации
-- с объектом в другой валюте; заполняется только backfill ниже, неоднозначное остаётся NULL и попадает в отчёт.
-- NOT NULL на properties.location_id НЕ вводится и заранее не объявляется (уточнение 5): будущий gate владельца.

-- ── Схема (DDL — prisma migrate diff, паритет со schema.prisma) ──────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "BusinessVertical" AS ENUM ('HOSPITALITY', 'BEAUTY');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "reporting_currency" VARCHAR(3);

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "location_id" UUID;

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "vertical" "BusinessVertical" NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "businesses_organization_id_idx" ON "businesses"("organization_id");

-- CreateIndex
CREATE INDEX "locations_business_id_idx" ON "locations"("business_id");

-- CreateIndex
CREATE INDEX "properties_location_id_idx" ON "properties"("location_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Backfill (данными, та же транзакция) — строго по Organization (уточнение 3) ─────────────────────────────
-- Organization с объектами → ровно ОДИН Business (name = имя организации, не объекта) → Location на каждый
-- Property (name/контакты/таймзона/валюта — из строки Property) → properties.location_id.
-- Никакой идентификации по совпадению названий: только строки properties и FK properties.organization_id.
-- Организации без объекта не получают ничего (их цепочку создаст онбординг); «ничей» объект
-- (organization_id IS NULL — на боевой базе таких нет после …27) остаётся с location_id IS NULL и виден в отчёте.

INSERT INTO "businesses" ("id", "organization_id", "name", "vertical", "status", "updated_at")
SELECT gen_random_uuid(), o."id", o."name", 'HOSPITALITY', 'ACTIVE', now()
  FROM "organizations" o
 WHERE EXISTS (SELECT 1 FROM "properties" p WHERE p."organization_id" = o."id");

-- Location на каждый объект; цикл вместо INSERT..SELECT, чтобы созданный id тут же встал в properties.location_id
DO $$
DECLARE p record; biz uuid; loc uuid;
BEGIN
  FOR p IN SELECT pr."id", pr."organization_id", pr."name", pr."address", pr."phone", pr."email",
                  pr."timezone", pr."currency"
             FROM "properties" pr WHERE pr."organization_id" IS NOT NULL ORDER BY pr."created_at" LOOP
    SELECT b."id" INTO STRICT biz FROM "businesses" b WHERE b."organization_id" = p."organization_id";
    loc := gen_random_uuid();
    INSERT INTO "locations" ("id", "business_id", "name", "address", "phone", "email", "timezone", "currency", "updated_at")
    VALUES (loc, biz, p."name", p."address", p."phone", p."email", p."timezone", p."currency", now());
    UPDATE "properties" SET "location_id" = loc WHERE "id" = p."id";
  END LOOP;
END $$;

-- Отчётная валюта (уточнение 4): у всех объектов организации одна валюта — берётся она (Luxx → KZT);
-- несколько валют или нет объектов — остаётся NULL, счётчик в NOTICE и в отчёте фазы.
UPDATE "organizations" o
   SET "reporting_currency" = src.currency
  FROM (SELECT p."organization_id" AS org, min(p."currency") AS currency
          FROM "properties" p
         WHERE p."organization_id" IS NOT NULL
         GROUP BY p."organization_id"
        HAVING count(DISTINCT p."currency") = 1) src
 WHERE src.org = o."id" AND o."reporting_currency" IS NULL;

DO $$
DECLARE orphan int; nocur int; multi int;
BEGIN
  SELECT count(*) INTO orphan FROM "properties" WHERE "location_id" IS NULL;
  SELECT count(*) INTO nocur  FROM "organizations" WHERE "reporting_currency" IS NULL;
  SELECT count(*) INTO multi  FROM (SELECT 1 FROM "properties" WHERE "organization_id" IS NOT NULL
                                     GROUP BY "organization_id" HAVING count(DISTINCT "currency") > 1) m;
  RAISE NOTICE 'business_location backfill: объектов без location_id — %, организаций без reporting_currency — %, организаций с разными валютами объектов — %',
    orphan, nocur, multi;
END $$;

-- ── Row Level Security новых таблиц (уточнение 6; стиль ADR-103, миграция …28) ──────────────────────────────
-- TO wetop_app без FORCE: владелец таблиц и служебная роль политик не видят; businesses — по organization_id
-- прямо, locations — через родителя (его политика режет сама, как floors → buildings). Рекурсии нет:
-- подзапрос к businesses уже отфильтрован его собственной политикой — это и есть требуемое поведение.

ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "businesses" FOR ALL TO wetop_app
  USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org());

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "locations" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "locations"."business_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "businesses" parent WHERE parent."id" = "locations"."business_id"));
