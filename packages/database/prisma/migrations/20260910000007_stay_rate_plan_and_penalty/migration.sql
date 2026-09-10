-- CreateEnum: политика штрафа при отмене/незаезде (Q-103)
CREATE TYPE "CancellationPenalty" AS ENUM ('NONE', 'FIRST_NIGHT', 'FULL_STAY');

-- Тариф: политика штрафа (умолчание — правило Exely «стоимость первых суток»)
ALTER TABLE "rate_plans" ADD COLUMN "cancellation_penalty" "CancellationPenalty" NOT NULL DEFAULT 'FIRST_NIGHT';

-- Проживание: тариф и число гостей (Q-102)
ALTER TABLE "reservation_items" ADD COLUMN "rate_plan_id" UUID;
ALTER TABLE "reservation_items" ADD COLUMN "adults" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "reservation_items" ADD COLUMN "children" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "reservation_items_rate_plan_id_idx" ON "reservation_items"("rate_plan_id");

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
