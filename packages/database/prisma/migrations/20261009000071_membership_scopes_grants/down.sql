-- Откат прав области доступа (STAFF2.3b): права по умолчанию из 026 те же, что выдаёт 071, поэтому откат возвращает
-- их, а не отнимает; саму таблицу снимает откат 070.
GRANT SELECT, INSERT, UPDATE, DELETE ON "membership_scopes" TO wetop_app, wetop_service;
