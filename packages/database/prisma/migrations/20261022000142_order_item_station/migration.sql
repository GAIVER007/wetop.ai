-- 142 Станции ресторана: бар и кухня получают свои позиции (решение владельца 22.10.2026,
-- docs/decisions/2026-10-22-waiter-stations.md, DATA_MODEL §33.6).
-- 1) Категория меню знает свою станцию: KITCHEN (по умолчанию) или BAR.
-- 2) Строка заказа хранит снимок станции и свой статус NEW / COOKING / READY / SERVED с отметкой готовности.
--    Статус заказа выводится из строк в API (все строки готовы, значит заказ готов).
-- 3) Бронь стола помнит, кто её принял (employee_id, закрывает Q-CALENDAR-2026-10-17).
-- Аддитивно: старый API новые столбцы не читает, умолчания подходят старой записи. GRANT/REVOKE нет:
-- столбцы существующих таблиц покрыты их правами, типы перечислений открыты PUBLIC.
BEGIN;

CREATE TYPE "MenuStation" AS ENUM ('KITCHEN', 'BAR');
CREATE TYPE "OrderItemStatus" AS ENUM ('NEW', 'COOKING', 'READY', 'SERVED');

ALTER TABLE "menu_categories" ADD COLUMN "station" "MenuStation" NOT NULL DEFAULT 'KITCHEN';
-- Бар по прежней регулярке экрана «Напитки» (apps/web/src/app/food/bar-board.tsx до 142)
UPDATE "menu_categories" SET "station" = 'BAR'
 WHERE "name" ~* '(напит|бар|кокт|пив|вин|алког|виск|сок|кофе|чай|лимонад)';

ALTER TABLE "restaurant_order_items"
  ADD COLUMN "station" "MenuStation" NOT NULL DEFAULT 'KITCHEN',
  ADD COLUMN "status" "OrderItemStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "ready_at" TIMESTAMPTZ(6);

-- Снимок станции у существующих строк по категории блюда
UPDATE "restaurant_order_items" i SET "station" = c."station"
  FROM "menu_items" m JOIN "menu_categories" c ON c."id" = m."category_id"
 WHERE m."id" = i."menu_item_id" AND c."station" <> 'KITCHEN';

-- Статус строк существующих заказов = статус заказа (закрытые и отменённые считаются выданными)
UPDATE "restaurant_order_items" i SET
  "status" = (CASE o."status"::text
    WHEN 'NEW' THEN 'NEW' WHEN 'COOKING' THEN 'COOKING' WHEN 'READY' THEN 'READY'
    WHEN 'CANCELLED' THEN CASE WHEN o."ready_at" IS NULL THEN 'NEW' ELSE 'READY' END
    ELSE 'SERVED' END)::"OrderItemStatus",
  "ready_at" = CASE WHEN o."status"::text IN ('READY', 'SERVED', 'CLOSED')
                      OR (o."status"::text = 'CANCELLED' AND o."ready_at" IS NOT NULL)
    THEN COALESCE(o."ready_at", o."served_at", o."closed_at", i."updated_at") ELSE NULL END
  FROM "restaurant_orders" o
 WHERE o."id" = i."order_id";

ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_ready"
  CHECK (("status" IN ('NEW', 'COOKING')) = ("ready_at" IS NULL));
CREATE INDEX "restaurant_order_items_order_station_idx" ON "restaurant_order_items"("order_id", "station");

ALTER TABLE "restaurant_reservations" ADD COLUMN "employee_id" UUID;
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE INDEX "restaurant_reservations_employee_id_idx" ON "restaurant_reservations"("employee_id");

-- Принял бронь только сотрудник того же бизнеса, что и филиал брони
CREATE FUNCTION restaurant_reservation_employee_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.employee_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM employees e JOIN locations l ON l.business_id = e.business_id
    WHERE e.id = NEW.employee_id AND l.id = NEW.location_id
 ) THEN RAISE EXCEPTION 'Reservation employee belongs to another business'; END IF;
 RETURN NEW;
END $$;
DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_reservation_employee_guard() SET search_path = %s',s,path);
END $$;
CREATE TRIGGER restaurant_reservation_employee_guard BEFORE INSERT OR UPDATE OF "employee_id", "location_id"
  ON "restaurant_reservations" FOR EACH ROW EXECUTE FUNCTION restaurant_reservation_employee_guard();

COMMIT;
