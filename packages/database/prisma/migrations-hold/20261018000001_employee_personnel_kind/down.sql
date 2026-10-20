-- Separate release rollback ONLY for never-assigned fixtures.
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
LOCK TABLE employees IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM employees WHERE personnel_kind IS NOT NULL) THEN
    RAISE EXCEPTION 'Personnel assignments exist; separate preservation/forward-repair strategy required';
  END IF;
END $$;
ALTER TABLE employees DROP CONSTRAINT employees_personnel_kind_check;
ALTER TABLE employees DROP COLUMN personnel_kind;
COMMIT;
