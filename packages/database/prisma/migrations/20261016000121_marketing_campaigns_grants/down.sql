-- Откат прав кампаний (ADR-MKT-B3). Миграция 26 выдаёт новым таблицам полный набор прав через
-- ALTER DEFAULT PRIVILEGES (образец отката 098): откат возвращает полный GRANT, а не снимает права совсем.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_campaigns" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_campaign_stats" TO wetop_app, wetop_service;
