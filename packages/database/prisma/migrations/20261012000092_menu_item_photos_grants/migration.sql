-- Права фото блюд (DATA_MODEL §37), отдельно от создающей миграции (образец 59)
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_item_photos TO wetop_app, wetop_service;
