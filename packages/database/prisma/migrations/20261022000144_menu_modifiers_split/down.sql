-- Откат 144: теряются группы модификаторов, их связь с блюдами, снимки выбранных модификаторов строк и разбивка
-- платежей по строкам. Цены строк заморожены в restaurant_order_items.price, суммы заказов и платежи остаются верными.
BEGIN;
DROP TRIGGER IF EXISTS restaurant_order_item_paid_guard ON "restaurant_order_items";
DROP TRIGGER IF EXISTS restaurant_payment_items_release ON "restaurant_payments";
DROP TABLE IF EXISTS "restaurant_payment_items";
DROP TABLE IF EXISTS "restaurant_order_item_modifiers";
DROP TABLE IF EXISTS "menu_item_modifier_groups";
DROP TABLE IF EXISTS "menu_modifiers";
DROP TABLE IF EXISTS "menu_modifier_groups";
DROP FUNCTION IF EXISTS restaurant_order_item_paid_guard();
DROP FUNCTION IF EXISTS restaurant_payment_items_release();
DROP FUNCTION IF EXISTS restaurant_modifier_guard();
COMMIT;
