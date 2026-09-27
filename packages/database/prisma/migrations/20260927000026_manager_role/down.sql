-- Откат 20260927000026_manager_role (выполняет владелец). Управляющие становятся администраторами (STAFF), роль у
-- приглашений теряется: ожидающее приглашение управляющего примется как приглашение администратора. Кто был
-- управляющим — запросом до отката:
--   select o.name, u.email from memberships m join organizations o on o.id = m.organization_id
--   join users u on u.id = m.user_id where m.role = 'MANAGER';
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_role_not_owner";
ALTER TABLE "invites" DROP COLUMN IF EXISTS "role";
-- Убрать значение из перечисления PostgreSQL не умеет: тип пересоздаётся без MANAGER
UPDATE "memberships" SET "role" = 'STAFF' WHERE "role" = 'MANAGER';
ALTER TABLE "memberships" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'STAFF');
ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "MembershipRole" USING ("role"::text::"MembershipRole");
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'STAFF';
DROP TYPE "MembershipRole_old";
