-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ: BEAUTY-MATERIALS-20261018.
-- Apply only with the compatible API release after backup and validation described in README.md.

BEGIN;

CREATE TABLE "beauty_service_material_revisions" (
  "service_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "beauty_service_material_revisions_pkey" PRIMARY KEY ("service_id"),
  CONSTRAINT "beauty_service_material_revisions_service_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "beauty_service_material_revisions_revision_check" CHECK ("revision" > 0)
);

CREATE TABLE "beauty_service_materials" (
  "service_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "norm_qty" DECIMAL(14,3) NOT NULL,
  "unit" VARCHAR(8) NOT NULL,
  CONSTRAINT "beauty_service_materials_pkey" PRIMARY KEY ("service_id", "product_id"),
  CONSTRAINT "beauty_service_materials_service_fkey" FOREIGN KEY ("service_id") REFERENCES "beauty_services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "beauty_service_materials_product_fkey" FOREIGN KEY ("product_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "beauty_service_materials_norm_check" CHECK ("norm_qty" > 0),
  CONSTRAINT "beauty_service_materials_unit_check" CHECK ("unit" IN ('г','мл','шт'))
);
CREATE INDEX "beauty_service_materials_product_idx" ON "beauty_service_materials"("product_id");

ALTER TABLE "kitchen_stock_movements" ADD COLUMN "appointment_line_id" UUID;
CREATE INDEX "kitchen_stock_movements_appointment_line_idx" ON "kitchen_stock_movements"("appointment_line_id");
CREATE UNIQUE INDEX "kitchen_stock_movements_appointment_line_product_lot_key"
  ON "kitchen_stock_movements"("appointment_line_id", "product_id", "lot_id")
  WHERE "appointment_line_id" IS NOT NULL;
ALTER TABLE "kitchen_stock_movements"
  ADD CONSTRAINT "kitchen_stock_movements_appointment_line_fkey"
  FOREIGN KEY ("appointment_line_id") REFERENCES "appointment_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "kitchen_stock_movements"
  ADD CONSTRAINT "kitchen_stock_movements_service_source_check" CHECK (
    ("appointment_line_id" IS NULL OR ("kind" = 'CONSUMPTION' AND "order_id" IS NULL))
    AND ("kind" <> 'CONSUMPTION' OR (("order_id" IS NOT NULL) <> ("appointment_line_id" IS NOT NULL)))
  );

CREATE OR REPLACE FUNCTION beauty_service_material_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'beauty_service_material_revisions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM beauty_services service
      JOIN businesses business ON business.id = service.business_id AND business.vertical = 'BEAUTY'
      WHERE service.id = NEW.service_id
    ) THEN RAISE EXCEPTION 'Beauty material revision requires a Beauty service'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Beauty material revision must increase by one';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM beauty_services service
      JOIN businesses business ON business.id = service.business_id AND business.vertical = 'BEAUTY'
      JOIN kitchen_products product ON product.id = NEW.product_id
        AND product.business_id = service.business_id AND product.unit = NEW.unit
      WHERE service.id = NEW.service_id
    ) THEN RAISE EXCEPTION 'Beauty material product belongs to another business or unit'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "beauty_service_material_revisions_guard"
  BEFORE INSERT OR UPDATE ON "beauty_service_material_revisions"
  FOR EACH ROW EXECUTE FUNCTION beauty_service_material_guard();
CREATE TRIGGER "beauty_service_materials_guard"
  BEFORE INSERT OR UPDATE ON "beauty_service_materials"
  FOR EACH ROW EXECUTE FUNCTION beauty_service_material_guard();

-- Общий склад доступен только ресторанам и салонам. Menu и restaurant entities не расширяются.
CREATE OR REPLACE FUNCTION kitchen_stock_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz uuid;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'kitchen_products' THEN
  IF TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.business_id AND vertical IN ('FOOD_SERVICE','BEAUTY')) THEN RAISE EXCEPTION 'Food or Beauty business required'; END IF;
 WHEN 'kitchen_stock_lots', 'kitchen_stock_movements' THEN
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.product_id <> OLD.product_id) THEN RAISE EXCEPTION 'Kitchen parent is immutable'; END IF;
  SELECT p.business_id INTO biz FROM kitchen_products p WHERE p.id = NEW.product_id;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = NEW.location_id AND business_id = biz) THEN RAISE EXCEPTION 'Kitchen product belongs to another business'; END IF;
  IF TG_TABLE_NAME = 'kitchen_stock_movements' THEN
   IF NEW.lot_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM kitchen_stock_lots WHERE id = NEW.lot_id AND location_id = NEW.location_id AND product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'Kitchen lot belongs to another location or product';
   END IF;
  END IF;
 END CASE;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION kitchen_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'menu_item_ingredients' THEN
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM kitchen_products p JOIN menu_items m ON m.business_id = p.business_id
    WHERE p.id = NEW.product_id AND m.id = NEW.menu_item_id AND p.unit = NEW.unit) THEN
   RAISE EXCEPTION 'Tech card product belongs to another business or unit';
  END IF;
 ELSE
  IF NEW.order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM restaurant_orders o WHERE o.id = NEW.order_id AND o.location_id = NEW.location_id) THEN
   RAISE EXCEPTION 'Stock movement order belongs to another location';
  END IF;
  IF NEW.appointment_line_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM appointment_lines line
    JOIN appointments appointment ON appointment.id = line.appointment_id
    WHERE line.id = NEW.appointment_line_id AND appointment.location_id = NEW.location_id) THEN
   RAISE EXCEPTION 'Stock movement appointment line belongs to another location';
  END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER TABLE "beauty_service_material_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beauty_service_material_revisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "beauty_service_material_revisions" TO wetop_app USING (EXISTS (
  SELECT 1 FROM beauty_services service JOIN businesses business ON business.id = service.business_id
  WHERE service.id = beauty_service_material_revisions.service_id AND business.organization_id = app_current_org()
)) WITH CHECK (EXISTS (
  SELECT 1 FROM beauty_services service JOIN businesses business ON business.id = service.business_id
  WHERE service.id = beauty_service_material_revisions.service_id AND business.organization_id = app_current_org()
));
ALTER TABLE "beauty_service_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beauty_service_materials" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "beauty_service_materials" TO wetop_app USING (EXISTS (
  SELECT 1 FROM beauty_services service JOIN businesses business ON business.id = service.business_id
  WHERE service.id = beauty_service_materials.service_id AND business.organization_id = app_current_org()
)) WITH CHECK (EXISTS (
  SELECT 1 FROM beauty_services service JOIN businesses business ON business.id = service.business_id
  WHERE service.id = beauty_service_materials.service_id AND business.organization_id = app_current_org()
));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "beauty_service_materials" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE ON TABLE "beauty_service_material_revisions" TO wetop_app, wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_service_material_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.kitchen_stock_guard() SET search_path = %s',s,path);
  EXECUTE format('ALTER FUNCTION %I.kitchen_link_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
