-- Откат прав учёта маркетинга (ADR-MKT-B1)
REVOKE ALL ON "marketing_expenses" FROM wetop_app, wetop_service;
REVOKE ALL ON "marketing_budgets" FROM wetop_app, wetop_service;
