-- DATA_MODEL v2.17 §13.1, §13.2 (решение владельца 10.10.2026 «да сохранять страну и язык», Q-REG-1, ADR-163).
-- Страна организации и язык интерфейса человека из окна регистрации. Аддитивно: существующие строки получают
-- NULL у страны и `ru` у языка; права `wetop_app` на `users` выданы по колонкам и `locale` не включают (§17.3):
-- пишет и читает служебная роль, как и остальное в `users`.
ALTER TABLE "organizations" ADD COLUMN "country_code" VARCHAR(2);
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_code_iso"
  CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "users" ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'ru';
ALTER TABLE "users" ADD CONSTRAINT "users_locale_known" CHECK ("locale" IN ('ru', 'kk', 'en'));
