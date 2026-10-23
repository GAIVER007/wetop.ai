-- Откат 142: станции и статусы строк теряются (статус заказа целиком остаётся в restaurant_orders.status),
-- «кто принял бронь» теряется. Бар снова узнаёт напитки только по названию категории (код до 142).
BEGIN;
DROP TRIGGER IF EXISTS restaurant_reservation_employee_guard ON "restaurant_reservations";
DROP FUNCTION IF EXISTS restaurant_reservation_employee_guard();
DROP INDEX IF EXISTS "restaurant_reservations_employee_id_idx";
ALTER TABLE "restaurant_reservations" DROP CONSTRAINT IF EXISTS "restaurant_reservations_employee_id_fkey";
ALTER TABLE "restaurant_reservations" DROP COLUMN IF EXISTS "employee_id";
DROP INDEX IF EXISTS "restaurant_order_items_order_station_idx";
ALTER TABLE "restaurant_order_items" DROP CONSTRAINT IF EXISTS "restaurant_order_items_ready";
ALTER TABLE "restaurant_order_items" DROP COLUMN IF EXISTS "ready_at";
ALTER TABLE "restaurant_order_items" DROP COLUMN IF EXISTS "status";
ALTER TABLE "restaurant_order_items" DROP COLUMN IF EXISTS "station";
ALTER TABLE "menu_categories" DROP COLUMN IF EXISTS "station";
DROP TYPE IF EXISTS "OrderItemStatus";
DROP TYPE IF EXISTS "MenuStation";
COMMIT;
