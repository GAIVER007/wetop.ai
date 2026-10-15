-- SITE-3 (ADR-185, plans/site-seo-flow-2026-10-15.md §6; DATA_MODEL §11 и §29.12, v2.30): конструктор сайта и сайт
-- счётчика для всех направлений. Владелец сайта счётчика теперь филиал (`location_id`); объект гостиницы
-- (`property_id`) остаётся только у гостиничных сайтов: по нему считаются цены и бронь `/w/book`.
-- Миграцию применяет владелец (AGENTS.md §15).

-- 1. Филиал сайта счётчика: колонка, заполнение из объекта, внешний ключ, индекс
ALTER TABLE "tracked_sites" ADD COLUMN "location_id" UUID;
UPDATE "tracked_sites" t SET "location_id" = p."location_id" FROM "properties" p WHERE p."id" = t."property_id";
ALTER TABLE "tracked_sites" ALTER COLUMN "property_id" DROP NOT NULL;
ALTER TABLE "tracked_sites" ADD CONSTRAINT "tracked_sites_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "tracked_sites_location_id_idx" ON "tracked_sites"("location_id");
-- Филиал есть всегда: прежние пути, которые знают только объект, получают его из триггера ниже
ALTER TABLE "tracked_sites" ADD CONSTRAINT "tracked_sites_location_required" CHECK ("location_id" IS NOT NULL);

-- 2. Объект и филиал сайта согласованы: объект заполняет филиал, если его нет; заданный объект обязан быть объектом
-- этого филиала; филиал после создания не меняется (аналитика и заявки сайта принадлежат филиалу)
CREATE FUNCTION tracked_site_location_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc uuid;
BEGIN
 IF NEW.property_id IS NOT NULL THEN
  SELECT p.location_id INTO loc FROM properties p WHERE p.id = NEW.property_id;
  IF NEW.location_id IS NULL THEN
   NEW.location_id := loc;
  ELSIF loc IS DISTINCT FROM NEW.location_id THEN
   RAISE EXCEPTION 'tracked_sites: объект сайта принадлежит другому филиалу';
  END IF;
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.location_id IS DISTINCT FROM OLD.location_id THEN
  RAISE EXCEPTION 'tracked_sites: филиал сайта не меняется';
 END IF;
 RETURN NEW;
END $$;

-- 3. Сайт управляемого сайта и канонический сайт брони: сайт счётчика того же филиала (по филиалу, а не по объекту)
CREATE OR REPLACE FUNCTION marketing_site_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN
  RAISE EXCEPTION 'marketing_sites: филиал сайта не меняется';
 END IF;
 IF NEW.tracked_site_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM tracked_sites t WHERE t.id = NEW.tracked_site_id AND t.location_id = NEW.location_id) THEN
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
   SELECT 1 FROM tracked_sites t WHERE t.id = NEW.booking_tracked_site_id AND t.location_id = NEW.id) THEN
  RAISE EXCEPTION 'locations: сайт брони принадлежит объекту другого филиала';
 END IF;
 RETURN NEW;
END $$;

-- 4. Лицензия конструктора: любой филиал (гостиница, салон, ресторан); филиал лицензии по-прежнему не меняется
CREATE OR REPLACE FUNCTION site_builder_entitlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.location_id IS DISTINCT FROM OLD.location_id AND TG_OP = 'UPDATE' THEN
  RAISE EXCEPTION 'site_builder_entitlements: филиал лицензии не меняется';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = NEW.location_id) THEN
  RAISE EXCEPTION 'site_builder_entitlements: филиал не найден';
 END IF;
 RETURN NEW;
END $$;

-- 5. Организация записи журнала о сайте счётчика: через филиал, у сайта без объекта его нет
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
      WHEN 'TrackedSite' THEN (SELECT b."organization_id" FROM "tracked_sites" s
                                 JOIN "locations" l ON l."id" = s."location_id"
                                 JOIN "businesses" b ON b."id" = l."business_id" WHERE s."id"::text = eid)
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

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
 EXECUTE format('ALTER FUNCTION %I.tracked_site_location_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.marketing_site_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.location_booking_site_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.site_builder_entitlement_guard() SET search_path = %s', s, path);
 EXECUTE format('ALTER FUNCTION %I.app_audit_organization(text, text, uuid) SET search_path = %s', s, path);
END $$;

CREATE TRIGGER tracked_site_location_guard BEFORE INSERT OR UPDATE ON "tracked_sites"
  FOR EACH ROW EXECUTE FUNCTION tracked_site_location_guard();

-- 6. Изоляция (§17): сайт счётчика своей организации по цепочке филиал → бизнес, как у управляемого сайта; прежняя
-- политика по объекту прятала бы сайт салона и ресторана целиком
DROP POLICY IF EXISTS rls_tenant ON "tracked_sites";
CREATE POLICY rls_tenant ON "tracked_sites" FOR ALL TO wetop_app
  USING (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
                  WHERE l.id = location_id AND b.organization_id = app_current_org()))
  WITH CHECK (EXISTS (SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
                  WHERE l.id = location_id AND b.organization_id = app_current_org()));
