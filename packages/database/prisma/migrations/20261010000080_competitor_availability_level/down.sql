-- Откат 20261010000080: возможен, пока нет снимков без процента (их некуда вернуть: прежняя колонка обязательна).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "competitor_occupancy" WHERE "occupancy_bp" IS NULL) THEN
    RAISE EXCEPTION 'competitor_occupancy: есть снимки только с уровнем, откат потерял бы их';
  END IF;
END $$;
ALTER TABLE "competitor_occupancy" DROP CONSTRAINT "competitor_occupancy_has_value";
ALTER TABLE "competitor_occupancy" ALTER COLUMN "occupancy_bp" SET NOT NULL;
ALTER TABLE "competitor_occupancy" DROP COLUMN "availability_level";
DROP TYPE "CompetitorAvailabilityLevel";
