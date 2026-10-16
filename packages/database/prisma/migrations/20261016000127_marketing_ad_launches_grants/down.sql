-- Откат прав запуска рекламы (ADR-MKT-LAUNCH). Миграция 26 выдаёт новым таблицам полный набор прав через
-- ALTER DEFAULT PRIVILEGES (образец отката 098): откат возвращает полный GRANT, а не снимает права совсем.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_ad_creatives" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_ad_launches" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_ad_launch_steps" TO wetop_app, wetop_service;
