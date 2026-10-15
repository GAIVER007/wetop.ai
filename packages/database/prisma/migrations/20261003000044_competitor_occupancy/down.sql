-- Откат 20261003000044_competitor_occupancy: убрать раздел «Загрузка конкурентов». Брони, счета и календарь
-- не затрагиваются; конкуренты и снимки теряются, перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "competitor_occupancy";
DROP TABLE IF EXISTS "competitors";
DROP TYPE IF EXISTS "CompetitorObservationSource";
