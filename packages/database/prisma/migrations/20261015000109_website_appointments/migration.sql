-- SITE-4 (ADR-185, plans/site-seo-flow-2026-10-15.md §2; DATA_MODEL §19.1 и §28, v2.30): заявка с сайта сразу в календарь.
-- Запись к мастеру получает источник и ключ создания (повтор формы с тем же ключом не заводит вторую запись), бронь стола
-- получает источник WEBSITE (ключ создания у неё уже есть с MV6). Миграцию применяет владелец (AGENTS.md §15).

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('DESK', 'WEBSITE');

-- AlterEnum: новое значение в этой же миграции не используется
ALTER TYPE "RestaurantReservationSource" ADD VALUE 'WEBSITE';

-- AlterTable: прежние записи и запись со стойки: DESK
ALTER TABLE "appointments" ADD COLUMN "source" "AppointmentSource" NOT NULL DEFAULT 'DESK',
ADD COLUMN "creation_key" VARCHAR(200),
ADD COLUMN "creation_fingerprint" VARCHAR(64);

-- Ключ создания уникален в филиале; у записей без ключа (стойка) NULL, и они друг другу не мешают
CREATE UNIQUE INDEX "appointments_location_id_creation_key_key" ON "appointments"("location_id", "creation_key");

-- Ключ и отпечаток ставятся вместе: повтор сверяется по отпечатку
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_creation_pair" CHECK (("creation_key" IS NULL) = ("creation_fingerprint" IS NULL));
