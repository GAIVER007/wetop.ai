-- Откат 150: только пока соседей и снимков нет (их ради отката не удаляют, сначала выгрузка).
BEGIN;
LOCK TABLE "location_competitor_snapshots", "location_competitors" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "location_competitors") OR EXISTS (SELECT 1 FROM "location_competitor_snapshots") THEN
    RAISE EXCEPTION 'Location competitors are in use: export them before rollback of 150';
  END IF;
END $$;
DROP TABLE "location_competitor_snapshots";
DROP TABLE "location_competitors";
DROP FUNCTION location_competitor_guard();
COMMIT;
