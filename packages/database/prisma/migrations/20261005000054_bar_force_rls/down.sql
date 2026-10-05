-- Откат возвращает режим migration 51: политики остаются включены, владелец таблиц снова может их обходить.
ALTER TABLE "bar_categories" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_products" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_suppliers" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_receipts" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_receipt_lines" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_stock_lots" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_stock_movements" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_supplier_payments" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_sales" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_sale_lines" NO FORCE ROW LEVEL SECURITY;
