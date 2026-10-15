-- Откат 20261009000070_competitor_rates: убрать цены конкурентов и новые поля карточки. Загрузка конкурентов
-- (`competitor_occupancy`), брони, счета и календарь не затрагиваются; цены и значения новых полей теряются,
-- перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "competitor_rates";
ALTER TABLE "competitors"
  DROP CONSTRAINT IF EXISTS "competitors_district_length",
  DROP CONSTRAINT IF EXISTS "competitors_category_length",
  DROP CONSTRAINT IF EXISTS "competitors_address_length",
  DROP CONSTRAINT IF EXISTS "competitors_data_source_length",
  DROP CONSTRAINT IF EXISTS "competitors_refresh_hours",
  DROP COLUMN IF EXISTS "district",
  DROP COLUMN IF EXISTS "category",
  DROP COLUMN IF EXISTS "address",
  DROP COLUMN IF EXISTS "data_source",
  DROP COLUMN IF EXISTS "monitoring",
  DROP COLUMN IF EXISTS "refresh_hours",
  DROP COLUMN IF EXISTS "auto_refresh";
DROP TYPE IF EXISTS "CompetitorMonitoring";
