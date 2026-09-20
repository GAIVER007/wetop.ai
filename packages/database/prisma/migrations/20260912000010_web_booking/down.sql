-- Откат среза 9 «Бронирование с сайта» (DATA_MODEL §11 v1.2). Снимаются только колонки виджета и связь
-- сессии счётчика с бронью. Сами брони с сайта остаются на месте — у них свой источник WEBSITE; теряется
-- лишь то, из какой сессии посетителя бронь пришла (отчёт «брони с сайта» по источникам после отката пуст).
-- Виджет на сайте после отката перестаёт получать цены: код со страницы снять.

ALTER TABLE "web_sessions" DROP CONSTRAINT IF EXISTS "web_sessions_reservation_id_fkey";
ALTER TABLE "tracked_sites" DROP CONSTRAINT IF EXISTS "tracked_sites_booking_rate_plan_id_fkey";
ALTER TABLE "web_sessions" DROP COLUMN IF EXISTS "reservation_id";
ALTER TABLE "tracked_sites" DROP COLUMN IF EXISTS "booking_rate_plan_id";
ALTER TABLE "tracked_sites" DROP COLUMN IF EXISTS "booking_enabled";
