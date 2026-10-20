-- Откат прав плана по каналам (ADR-MKT-B7). Миграция 26 выдаёт новым таблицам полный набор прав через
-- ALTER DEFAULT PRIVILEGES (образец отката 098): состояние до миграции 117 уже содержит полный GRANT,
-- поэтому откат возвращает его, а не снимает права совсем.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_budget_lines" TO wetop_app, wetop_service;
