-- Откат 169: убрать страну посетителя. Теряется только отметка страны у визитов после выкладки 169;
-- визиты, просмотры и события остаются. Схема после отката совпадает с состоянием до 169.
BEGIN;
ALTER TABLE "web_sessions" DROP CONSTRAINT IF EXISTS "web_sessions_country_iso2";
ALTER TABLE "web_sessions" DROP COLUMN IF EXISTS "country";
COMMIT;
