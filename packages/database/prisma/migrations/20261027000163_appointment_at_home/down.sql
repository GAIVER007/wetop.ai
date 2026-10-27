-- Откат 163: отметка «выезд на дом» и адреса записей теряются, записи остаются.
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_home_address_needs_visit";
ALTER TABLE "appointments" DROP COLUMN "home_address";
ALTER TABLE "appointments" DROP COLUMN "at_home";
