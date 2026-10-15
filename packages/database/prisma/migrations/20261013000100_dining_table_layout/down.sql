-- Откат §42: столы возвращаются к сетке по порядку
ALTER TABLE "dining_tables" DROP CONSTRAINT IF EXISTS "dining_tables_layout";
ALTER TABLE "dining_tables" DROP COLUMN IF EXISTS "rotation", DROP COLUMN IF EXISTS "scale",
  DROP COLUMN IF EXISTS "shape", DROP COLUMN IF EXISTS "pos_y", DROP COLUMN IF EXISTS "pos_x";
DROP TYPE IF EXISTS "DiningTableShape";
