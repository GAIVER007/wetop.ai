-- Миграция 26 выдаёт новым таблицам все четыре права через ALTER DEFAULT PRIVILEGES.
-- Состояние до миграции 67 уже содержит их, откат возвращает его.
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_assets" TO wetop_app, wetop_service;
