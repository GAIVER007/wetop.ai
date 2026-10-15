-- Откат 20261002000040_cashbox: убрать кассу. payments, refunds и folios не затрагивались;
-- операции кассы и статьи теряются — перед откатом снять копию (`docs/deploy.md`).
DROP TRIGGER IF EXISTS "cash_operations_category_guard" ON "cash_operations";
DROP FUNCTION IF EXISTS cash_operations_category_guard();
DROP TABLE IF EXISTS "cash_operations";
DROP TABLE IF EXISTS "cash_categories";
DROP TYPE IF EXISTS "CashOperationKind";
