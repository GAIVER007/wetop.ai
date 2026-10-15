-- DATA_MODEL §23.1 (утверждено владельцем 10.10.2026, ADR-142 пп. 13–16): уровень наличия у снимка загрузки конкурента.
-- Площадка процент загрузки соседа не показывает, видно только «нет мест», «мало мест», «есть места». Процент остаётся
-- там, где он честно известен (ручной ввод, строгое правило сборщика), поэтому становится необязательным.
CREATE TYPE "CompetitorAvailabilityLevel" AS ENUM ('SOLD_OUT', 'FEW_LEFT', 'AVAILABLE');

ALTER TABLE "competitor_occupancy" ADD COLUMN "availability_level" "CompetitorAvailabilityLevel";
ALTER TABLE "competitor_occupancy" ALTER COLUMN "occupancy_bp" DROP NOT NULL;
-- пустой снимок не пишется: известен процент, уровень или оба
ALTER TABLE "competitor_occupancy" ADD CONSTRAINT "competitor_occupancy_has_value"
  CHECK ("occupancy_bp" IS NOT NULL OR "availability_level" IS NOT NULL);
