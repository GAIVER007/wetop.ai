-- Back up progress first. Refuse to erase saved onboarding data.
BEGIN;
LOCK TABLE onboarding_progress IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM onboarding_progress) THEN
    RAISE EXCEPTION 'Saved onboarding progress exists: application rollback only, preserve table';
  END IF;
END $$;
DROP TABLE onboarding_progress;
COMMIT;
