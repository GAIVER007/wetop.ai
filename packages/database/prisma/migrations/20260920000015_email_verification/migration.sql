-- Подтверждение почты при самостоятельной регистрации (решение владельца 20.09.2026).
-- Применяет владелец руками (AGENTS.md §15).
--
-- Порядок важен: сначала колонка, потом заполнение уже заведённым людям, потом таблица ссылок.
-- Заполнение обязательно: без него сотрудники Luxx Aparts, заведённые до этой правки, окажутся
-- «неподтверждёнными» и потеряют вход.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ(6);

UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL;

CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at"    TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verifications_token_hash_key"
  ON "email_verifications" ("token_hash");
CREATE INDEX IF NOT EXISTS "email_verifications_user_id_idx"
  ON "email_verifications" ("user_id");
