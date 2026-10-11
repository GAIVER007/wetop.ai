-- Откат ресторана v2 (DATA_MODEL §33): таблицы пустые или данные владелец снял сам
DROP TABLE IF EXISTS "restaurant_order_items";
DROP TABLE IF EXISTS "restaurant_orders";
DROP TABLE IF EXISTS "menu_item_ingredients";
DROP TABLE IF EXISTS "menu_items";
DROP TABLE IF EXISTS "menu_categories";
DROP TABLE IF EXISTS "employee_pay_adjustments";
DROP TABLE IF EXISTS "employee_pay_settings";
DROP FUNCTION IF EXISTS restaurant_module_guard();
DROP TYPE IF EXISTS "RestaurantOrderStatus";
DROP TYPE IF EXISTS "EmployeePayModel";
ALTER TABLE "dining_tables" DROP COLUMN IF EXISTS "needs_cleaning";
