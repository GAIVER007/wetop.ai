-- Откат 20260928000031_platform_p1_location_not_null: снять только NOT NULL. Данные, связка и индексы не меняются.
ALTER TABLE "properties" ALTER COLUMN "location_id" DROP NOT NULL;
