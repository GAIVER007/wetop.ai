-- Откат ADR-MKT-B7, §51: чеки расходов (политика, затем таблица); объекты в хранилище остаются
DROP POLICY IF EXISTS rls_tenant ON "marketing_expense_files";
DROP TABLE IF EXISTS "marketing_expense_files";
