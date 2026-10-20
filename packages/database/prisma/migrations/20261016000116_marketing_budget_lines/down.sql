-- Откат ADR-MKT-B7, §52: план по каналам (политика, затем таблица); общий план месяца остаётся
DROP POLICY IF EXISTS rls_tenant ON "marketing_budget_lines";
DROP TABLE IF EXISTS "marketing_budget_lines";
