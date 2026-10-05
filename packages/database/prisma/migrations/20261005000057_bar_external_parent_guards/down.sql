-- Technical schema rehearsal only. Operational rollback must retain ownership protection.
DROP TRIGGER bar_sales_external_parent_versions ON bar_sales;
DROP TRIGGER bar_supplier_payments_external_parent_versions ON bar_supplier_payments;
DROP FUNCTION bar_external_parent_version_fence();
DROP TRIGGER reservations_bar_ownership ON reservations;
DROP TRIGGER reservation_items_bar_ownership ON reservation_items;
DROP TRIGGER folios_bar_ownership ON folios;
DROP TRIGGER charges_bar_ownership ON charges;
DROP TRIGGER cash_operations_bar_ownership ON cash_operations;
DROP FUNCTION bar_external_parent_guard();
