-- 139 Уровни доступа сотрудника (решение владельца 20.10.2026, docs/decisions/2026-10-20-staff-access-levels.md).
-- 1) Роль «Личный кабинет»: значение EMPLOYEE в MembershipRole (права только «своё», таблица прав в коде).
-- 2) Приглашение из формы «Новый сотрудник» помнит сотрудника: после принятия аккаунт сам привязывается к нему.
-- Аддитивно: старый API новое значение и столбец не читает.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'EMPLOYEE';

ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "employee_id" UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invites_employee_id_fkey' AND conrelid = '"invites"'::regclass
  ) THEN
    ALTER TABLE "invites" ADD CONSTRAINT "invites_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "invites_employee_id_idx" ON "invites"("employee_id");
