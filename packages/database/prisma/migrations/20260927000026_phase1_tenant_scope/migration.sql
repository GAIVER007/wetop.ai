-- Phase 1 изоляции (ADR-100 §17.2, DATA_MODEL v2.1, поручение владельца 27.09.2026).
-- Применяет владелец руками (AGENTS.md §15): backup → migrate deploy → проверка → путь отката.
--
-- Зачем: у guests, audit_logs, external_events и channel_outbox не было tenant-scope вообще —
-- принадлежность выводилась только цепочками связей или не выводилась никак (аудит
-- reports/beauty-vertical-audit-2026-09-27.md §C.4/§C.8/§C.10). Перед подключением второго
-- Partner/Organization каждая строка должна знать, чья она.
--
-- Правила backfill — детерминированные, без угадывания (поручение владельца):
--   guests            → организация объекта её броней (primary_guest_id + stay_guests-цепочка),
--                       только когда все брони гостя дают РОВНО ОДНУ организацию;
--   audit_logs        → (а) по сущности через её таблицу к properties.organization_id,
--                       (б) остатки — по автору, у которого РОВНО ОДНО членство;
--   external_events   → единственный объект, имеющий channel_mappings этого провайдера;
--   channel_outbox    → так же.
-- Всё, что не выводится однозначно, остаётся NULL и считается отчётом
-- scripts/ops/phase1-scope-report.sql. NOT NULL не вводится.

-- ───────────────────────── 1. guests.organization_id ─────────────────────────

ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "organization_id" UUID;

ALTER TABLE "guests" DROP CONSTRAINT IF EXISTS "guests_organization_id_fkey";
ALTER TABLE "guests"
  ADD CONSTRAINT "guests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "guests_organization_id_idx" ON "guests" ("organization_id");

WITH guest_orgs AS (
  SELECT sg."guest_id" AS guest_id, p."organization_id"
    FROM "stay_guests" sg
    JOIN "reservation_items" i ON i."id" = sg."reservation_item_id"
    JOIN "reservations" r ON r."id" = i."reservation_id"
    JOIN "properties" p ON p."id" = r."property_id"
   WHERE p."organization_id" IS NOT NULL
  UNION
  SELECT r."primary_guest_id" AS guest_id, p."organization_id"
    FROM "reservations" r
    JOIN "properties" p ON p."id" = r."property_id"
   WHERE r."primary_guest_id" IS NOT NULL AND p."organization_id" IS NOT NULL
), unambiguous AS (
  SELECT guest_id, min("organization_id"::text)::uuid AS organization_id
    FROM guest_orgs
   GROUP BY guest_id
  HAVING count(DISTINCT "organization_id") = 1
)
UPDATE "guests" g
   SET "organization_id" = u.organization_id
  FROM unambiguous u
 WHERE g."id" = u.guest_id AND g."organization_id" IS NULL;

-- ───────────────────────── 2. audit_logs.organization_id ─────────────────────────

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_organization_id_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs" ("organization_id");

-- Журнал append-only (триггер audit_logs_immutable, миграция 20260925000022) — это правило для
-- приложения. Разовое обогащение новой колонкой санкционировано ADR-100; триггер выключается
-- только внутри этой транзакции и включается ниже. Содержимое строк (кто/что/когда/before/after)
-- не меняется — заполняется только новая пустая колонка.
ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_immutable";

-- (а) по сущности: тип за типом, каждая связка — по первичному ключу своей таблицы
UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "properties" p
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'Property' AND a."entity_id" = p."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "reservations" r JOIN "properties" p ON p."id" = r."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'Reservation' AND a."entity_id" = r."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "reservation_items" i
  JOIN "reservations" r ON r."id" = i."reservation_id"
  JOIN "properties" p ON p."id" = r."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'ReservationItem' AND a."entity_id" = i."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "folios" f
  JOIN "reservation_items" i ON i."id" = f."reservation_item_id"
  JOIN "reservations" r ON r."id" = i."reservation_id"
  JOIN "properties" p ON p."id" = r."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'Folio' AND a."entity_id" = f."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "payments" pay JOIN "properties" p ON p."id" = pay."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'Payment' AND a."entity_id" = pay."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "inventory_units" u JOIN "properties" p ON p."id" = u."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'InventoryUnit' AND a."entity_id" = u."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "inventory_blocks" b
  JOIN "inventory_units" u ON u."id" = b."inventory_unit_id"
  JOIN "properties" p ON p."id" = u."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'InventoryBlock' AND a."entity_id" = b."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "accommodation_types" t JOIN "properties" p ON p."id" = t."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'AccommodationType' AND a."entity_id" = t."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "rate_plans" rp JOIN "properties" p ON p."id" = rp."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'RatePlan' AND a."entity_id" = rp."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "channel_mappings" cm JOIN "properties" p ON p."id" = cm."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'ChannelMapping' AND a."entity_id" = cm."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "services" s JOIN "properties" p ON p."id" = s."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'Service' AND a."entity_id" = s."id"::text;

UPDATE "audit_logs" a SET "organization_id" = p."organization_id"
  FROM "tracked_sites" ts JOIN "properties" p ON p."id" = ts."property_id"
 WHERE a."organization_id" IS NULL AND p."organization_id" IS NOT NULL
   AND a."entity_type" = 'TrackedSite' AND a."entity_id" = ts."id"::text;

-- Гости — по только что заполненной guests.organization_id (шаг 1)
UPDATE "audit_logs" a SET "organization_id" = g."organization_id"
  FROM "guests" g
 WHERE a."organization_id" IS NULL AND g."organization_id" IS NOT NULL
   AND a."entity_type" = 'Guest' AND a."entity_id" = g."id"::text;

UPDATE "audit_logs" a SET "organization_id" = sp."organization_id"
  FROM "seller_profiles" sp
 WHERE a."organization_id" IS NULL
   AND a."entity_type" = 'SellerProfile' AND a."entity_id" = sp."organization_id"::text;

-- (б) остатки — по автору, у которого ровно одно членство: у кого их больше, вывод неоднозначен
UPDATE "audit_logs" a SET "organization_id" = m.organization_id
  FROM (SELECT "user_id", min("organization_id"::text)::uuid AS organization_id
          FROM "memberships" GROUP BY "user_id" HAVING count(*) = 1) m
 WHERE a."organization_id" IS NULL AND a."user_id" = m."user_id";

ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_immutable";

-- ───────────────────────── 3. external_events.property_id ─────────────────────────

ALTER TABLE "external_events" ADD COLUMN IF NOT EXISTS "property_id" UUID;

ALTER TABLE "external_events" DROP CONSTRAINT IF EXISTS "external_events_property_id_fkey";
ALTER TABLE "external_events"
  ADD CONSTRAINT "external_events_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "external_events_property_id_idx" ON "external_events" ("property_id");

-- Единственный объект с сопоставлениями провайдера. Ноль или больше одного — NULL (в отчёт).
UPDATE "external_events" e
   SET "property_id" = s.property_id
  FROM (SELECT "provider", min("property_id"::text)::uuid AS property_id
          FROM "channel_mappings" GROUP BY "provider" HAVING count(DISTINCT "property_id") = 1) s
 WHERE e."property_id" IS NULL AND e."provider" = s."provider";

-- ───────────────────────── 4. channel_outbox.property_id ─────────────────────────

ALTER TABLE "channel_outbox" ADD COLUMN IF NOT EXISTS "property_id" UUID;

ALTER TABLE "channel_outbox" DROP CONSTRAINT IF EXISTS "channel_outbox_property_id_fkey";
ALTER TABLE "channel_outbox"
  ADD CONSTRAINT "channel_outbox_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "channel_outbox_property_id_idx" ON "channel_outbox" ("property_id");

UPDATE "channel_outbox" o
   SET "property_id" = s.property_id
  FROM (SELECT "provider", min("property_id"::text)::uuid AS property_id
          FROM "channel_mappings" GROUP BY "provider" HAVING count(DISTINCT "property_id") = 1) s
 WHERE o."property_id" IS NULL AND o."provider" = s."provider";
