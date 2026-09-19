-- Откат входа по паролю (миграция 20260915000014_password_login).
-- Таблицы миграции 20260915000013_accounts не трогаются. Записи журнала остаются, снимается только ключ.

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

DROP TABLE IF EXISTS "password_resets";

-- `token_hash` и его индекс принадлежат миграции 20260916000014_session_token_hash — здесь не снимаем
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "last_seen_at";

ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until";
ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_attempts";
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
