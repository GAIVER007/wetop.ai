-- DATA_MODEL ORG-LOCALE-20261026 (владелец 26.10.2026: «салон полностью на английском», язык выбирается при
-- регистрации и в настройке салона). Язык организации: письма-приглашения, экраны приглашения и пароля,
-- язык интерфейса нового сотрудника. Аддитивно: у всех существующих организаций `ru`, как работало до сих пор.
ALTER TABLE "organizations" ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'ru';
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_locale_known" CHECK ("locale" IN ('ru', 'kk', 'en'));
