-- Откат SITE-3 (20261015000108_site_builder_all_verticals). Сайты счётчика без объекта (салон, ресторан) и лицензии
-- конструктора не гостиничных филиалов прежняя схема не держит: перед откатом их снимает владелец
-- (`DELETE FROM site_leads`, затем сайты и `site_builder_entitlements` не гостиничных филиалов), иначе откат
-- остановится на NOT NULL. Перед откатом снять копию (`docs/deploy.md`).
DROP POLICY IF EXISTS rls_tenant ON "tracked_sites";
CREATE POLICY rls_tenant ON "tracked_sites" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));

DROP TRIGGER IF EXISTS tracked_site_location_guard ON "tracked_sites";
DROP FUNCTION IF EXISTS tracked_site_location_guard();

CREATE OR REPLACE FUNCTION marketing_site_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN
  RAISE EXCEPTION 'marketing_sites: филиал сайта не меняется';
 END IF;
 IF NEW.tracked_site_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM tracked_sites t JOIN properties p ON p.id = t.property_id
    WHERE t.id = NEW.tracked_site_id AND p.location_id = NEW.location_id) THEN
  RAISE EXCEPTION 'marketing_sites: tracked_site_id принадлежит объекту другого филиала';
 END IF;
 IF NEW.latest_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.latest_version_id AND v.site_id = NEW.id) THEN
  RAISE EXCEPTION 'marketing_sites: latest_version_id указывает на версию другого сайта';
 END IF;
 IF NEW.published_version_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM marketing_site_versions v WHERE v.id = NEW.published_version_id AND v.site_id = NEW.id) THEN
  RAISE EXCEPTION 'marketing_sites: published_version_id указывает на версию другого сайта';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION location_booking_site_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.booking_tracked_site_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM tracked_sites t JOIN properties p ON p.id = t.property_id
    WHERE t.id = NEW.booking_tracked_site_id AND p.location_id = NEW.id) THEN
  RAISE EXCEPTION 'locations: сайт брони принадлежит объекту другого филиала';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION site_builder_entitlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.location_id IS DISTINCT FROM OLD.location_id AND TG_OP = 'UPDATE' THEN
  RAISE EXCEPTION 'site_builder_entitlements: филиал лицензии не меняется';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
    WHERE l.id = NEW.location_id AND b.vertical = 'HOSPITALITY') THEN
  RAISE EXCEPTION 'site_builder_entitlements: конструктор сайта только у гостиничного филиала';
 END IF;
 RETURN NEW;
END $$;

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

-- CREATE OR REPLACE сбрасывает закреплённый search_path (миграция …043): закрепляем снова, как было
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.marketing_site_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.location_booking_site_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.site_builder_entitlement_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.app_audit_organization(text, text, uuid) SET search_path = %s', s, path);
END $$;

ALTER TABLE "tracked_sites" DROP CONSTRAINT IF EXISTS "tracked_sites_location_required";
ALTER TABLE "tracked_sites" DROP CONSTRAINT IF EXISTS "tracked_sites_location_id_fkey";
DROP INDEX IF EXISTS "tracked_sites_location_id_idx";
ALTER TABLE "tracked_sites" DROP COLUMN IF EXISTS "location_id";
ALTER TABLE "tracked_sites" ALTER COLUMN "property_id" SET NOT NULL;
