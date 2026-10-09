-- Миграция 26 выдаёт новым таблицам все четыре права через ALTER DEFAULT PRIVILEGES.
-- Состояние до миграции 69 уже содержит их, откат возвращает его.
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_builder_entitlements", "site_ai_runs", "marketing_site_version_bookmarks" TO wetop_app, wetop_service;
