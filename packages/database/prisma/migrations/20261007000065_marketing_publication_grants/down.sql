-- Миграция 26 выдаёт новым таблицам все четыре права через ALTER DEFAULT PRIVILEGES.
-- Состояние до миграции 65 уже содержит их, откат возвращает его.
GRANT SELECT, INSERT, UPDATE, DELETE ON "marketing_site_publications" TO wetop_app, wetop_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_domains" TO wetop_app, wetop_service;
