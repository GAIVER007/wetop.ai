-- Объект принадлежит организации (ADR-059). Применяет владелец руками (AGENTS.md §15).
--
-- Зачем: до этой правки любой вошедший видел данные единственного объекта, кем бы он ни был.
-- Самостоятельная регистрация (ADR-055) заводит новую организацию — и она попадала в чужую
-- гостиницу. Теперь объект виден только своей организации.
--
-- Привязка существующих объектов: к самой старой организации. На боевой базе она одна — та,
-- под которой работает владелец; выбор «самая старая» описан в ADR-059 и виден в ревью, а не
-- спрятан в идентификаторе, который у каждой базы свой.

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "organization_id" UUID;

ALTER TABLE "properties"
  DROP CONSTRAINT IF EXISTS "properties_organization_id_fkey";
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");

UPDATE "properties"
   SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "organization_id" IS NULL;

CREATE INDEX IF NOT EXISTS "properties_organization_id_idx"
  ON "properties" ("organization_id");
