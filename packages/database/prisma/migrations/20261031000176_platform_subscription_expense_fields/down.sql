BEGIN;
ALTER TABLE "platform_subscriptions" DROP CONSTRAINT IF EXISTS "platform_subscriptions_discount_check",
  DROP COLUMN IF EXISTS "promo_code", DROP COLUMN IF EXISTS "discount_percent", DROP COLUMN IF EXISTS "auto_renew";
ALTER TABLE "platform_expenses" DROP COLUMN IF EXISTS "payee", DROP COLUMN IF EXISTS "project",
  DROP COLUMN IF EXISTS "recurring", DROP COLUMN IF EXISTS "document_ref";
COMMIT;
