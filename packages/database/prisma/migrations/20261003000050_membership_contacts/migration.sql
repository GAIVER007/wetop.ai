-- DATA_MODEL v2.10 §13.3 (Q-244 закрыт владельцем 03.10.2026, TEAM2): телефон и должность сотрудника в этой организации.
-- Колонки в членстве, не у человека: у двух организаций свои, отключение (удаление членства) уносит их вместе с доступом.
-- Обе необязательные; заполненные строки не трогаются. Права `wetop_app` на memberships табличные (…026), отдельный
-- грант не нужен: новые колонки видны роли запросов организации сразу.
ALTER TABLE "memberships"
  ADD COLUMN "phone" VARCHAR(16),
  ADD COLUMN "position" VARCHAR(100);

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_phone_e164" CHECK ("phone" IS NULL OR "phone" ~ '^\+[0-9]{10,15}$'),
  ADD CONSTRAINT "memberships_position_not_blank" CHECK ("position" IS NULL OR btrim("position") <> '');
