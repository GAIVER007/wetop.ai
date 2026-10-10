-- Откат прав учёта маркетинга (ADR-MKT-B1). Миграция 26 выдаёт новым таблицам полный набор прав через
-- ALTER DEFAULT PRIVILEGES (образец отката миграций 59 и 82): состояние до миграции 84 уже содержит
-- полный GRANT, поэтому откат возвращает его, а не снимает права совсем.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_expenses" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_budgets" TO wetop_app, wetop_service;
