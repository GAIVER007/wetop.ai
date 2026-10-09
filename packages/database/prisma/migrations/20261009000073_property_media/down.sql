-- Откат ADR-156 §31.3: снимает таблицу файлов объекта. Объекты в хранилище остаются, чистятся вручную.
DROP TABLE IF EXISTS "property_media";
DROP FUNCTION IF EXISTS property_media_guard();
