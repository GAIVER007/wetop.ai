-- Откат §36: метка и даты снимаются вместе с колонками
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_birth_date_sane;
ALTER TABLE "customers" DROP COLUMN IF EXISTS "is_vip", DROP COLUMN IF EXISTS "birth_date";
