-- Откат 20261010000083: страна и язык из регистрации теряются (восстановить их не из чего).
ALTER TABLE "users" DROP CONSTRAINT "users_locale_known";
ALTER TABLE "users" DROP COLUMN "locale";
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_country_code_iso";
ALTER TABLE "organizations" DROP COLUMN "country_code";
