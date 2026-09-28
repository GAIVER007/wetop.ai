-- Platform P1, cleanup — properties.location_id NOT NULL (ADR-104, DATA_MODEL v2.6 §18.4; поручение
-- владельца 28.09.2026 после закрытия Platform P1: production подтвердил without_location = 0 и broken_chain = 0).
-- Применяет владелец (AGENTS.md §15): backup → migrate deploy → проверка → откат (down.sql).
--
-- Сначала проверка данных: если есть объект без филиала или объект, чей Business принадлежит другой
-- организации (то же условие, что broken_chain в scripts/ops/platform-p1-report.sql), миграция падает
-- и ничего не меняет — вся миграция идёт одной транзакцией. Данные не правятся, ни один ID не меняется.
DO $$
DECLARE
  without_location integer;
  foreign_business integer;
BEGIN
  SELECT count(*) INTO without_location FROM "properties" WHERE "location_id" IS NULL;
  IF without_location > 0 THEN
    RAISE EXCEPTION 'platform_p1_location_not_null: % объект(ов) без филиала (properties.location_id IS NULL) — сначала backfill, см. scripts/ops/platform-p1-report.sql', without_location;
  END IF;

  SELECT count(*) INTO foreign_business
    FROM "properties" p
    JOIN "locations" l ON l."id" = p."location_id"
    JOIN "businesses" b ON b."id" = l."business_id"
   WHERE b."organization_id" <> p."organization_id";
  IF foreign_business > 0 THEN
    RAISE EXCEPTION 'platform_p1_location_not_null: у % объект(ов) Business другой организации (broken_chain) — разобрать до NOT NULL', foreign_business;
  END IF;
END $$;

ALTER TABLE "properties" ALTER COLUMN "location_id" SET NOT NULL;
