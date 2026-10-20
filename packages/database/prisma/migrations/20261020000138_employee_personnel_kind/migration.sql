-- Назначение сотрудника в «Персонале» (DATA_MODEL.md, решение владельца 18.10.2026, выпуск 20.10.2026).
-- Одна nullable колонка: NULL значит «назначение не задано». Без умолчания и без заполнения задним числом.
BEGIN;
ALTER TABLE employees ADD COLUMN personnel_kind text NULL;
ALTER TABLE employees ADD CONSTRAINT employees_personnel_kind_check
  CHECK (personnel_kind IN ('SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH'));
COMMIT;
