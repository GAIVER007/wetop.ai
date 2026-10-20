-- Откат 139: только пока роль «Личный кабинет» никому не выдана. Людей с этой ролью не понижают ради отката.
BEGIN;
LOCK TABLE "memberships", "membership_scopes", "invites" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "memberships" WHERE "role"::text = 'EMPLOYEE')
     OR EXISTS (SELECT 1 FROM "membership_scopes" WHERE "role"::text = 'EMPLOYEE')
     OR EXISTS (SELECT 1 FROM "invites" WHERE "role"::text = 'EMPLOYEE') THEN
    RAISE EXCEPTION 'EMPLOYEE role is in use: export it before rollback of 139';
  END IF;
END $$;
DROP INDEX IF EXISTS "invites_employee_id_idx";
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_employee_id_fkey";
ALTER TABLE "invites" DROP COLUMN IF EXISTS "employee_id";
-- Убрать значение из перечисления PostgreSQL не умеет: тип пересоздаётся без EMPLOYEE; CHECK «не владелец»
-- ссылаются на тип и снимаются на время замены
ALTER TABLE "invites" DROP CONSTRAINT "invites_role_not_owner";
ALTER TABLE "membership_scopes" DROP CONSTRAINT "membership_scopes_role_not_owner";
ALTER TABLE "memberships" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invites" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');
ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "MembershipRole" USING ("role"::text::"MembershipRole");
ALTER TABLE "membership_scopes" ALTER COLUMN "role" TYPE "MembershipRole" USING ("role"::text::"MembershipRole");
ALTER TABLE "invites" ALTER COLUMN "role" TYPE "MembershipRole" USING ("role"::text::"MembershipRole");
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'STAFF';
ALTER TABLE "invites" ALTER COLUMN "role" SET DEFAULT 'STAFF';
DROP TYPE "MembershipRole_old";
ALTER TABLE "invites" ADD CONSTRAINT "invites_role_not_owner" CHECK ("role" <> 'OWNER');
ALTER TABLE "membership_scopes" ADD CONSTRAINT "membership_scopes_role_not_owner" CHECK ("role" <> 'OWNER');
COMMIT;
