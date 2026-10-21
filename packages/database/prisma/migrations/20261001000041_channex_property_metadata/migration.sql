ALTER TABLE "properties"
  ADD COLUMN "country_code" VARCHAR(2),
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "channex_property_type" VARCHAR(40);

UPDATE "properties"
SET "country_code" = 'KZ',
    "city" = 'Алматы',
    "channex_property_type" = 'hostel'
WHERE "id" = '67646baa-d066-4977-8afc-67f48398842f'
  AND "name" = 'Luxx Aparts';
