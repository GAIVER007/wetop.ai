-- Откат 148: только пока котировками голоса не пользовались.
BEGIN;
LOCK TABLE "voice_booking_quotes" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "voice_booking_quotes") THEN
    RAISE EXCEPTION 'Voice booking quotes exist: export them before rollback of 148';
  END IF;
END $$;
DROP TABLE "voice_booking_quotes";
COMMIT;
