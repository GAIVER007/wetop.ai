-- Бронирование с сайта (DATA_MODEL §11 v1.2, срез 9, поручение владельца 12.09.2026): у сайта появляется
-- виджет бронирования (включён/выключен, тариф), у сессии счётчика — ссылка на бронь, сделанную виджетом.
-- SQL получен `prisma migrate diff --from-config-datasource --to-schema` против dev-БД 12.09.2026.

-- AlterTable
ALTER TABLE "tracked_sites" ADD COLUMN     "booking_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "booking_rate_plan_id" UUID;

-- AlterTable
ALTER TABLE "web_sessions" ADD COLUMN     "reservation_id" UUID;

-- AddForeignKey
ALTER TABLE "tracked_sites" ADD CONSTRAINT "tracked_sites_booking_rate_plan_id_fkey" FOREIGN KEY ("booking_rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_sessions" ADD CONSTRAINT "web_sessions_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

