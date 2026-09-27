-- DATA_MODEL v1.13 §17.1 (ADR-103), план plans/rls-2026-09-27.md п. 3: у каждой строки арендатора — своя организация.
-- Применяет владелец (AGENTS.md §9, §14): копия базы → миграция → проверка → откат (down.sql).
--
-- 27.09.2026 (слияние с Phase 1, ADR-100 §17.2): колонки guests.organization_id и audit_logs.organization_id уже
-- созданы миграцией 20260927000026_phase1_tenant_scope и ПРИМЕНЕНЫ на рабочей базе. Эта миграция сделана
-- идемпотентной к ним: колонки/индексы — IF NOT EXISTS, FK пересоздаются на определения ADR-103, backfill
-- журнала заполняет только NULL (значения, проставленные кодом Phase 1, не перезаписываются).

-- Организация текущего запроса роли wetop_app (§17.2). Пусто — NULL: политики не пропустят ни одной строки.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;

-- ── Объект без организации ────────────────────────────────────────────────────────────────────────────────────
-- На боевой базе таких строк нет (миграция …16 привязала объекты к самой старой организации). Если организаций нет
-- совсем (пустая локальная база) — объекту заводится своя, названная его именем, чтобы NOT NULL встал без потерь.
INSERT INTO "organizations" ("id", "name", "status")
SELECT gen_random_uuid(), p."name", 'ACTIVE'
  FROM "properties" p
 WHERE p."organization_id" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "organizations");
UPDATE "properties"
   SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "organization_id" IS NULL;
ALTER TABLE "properties" ALTER COLUMN "organization_id" SET NOT NULL;

-- ── Гость принадлежит своей организации (RLS-1) ───────────────────────────────────────────────────────────────
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "organization_id" UUID;

-- Гость в бронях двух организаций — остановка: разделить такого гостя молча нельзя (до RLS реальные данные только у Luxx)
DO $$
DECLARE shared int;
BEGIN
  SELECT count(*) INTO shared FROM (
    SELECT g.guest_id FROM (
      SELECT r."primary_guest_id" AS guest_id, p."organization_id" AS org
        FROM "reservations" r JOIN "properties" p ON p."id" = r."property_id" WHERE r."primary_guest_id" IS NOT NULL
      UNION
      SELECT sg."guest_id", p."organization_id"
        FROM "stay_guests" sg
        JOIN "reservation_items" i ON i."id" = sg."reservation_item_id"
        JOIN "reservations" r ON r."id" = i."reservation_id"
        JOIN "properties" p ON p."id" = r."property_id"
    ) g GROUP BY g.guest_id HAVING count(DISTINCT g.org) > 1
  ) x;
  IF shared > 0 THEN
    RAISE EXCEPTION 'guests: % гостей в бронях разных организаций — разделить руками до миграции (DATA_MODEL §17.1)', shared;
  END IF;
END $$;

UPDATE "guests" g SET "organization_id" = src.org
  FROM (
    SELECT r."primary_guest_id" AS guest_id, p."organization_id" AS org
      FROM "reservations" r JOIN "properties" p ON p."id" = r."property_id" WHERE r."primary_guest_id" IS NOT NULL
    UNION
    SELECT sg."guest_id", p."organization_id"
      FROM "stay_guests" sg
      JOIN "reservation_items" i ON i."id" = sg."reservation_item_id"
      JOIN "reservations" r ON r."id" = i."reservation_id"
      JOIN "properties" p ON p."id" = r."property_id"
  ) src
 WHERE src.guest_id = g."id";
-- гость без броней — самой старой организации (как объекты в …16)
UPDATE "guests"
   SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "organization_id" IS NULL;

ALTER TABLE "guests" ALTER COLUMN "organization_id" SET NOT NULL;
-- запрос организации может не передавать её явно: берётся из переменной (служебный путь передаёт сам)
ALTER TABLE "guests" ALTER COLUMN "organization_id" SET DEFAULT app_current_org();
ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_organization_id_fkey";
ALTER TABLE "guests"
  ADD CONSTRAINT "guests_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "guests_organization_id_idx" ON "guests"("organization_id");

-- ── Журнал: чья запись ────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_organization_id_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- Организация сущности записи журнала — те же правила, что ownAuditRows в apps/api/src/audit/audit.module.ts.
-- Не нашлась — организация автора; нет и её — NULL (платформа, система).
CREATE OR REPLACE FUNCTION app_audit_organization(et text, eid text, uid uuid) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    CASE et
      WHEN 'organization' THEN (SELECT o."id" FROM "organizations" o WHERE o."id"::text = eid)
      WHEN 'SellerProfile' THEN (SELECT o."id" FROM "organizations" o WHERE o."id"::text = eid)
      WHEN 'Property' THEN (SELECT p."organization_id" FROM "properties" p WHERE p."id"::text = eid)
      WHEN 'Reservation' THEN (SELECT p."organization_id" FROM "reservations" r
                                 JOIN "properties" p ON p."id" = r."property_id" WHERE r."id"::text = eid)
      WHEN 'ReservationItem' THEN (SELECT p."organization_id" FROM "reservation_items" i
                                     JOIN "reservations" r ON r."id" = i."reservation_id"
                                     JOIN "properties" p ON p."id" = r."property_id" WHERE i."id"::text = eid)
      WHEN 'Folio' THEN (SELECT p."organization_id" FROM "folios" f
                           JOIN "reservation_items" i ON i."id" = f."reservation_item_id"
                           JOIN "reservations" r ON r."id" = i."reservation_id"
                           JOIN "properties" p ON p."id" = r."property_id" WHERE f."id"::text = eid)
      WHEN 'Payment' THEN (SELECT p."organization_id" FROM "payments" pay
                             JOIN "properties" p ON p."id" = pay."property_id" WHERE pay."id"::text = eid)
      WHEN 'InventoryUnit' THEN (SELECT p."organization_id" FROM "inventory_units" u
                                   JOIN "properties" p ON p."id" = u."property_id" WHERE u."id"::text = eid)
      WHEN 'TrackedSite' THEN (SELECT p."organization_id" FROM "tracked_sites" s
                                 JOIN "properties" p ON p."id" = s."property_id" WHERE s."id"::text = eid)
      WHEN 'accommodation_type' THEN (SELECT p."organization_id" FROM "accommodation_types" t
                                        JOIN "properties" p ON p."id" = t."property_id" WHERE t."id"::text = eid)
      WHEN 'physical_room' THEN (SELECT p."organization_id" FROM "physical_rooms" pr
                                   JOIN "floors" f ON f."id" = pr."floor_id"
                                   JOIN "buildings" b ON b."id" = f."building_id"
                                   JOIN "properties" p ON p."id" = b."property_id" WHERE pr."id"::text = eid)
      WHEN 'Guest' THEN (SELECT g."organization_id" FROM "guests" g WHERE g."id"::text = eid)
      WHEN 'user' THEN (SELECT m."organization_id" FROM "memberships" m
                          WHERE m."user_id"::text = eid ORDER BY m."created_at" ASC LIMIT 1)
    END,
    (SELECT m."organization_id" FROM "memberships" m WHERE m."user_id" = uid ORDER BY m."created_at" ASC LIMIT 1)
  )
$$;

-- Старые записи: журнал только дописывается. Флаг wetop.audit_purge НЕ подходит: под ним триггер
-- audit_logs_immutable возвращает OLD и молча превращает UPDATE в no-op (…22). Поэтому, как и в
-- 20260927000026_phase1_tenant_scope, триггер выключается только внутри транзакции этой миграции.
ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_immutable";
UPDATE "audit_logs"
   SET "organization_id" = COALESCE(
     app_audit_organization("entity_type", "entity_id", "user_id"),
     (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1))
 WHERE "organization_id" IS NULL;
ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_immutable";

-- Новые записи: организация запроса, иначе — по сущности (фоновые циклы пишут без переменной)
CREATE OR REPLACE FUNCTION audit_logs_organization() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."organization_id" IS NULL THEN
    NEW."organization_id" := COALESCE(app_current_org(),
      app_audit_organization(NEW."entity_type", NEW."entity_id", NEW."user_id"));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_logs_organization
  BEFORE INSERT ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_organization();
