-- Откат прав чеков расходов (ADR-MKT-B7). Миграция 26 выдаёт новым таблицам полный набор прав через
-- ALTER DEFAULT PRIVILEGES (образец отката 098): откат возвращает полный GRANT, а не снимает права совсем.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_expense_files" TO wetop_app, wetop_service;
