SELECT COUNT(*) AS property_count FROM properties;
SELECT COUNT(*) AS columns_present
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'properties'
  AND column_name IN ('country_code', 'city', 'channex_property_type');
SELECT id, country_code, city, channex_property_type
FROM properties
WHERE id = '67646baa-d066-4977-8afc-67f48398842f';
