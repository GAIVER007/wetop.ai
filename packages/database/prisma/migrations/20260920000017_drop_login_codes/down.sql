-- Откат снятия таблицы одноразовых кодов входа (миграция 20260920000017_drop_login_codes, ADR-053).
-- Таблица создаётся заново в том виде, в каком её завела 20260915000013_accounts; данные (коды, почта,
-- IP запросившего) не восстанавливаются — их не должно было остаться, и терять там нечего: срок кода
-- 10 минут. Вход по коду от этого не возвращается: его сняли из API и с экрана входа (ADR-053).

CREATE TABLE IF NOT EXISTS "login_codes" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ(6),
    "requested_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_attempts_range" CHECK ("attempts" >= 0 AND "attempts" <= 3);
CREATE INDEX IF NOT EXISTS "login_codes_email_created_at_idx" ON "login_codes"("email", "created_at");
