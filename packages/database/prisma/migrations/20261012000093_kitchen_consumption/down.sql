-- Откат §38: движения новых видов должны быть сняты владельцем (перечисление пересоздаётся без них)
DROP TRIGGER IF EXISTS kitchen_link_guard ON menu_item_ingredients;
DROP TRIGGER IF EXISTS kitchen_link_guard ON kitchen_stock_movements;
DROP FUNCTION IF EXISTS kitchen_link_guard();
ALTER TABLE "kitchen_stock_movements" DROP CONSTRAINT IF EXISTS "kitchen_stock_movements_order_id_fkey";
ALTER TABLE "menu_item_ingredients" DROP CONSTRAINT IF EXISTS "menu_item_ingredients_product_id_fkey";
DROP INDEX IF EXISTS "kitchen_stock_movements_order_id_idx";
ALTER TABLE "kitchen_stock_movements" DROP COLUMN IF EXISTS "order_id";
ALTER TABLE "menu_item_ingredients" DROP COLUMN IF EXISTS "product_id";
ALTER TYPE "KitchenMovementKind" RENAME TO "KitchenMovementKind_old";
CREATE TYPE "KitchenMovementKind" AS ENUM ('RECEIPT', 'WRITE_OFF', 'INVENTORY', 'REVERSAL');
ALTER TABLE "kitchen_stock_movements" ALTER COLUMN "kind" TYPE "KitchenMovementKind" USING ("kind"::text::"KitchenMovementKind");
DROP TYPE "KitchenMovementKind_old";
