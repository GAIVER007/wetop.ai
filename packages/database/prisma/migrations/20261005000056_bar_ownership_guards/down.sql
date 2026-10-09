-- Disposable schema rehearsal only. Removing these guards reopens ownership holes.
-- Operational application rollback must retain 55/56. Production: forward fix, not this down.
DROP TRIGGER bar_categories_property_immutable ON bar_categories;
DROP TRIGGER bar_products_property_immutable ON bar_products;
DROP TRIGGER bar_suppliers_property_immutable ON bar_suppliers;
DROP TRIGGER bar_receipts_property_immutable ON bar_receipts;
DROP TRIGGER bar_stock_lots_property_immutable ON bar_stock_lots;
DROP TRIGGER bar_stock_movements_property_immutable ON bar_stock_movements;
DROP TRIGGER bar_sales_property_immutable ON bar_sales;
DROP TRIGGER bar_receipt_lines_ownership ON bar_receipt_lines;
DROP TRIGGER bar_stock_lots_ownership ON bar_stock_lots;
DROP TRIGGER bar_stock_movements_ownership ON bar_stock_movements;
DROP TRIGGER bar_sale_lines_ownership ON bar_sale_lines;
DROP TRIGGER bar_supplier_payments_ownership ON bar_supplier_payments;
DROP TRIGGER bar_sales_links_ownership ON bar_sales;
DROP FUNCTION bar_property_immutable_guard();
DROP FUNCTION bar_child_ownership_guard();
DROP FUNCTION bar_sale_links_guard();
