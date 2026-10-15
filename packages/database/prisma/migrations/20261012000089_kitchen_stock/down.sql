-- Откат склада кухни (DATA_MODEL §34): разрушительный откат только на пустых таблицах; откат приложения данные не трогает
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM kitchen_products) OR EXISTS (SELECT 1 FROM kitchen_stock_lots) OR EXISTS (SELECT 1 FROM kitchen_stock_movements) THEN
  RAISE EXCEPTION 'Kitchen stock data present: refuse destructive rollback';
 END IF;
END $$;
DROP TABLE kitchen_stock_movements;
DROP TABLE kitchen_stock_lots;
DROP TABLE kitchen_products;
DROP FUNCTION kitchen_movements_immutable();
DROP FUNCTION kitchen_stock_guard();
DROP TYPE "KitchenMovementKind";
