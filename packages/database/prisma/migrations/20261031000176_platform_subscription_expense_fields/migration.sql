-- 176 PLATFORM-FIELDS-20261031: подписка (промокод, скидка, автопродление), расход WETOP (получатель, проект,
-- повторяется, документ). Аддитивно.
BEGIN;
ALTER TABLE "platform_subscriptions"
  ADD COLUMN "promo_code" VARCHAR(40),
  ADD COLUMN "discount_percent" SMALLINT,
  ADD COLUMN "auto_renew" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "platform_subscriptions_discount_check" CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 0 AND 100);
ALTER TABLE "platform_expenses"
  ADD COLUMN "payee" VARCHAR(200),
  ADD COLUMN "project" VARCHAR(100),
  ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "document_ref" VARCHAR(200);
COMMIT;
