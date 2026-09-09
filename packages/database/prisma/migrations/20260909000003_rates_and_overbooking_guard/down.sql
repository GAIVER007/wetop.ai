-- Откат ограничения против овербукинга
ALTER TABLE "allocations" DROP CONSTRAINT IF EXISTS "allocations_no_overlap_per_unit";

-- DropForeignKey
ALTER TABLE "rate_plans" DROP CONSTRAINT "rate_plans_property_id_fkey";

-- DropForeignKey
ALTER TABLE "rate_plan_accommodation_types" DROP CONSTRAINT "rate_plan_accommodation_types_rate_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "rate_plan_accommodation_types" DROP CONSTRAINT "rate_plan_accommodation_types_accommodation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_rates" DROP CONSTRAINT "daily_rates_accommodation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_rates" DROP CONSTRAINT "daily_rates_rate_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "restrictions" DROP CONSTRAINT "restrictions_accommodation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "restrictions" DROP CONSTRAINT "restrictions_rate_plan_id_fkey";

-- DropTable
DROP TABLE "rate_plans";

-- DropTable
DROP TABLE "rate_plan_accommodation_types";

-- DropTable
DROP TABLE "daily_rates";

-- DropTable
DROP TABLE "restrictions";
