-- Списание склада по заказу (DATA_MODEL §38, v2.21, ADR-168; Q-KITCHEN-5, Q-KITCHEN-6)

-- AlterEnum (PostgreSQL 12+ позволяет несколько значений в одной миграции; новые значения здесь не используются)
ALTER TYPE "KitchenMovementKind" ADD VALUE 'CONSUMPTION';
ALTER TYPE "KitchenMovementKind" ADD VALUE 'SHORTAGE';
ALTER TYPE "KitchenMovementKind" ADD VALUE 'CONSUMPTION_RETURN';

-- AlterTable
ALTER TABLE "kitchen_stock_movements" ADD COLUMN     "order_id" UUID;

-- AlterTable
ALTER TABLE "menu_item_ingredients" ADD COLUMN     "product_id" UUID;

-- CreateIndex
CREATE INDEX "kitchen_stock_movements_order_id_idx" ON "kitchen_stock_movements"("order_id");

-- AddForeignKey
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "kitchen_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stock_movements" ADD CONSTRAINT "kitchen_stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Связи §38: продукт техкарты того же бизнеса и той же единицы; заказ движения того же филиала
CREATE FUNCTION kitchen_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
 END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.kitchen_link_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER kitchen_link_guard BEFORE INSERT OR UPDATE ON menu_item_ingredients FOR EACH ROW EXECUTE FUNCTION kitchen_link_guard();
CREATE TRIGGER kitchen_link_guard BEFORE INSERT ON kitchen_stock_movements FOR EACH ROW EXECUTE FUNCTION kitchen_link_guard();
