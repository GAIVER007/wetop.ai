-- Откат ADR-157 §32.3: снимает таблицу файлов объекта. Объекты в хранилище остаются, чистятся вручную.
DROP TABLE IF EXISTS "property_media";
DROP FUNCTION IF EXISTS property_media_guard();
