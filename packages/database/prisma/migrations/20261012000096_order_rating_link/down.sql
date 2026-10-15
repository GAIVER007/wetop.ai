-- Откат §40: выданные ссылки на оценку перестают работать
DROP INDEX IF EXISTS "restaurant_orders_rating_token_hash_key";
ALTER TABLE "restaurant_orders" DROP COLUMN IF EXISTS "rating_token_expires_at", DROP COLUMN IF EXISTS "rating_token_hash";
