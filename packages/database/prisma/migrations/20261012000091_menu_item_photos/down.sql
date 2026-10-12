-- Откат §37: строки фото уходят, объекты в хранилище владелец снимает сам
DROP TABLE IF EXISTS "menu_item_photos";
DROP FUNCTION IF EXISTS menu_item_photo_guard();
