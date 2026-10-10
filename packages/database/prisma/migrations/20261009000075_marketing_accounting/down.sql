-- Откат ADR-MKT-B1: учёт бюджета и расходов маркетинга (политики и таблицы, затем тип)
DROP POLICY IF EXISTS rls_tenant ON "marketing_expenses";
DROP POLICY IF EXISTS rls_tenant ON "marketing_budgets";
DROP TABLE IF EXISTS "marketing_expenses";
DROP TABLE IF EXISTS "marketing_budgets";
DROP TYPE IF EXISTS "MarketingPlatform";
