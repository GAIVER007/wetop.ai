-- Откат BAR1 удаляет весь товарный учет бара. Перед откатом обязателен backup.
DROP TRIGGER IF EXISTS "bar_receipts_property_guard" ON "bar_receipts";
DROP TRIGGER IF EXISTS "bar_products_property_guard" ON "bar_products";
DROP FUNCTION IF EXISTS bar_property_guard();
DROP TABLE IF EXISTS "bar_supplier_payments";
DROP TABLE IF EXISTS "bar_sale_lines";
DROP TABLE IF EXISTS "bar_sales";
DROP TABLE IF EXISTS "bar_stock_movements";
DROP TABLE IF EXISTS "bar_stock_lots";
DROP TABLE IF EXISTS "bar_receipt_lines";
DROP TABLE IF EXISTS "bar_receipts";
DROP TABLE IF EXISTS "bar_suppliers";
DROP TABLE IF EXISTS "bar_products";
DROP TABLE IF EXISTS "bar_categories";
DROP TYPE IF EXISTS "BarStockMovementKind";
DROP TYPE IF EXISTS "BarReceiptStatus";
DROP TYPE IF EXISTS "BarSaleStatus";
