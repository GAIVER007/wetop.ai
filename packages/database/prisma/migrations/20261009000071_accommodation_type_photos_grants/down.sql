-- Миграция 26 выдаёт новым таблицам все четыре права через ALTER DEFAULT PRIVILEGES.
-- Состояние до миграции 71 уже содержит их, откат возвращает его.
GRANT SELECT, INSERT, UPDATE, DELETE ON "accommodation_type_photos" TO wetop_app, wetop_service;
