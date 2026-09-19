-- Откат среза 8 «Аналитика сайта» (DATA_MODEL §11). Четыре таблицы стоят особняком: на них не ссылается
-- ничего, кроме друг друга и справочника объектов. Потери: счётчики сайтов, сессии, просмотры и события —
-- статистика посещений за всё время. Брони не затрагиваются.
-- Перед откатом снять счётчик с сайта (код на странице будет стучаться в API, который ответит 204 и забудет),
-- а на 20260912000010_web_booking откатиться первым — он добавляет колонки в эти же таблицы.

DROP TABLE IF EXISTS "web_events";
DROP TABLE IF EXISTS "web_pageviews";
DROP TABLE IF EXISTS "web_sessions";
DROP TABLE IF EXISTS "tracked_sites";
DROP TYPE IF EXISTS "WebDevice";
DROP TYPE IF EXISTS "WebSourceKind";
DROP TYPE IF EXISTS "TrackedSiteStatus";
