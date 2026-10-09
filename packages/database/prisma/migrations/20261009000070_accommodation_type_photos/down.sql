-- Откат фото категорий (20261009000070). Теряется только выбор фото по категориям; сами изображения остаются в
-- библиотеке сайта и в хранилище. Откат безопасен в любой момент: остальной код таблицу читает с запасом.
DROP POLICY IF EXISTS rls_tenant ON "accommodation_type_photos";
DROP TRIGGER IF EXISTS accommodation_type_photo_guard ON "accommodation_type_photos";
DROP FUNCTION IF EXISTS accommodation_type_photo_guard();
DROP TABLE IF EXISTS "accommodation_type_photos";
