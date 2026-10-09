-- Откат STAFF2.3b (20261009000070_membership_scopes). Назначения областей доступа и данные приглашений (имя, телефон,
-- должность, список назначений) теряются: люди снова работают на всю организацию. Приостановленные члены снова становятся
-- активными: перед откатом возобновите или удалите тех, кого приостановили, иначе они получат доступ.
DROP POLICY IF EXISTS rls_tenant ON "membership_scopes";
DROP TRIGGER IF EXISTS membership_scope_guard ON "membership_scopes";
DROP FUNCTION IF EXISTS membership_scope_guard();
DROP TABLE IF EXISTS "membership_scopes";
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_scopes_is_array";
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_phone_e164";
ALTER TABLE "invites" DROP COLUMN IF EXISTS "scopes", DROP COLUMN IF EXISTS "position", DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "last_name", DROP COLUMN IF EXISTS "first_name";
ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "memberships_suspension_consistent";
ALTER TABLE "memberships" DROP COLUMN IF EXISTS "suspended_by", DROP COLUMN IF EXISTS "suspended_at", DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "MembershipStatus";
