-- Оценка официанта по QR-коду с телефона гостя (DATA_MODEL §40, v2.23, ADR-170)
-- В базе только SHA-256 ключа ссылки; сам ключ живёт в ссылке и QR-коде

-- AlterTable
ALTER TABLE "restaurant_orders" ADD COLUMN "rating_token_hash" CHAR(64),
ADD COLUMN "rating_token_expires_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_orders_rating_token_hash_key" ON "restaurant_orders"("rating_token_hash");
