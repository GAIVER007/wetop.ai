BEGIN;
LOCK TABLE hotel_stay_reviews IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM hotel_stay_reviews) THEN
    RAISE EXCEPTION 'Rollback blocked: hotel stay reviews exist';
  END IF;
END $$;
DROP TABLE hotel_stay_reviews;
COMMIT;
