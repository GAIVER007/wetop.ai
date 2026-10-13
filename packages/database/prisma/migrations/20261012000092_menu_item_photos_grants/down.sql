-- Миграция 26 выдаёт эти права новым таблицам по умолчанию: состояние до 92 уже содержит полный GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_item_photos TO wetop_app, wetop_service;
