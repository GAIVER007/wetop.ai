-- Откат среза 13. Таблицы новые, на них из разделов 1–12 ничего не ссылается, бизнес-данные не теряются.
-- Теряются: организации, пользователи, активные сессии и приглашения. После отката вход остаётся только
-- через Cloudflare Access (ADR-045), а API без таблиц падает на первом обращении к модулю учёток:
-- выключить его (ACCOUNTS=off) до отката.

DROP TABLE IF EXISTS "invites";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS "login_codes";
DROP TABLE IF EXISTS "memberships";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "organizations";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "OrganizationStatus";
