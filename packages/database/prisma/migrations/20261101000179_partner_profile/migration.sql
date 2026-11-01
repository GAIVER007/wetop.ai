-- 179 Профиль партнёра VTOP (DATA_MODEL §63.4, ТЗ владельца 01.11.2026): поля, которые партнёр меняет сам.
-- Аддитивно, все NULL, строки не меняются. Таблица уже закрыта правами 172 (wetop_app без прав).
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS specialization varchar(120);
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS city varchar(80);
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS experience_years smallint;
ALTER TABLE platform_partners ADD COLUMN IF NOT EXISTS about varchar(1000);
ALTER TABLE platform_partners DROP CONSTRAINT IF EXISTS platform_partners_experience;
ALTER TABLE platform_partners ADD CONSTRAINT platform_partners_experience CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 60);
