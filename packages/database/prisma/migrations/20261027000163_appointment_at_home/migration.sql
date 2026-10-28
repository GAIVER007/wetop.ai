-- DATA_MODEL HOME-VISIT-20261027 (владелец 27.10.2026: «есть услуга на дому … при создании брони, выбора услуги
-- можно добавить галочку выезд на дом»). Запись салона с выездом мастера к клиенту и адресом. Аддитивно: у всех
-- существующих записей `at_home = false`, адреса нет, поведение прежнее.
ALTER TABLE "appointments" ADD COLUMN "at_home" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN "home_address" VARCHAR(300);
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_home_address_needs_visit"
  CHECK ("home_address" IS NULL OR ("at_home" AND btrim("home_address") <> ''));
