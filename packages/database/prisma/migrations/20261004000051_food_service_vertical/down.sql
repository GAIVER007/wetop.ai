-- Run during a controlled window after reverting application writes.
-- Refuse destructive conversion of a Food Business into Hospitality.
BEGIN;
LOCK TABLE businesses IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM businesses WHERE vertical::text = 'FOOD_SERVICE') THEN
    RAISE EXCEPTION 'Cannot remove FOOD_SERVICE while Food businesses exist';
  END IF;
END $$;
ALTER TYPE "BusinessVertical" RENAME TO "BusinessVertical_mv1_old";
CREATE TYPE "BusinessVertical" AS ENUM ('HOSPITALITY', 'BEAUTY');
ALTER TABLE businesses ALTER COLUMN vertical TYPE "BusinessVertical" USING vertical::text::"BusinessVertical";
DROP TYPE "BusinessVertical_mv1_old";
COMMIT;
