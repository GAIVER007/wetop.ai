-- Бар хранит деньги и остатки. FORCE не позволяет владельцу таблиц случайно обойти tenant policies.
-- Служебный путь продолжает работать через роль BYPASSRLS по ADR-103.
ALTER TABLE "bar_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_suppliers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_receipts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_receipt_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_stock_lots" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_stock_movements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_supplier_payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_sales" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bar_sale_lines" FORCE ROW LEVEL SECURITY;
