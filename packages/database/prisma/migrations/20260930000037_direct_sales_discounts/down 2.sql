-- Откат 20260930000037_direct_sales_discounts: убрать промокод и производные тарифы. Обычные тарифы и брони не
-- затрагиваются; данные промокодов и связей производных тарифов теряются — перед откатом снять копию (`docs/deploy.md`).
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_promo_code_id_fkey";
DROP INDEX IF EXISTS "reservations_promo_code_id_idx";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "promo_code_id";

DROP TABLE IF EXISTS "promo_codes";

DROP TRIGGER IF EXISTS "rate_plans_parent_guard" ON "rate_plans";
DROP FUNCTION IF EXISTS rate_plans_parent_guard();
DROP INDEX IF EXISTS "rate_plans_parent_rate_plan_id_idx";
ALTER TABLE "rate_plans"
  DROP CONSTRAINT IF EXISTS "rate_plans_min_nights",
  DROP CONSTRAINT IF EXISTS "rate_plans_window_days",
  DROP CONSTRAINT IF EXISTS "rate_plans_discount_percent",
  DROP CONSTRAINT IF EXISTS "rate_plans_derived_shape",
  DROP CONSTRAINT IF EXISTS "rate_plans_parent_not_self",
  DROP CONSTRAINT IF EXISTS "rate_plans_parent_rate_plan_id_fkey",
  DROP COLUMN IF EXISTS "min_nights",
  DROP COLUMN IF EXISTS "max_days_before_arrival",
  DROP COLUMN IF EXISTS "min_days_before_arrival",
  DROP COLUMN IF EXISTS "discount_percent",
  DROP COLUMN IF EXISTS "parent_rate_plan_id";
