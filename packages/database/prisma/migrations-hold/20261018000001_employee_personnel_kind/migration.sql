-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (README.md): owner approval, backup and isolated rehearsal required.
-- No canonical schema advance; server flag remains OFF until separate release.
BEGIN;
ALTER TABLE employees ADD COLUMN personnel_kind text NULL;
ALTER TABLE employees ADD CONSTRAINT employees_personnel_kind_check
  CHECK (personnel_kind IN ('SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH'));
COMMIT;
