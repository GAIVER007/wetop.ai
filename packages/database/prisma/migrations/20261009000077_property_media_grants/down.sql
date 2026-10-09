-- Миграция 26 выдаёт новым таблицам все четыре права через ALTER DEFAULT PRIVILEGES.
-- Состояние до миграции 75 уже содержит их, откат возвращает его.
GRANT SELECT, INSERT, UPDATE, DELETE ON "property_media" TO wetop_app, wetop_service;
