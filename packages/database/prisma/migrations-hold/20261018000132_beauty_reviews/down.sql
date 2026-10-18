BEGIN;
LOCK TABLE beauty_appointment_reviews, beauty_review_invitations IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM beauty_appointment_reviews) THEN
    RAISE EXCEPTION 'Rollback blocked: beauty appointment reviews exist';
  END IF;
  IF EXISTS (SELECT 1 FROM beauty_review_invitations) THEN
    RAISE EXCEPTION 'Rollback blocked: beauty review invitations exist';
  END IF;
END $$;

DROP TRIGGER "beauty_appointment_reviews_guard" ON beauty_appointment_reviews;
DROP FUNCTION beauty_appointment_review_guard();
DROP TABLE beauty_review_invitations;
DROP TABLE beauty_appointment_reviews;
COMMIT;
