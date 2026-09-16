-- Откат. Вход по одноразовому коду после него не работает: искать сессию будет нечем.
-- Перед откатом выключить выдачу сессий, иначе люди получат ключи, по которым нельзя войти.

DROP INDEX IF EXISTS "sessions_token_hash_key";
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_token_hash_shape";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "token_hash";
