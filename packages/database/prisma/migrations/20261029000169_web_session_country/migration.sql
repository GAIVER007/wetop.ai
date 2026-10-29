-- 169 Страна посетителя сайта (владелец 29.10.2026: «гео, с какой страны заходят»), DATA_MODEL §11 WebSession,
-- VISITOR-COUNTRY-20261029. Аддитивно: колонка NULL без значения по умолчанию, прошлые визиты остаются без страны.
-- Только двухбуквенный код ISO 3166-1 из заголовка Cloudflare CF-IPCountry; IP-адрес не хранится.
ALTER TABLE "web_sessions" ADD COLUMN IF NOT EXISTS "country" VARCHAR(2);
ALTER TABLE "web_sessions" DROP CONSTRAINT IF EXISTS "web_sessions_country_iso2";
ALTER TABLE "web_sessions" ADD CONSTRAINT "web_sessions_country_iso2" CHECK ("country" IS NULL OR "country" ~ '^[A-Z]{2}$');
