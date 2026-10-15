-- Откат MKT8 (20261007000066_site_assets). Строки библиотеки изображений теряются; объекты в хранилище остаются
-- нетронутыми (база ключи не удаляет), их убирает владелец отдельно. Ссылки версий SiteSpec на ассеты останутся, но
-- публикация и рантайм без таблицы их не примут. Откат только до того, как библиотекой начали пользоваться.
DROP POLICY IF EXISTS rls_tenant ON "site_assets";
DROP TRIGGER IF EXISTS site_asset_guard ON "site_assets";
DROP FUNCTION IF EXISTS site_asset_guard();
DROP TABLE IF EXISTS "site_assets";
DROP TYPE IF EXISTS "SiteAssetSource";
DROP TYPE IF EXISTS "SiteAssetStatus";
DROP TYPE IF EXISTS "SiteAssetKind";
