-- Откат 138: только пока ни одного назначения нет. Назначения руководителя не стираются ради отката.
BEGIN;
LOCK TABLE employees IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM employees WHERE personnel_kind IS NOT NULL) THEN
    RAISE EXCEPTION 'Personnel assignments exist: export them before rollback of 138';
  END IF;
END $$;
ALTER TABLE employees DROP CONSTRAINT employees_personnel_kind_check;
ALTER TABLE employees DROP COLUMN personnel_kind;
COMMIT;
