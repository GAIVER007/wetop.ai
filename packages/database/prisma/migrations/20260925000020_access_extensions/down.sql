-- Откат 20260925000020_access_extensions: две новые таблицы (данных гостей и денег в них нет) и роль в членстве.
-- Отметки главного администратора, расширения и роли, выданные после миграции, теряются: повторная миграция снова
-- сделает владельцем самого раннего участника, а расширения и отметки придётся выдать заново.
DROP TABLE IF EXISTS "organization_extensions";
DROP TABLE IF EXISTS "platform_admins";
ALTER TABLE "memberships" DROP COLUMN IF EXISTS "role";
DROP TYPE IF EXISTS "ExtensionStatus";
DROP TYPE IF EXISTS "ExtensionKind";
DROP TYPE IF EXISTS "MembershipRole";
