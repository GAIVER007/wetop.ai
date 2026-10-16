-- Откат прав кабинета (ADR-MKT-META). Миграция 26 выдаёт новым таблицам полный набор прав через
-- ALTER DEFAULT PRIVILEGES (образец отката 098): откат возвращает полный GRANT, а не снимает права совсем.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_ad_connections" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_sync_runs" TO wetop_app, wetop_service;
