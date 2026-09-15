-- Откат учётных записей (миграция 20260915000013_accounts).
-- Журнал и его записи остаются: снимается только внешний ключ, user_id сохраняет значения.

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

DROP TABLE IF EXISTS "password_resets";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS "users";

DROP TYPE IF EXISTS "UserRole";
DROP TYPE IF EXISTS "UserStatus";
