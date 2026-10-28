-- Откат 168: PostgreSQL не удаляет значения перечисления. Записи с новыми источниками переводятся в DESK,
-- значения остаются в типе неиспользуемыми (старый код их не пишет и не читает как особые).
UPDATE "appointments" SET "source" = 'DESK' WHERE "source"::text IN ('INSTAGRAM', 'WHATSAPP', 'PHONE', 'WALK_IN');
