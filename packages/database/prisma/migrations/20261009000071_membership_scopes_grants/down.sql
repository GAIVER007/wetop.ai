-- Откат прав области доступа (STAFF2.3b); таблицу снимает откат 070
REVOKE ALL ON "membership_scopes" FROM wetop_app, wetop_service;
