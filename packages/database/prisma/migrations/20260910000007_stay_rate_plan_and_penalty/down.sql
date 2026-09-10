ALTER TABLE "reservation_items" DROP CONSTRAINT "reservation_items_rate_plan_id_fkey";
DROP INDEX "reservation_items_rate_plan_id_idx";
ALTER TABLE "reservation_items" DROP COLUMN "children";
ALTER TABLE "reservation_items" DROP COLUMN "adults";
ALTER TABLE "reservation_items" DROP COLUMN "rate_plan_id";
ALTER TABLE "rate_plans" DROP COLUMN "cancellation_penalty";
DROP TYPE "CancellationPenalty";
