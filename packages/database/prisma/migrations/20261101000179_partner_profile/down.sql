-- Откат 179. Заполненный профиль партнёров молча не стираем: сначала копия базы.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM platform_partners WHERE specialization IS NOT NULL OR city IS NOT NULL OR experience_years IS NOT NULL OR about IS NOT NULL) THEN
    RAISE EXCEPTION 'Профили партнёров заполнены: откат только по копии базы';
  END IF;
END $$;
ALTER TABLE platform_partners DROP CONSTRAINT IF EXISTS platform_partners_experience;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS about;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS experience_years;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS city;
ALTER TABLE platform_partners DROP COLUMN IF EXISTS specialization;
