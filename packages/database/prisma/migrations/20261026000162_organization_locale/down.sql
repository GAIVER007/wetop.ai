-- Откат 162: выбранный язык организаций теряется, приглашения снова только на русском.
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_locale_known";
ALTER TABLE "organizations" DROP COLUMN "locale";
