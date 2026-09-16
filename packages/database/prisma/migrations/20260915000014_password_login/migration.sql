-- Вход по логину и паролю (DATA_MODEL §13.8–13.9, ADR-049, Q-146).
--
-- Дополняет таблицы миграции 20260915000013_accounts, а не заменяет их: `organizations`, `memberships`,
-- `login_codes` и `invites` остаются как есть. Способ входа — открытая развилка Q-146: коды на почту лежат
-- в схеме нереализованными, вход по паролю работает. Откат — down.sql рядом.

-- Пароль. Пустая строка значит «пароль не задан»: такой человек по паролю не войдёт, но может войти иначе,
-- когда вход по коду будет сделан. Поэтому NOT NULL DEFAULT '' и никакого CHECK на непустоту.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMPTZ(6);

-- Сессия по токену: в cookie у человека сам токен, здесь только его sha-256.
ALTER TABLE "sessions" ADD COLUMN "token_hash" TEXT;
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- Одноразовая ссылка на установку пароля: приглашение сотрудника и сброс по его просьбе.
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Журнал знает автора (ADR-023 это и предусматривал). SET NULL, а не CASCADE: удаление сотрудника
-- не стирает историю его действий.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
