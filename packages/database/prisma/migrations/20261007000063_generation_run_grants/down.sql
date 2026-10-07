-- Миграция 26 выдаёт новым таблицам все четыре права через ALTER DEFAULT PRIVILEGES.
-- Состояние до миграции 63 уже содержит их, откат возвращает его.
GRANT SELECT, INSERT, UPDATE, DELETE ON "generation_runs" TO wetop_app, wetop_service;
