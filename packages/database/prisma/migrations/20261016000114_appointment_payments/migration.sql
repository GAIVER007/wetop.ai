-- Оплата записи салона приходом кассы филиала (DATA_MODEL §49, v2.33, ADR-APPOINTMENT-PAYMENT-20261016)
ALTER TABLE "restaurant_cash_operations" ADD COLUMN "appointment_id" UUID;
ALTER TABLE "restaurant_cash_operations" ADD COLUMN "idempotency_key" VARCHAR(100);
CREATE INDEX "restaurant_cash_operations_appointment_id_idx" ON "restaurant_cash_operations"("appointment_id");
CREATE UNIQUE INDEX "restaurant_cash_operations_location_id_idempotency_key_key" ON "restaurant_cash_operations"("location_id", "idempotency_key");
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_cash_operations" ADD CONSTRAINT "restaurant_cash_operations_appointment" CHECK (appointment_id IS NULL OR (kind = 'INCOME' AND employee_id IS NULL));

CREATE OR REPLACE FUNCTION restaurant_cash_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc_biz uuid; loc_vertical text;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 SELECT b.id, b.vertical::text INTO loc_biz, loc_vertical FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = NEW.location_id;
 -- касса филиала (§48): ресторан и салон; платёж заказа только у ресторана
 IF loc_biz IS NULL OR loc_vertical NOT IN ('FOOD_SERVICE','BEAUTY') THEN RAISE EXCEPTION 'Branch cash location required'; END IF;
 IF TG_TABLE_NAME = 'restaurant_payments' AND loc_vertical <> 'FOOD_SERVICE' THEN RAISE EXCEPTION 'Restaurant location required'; END IF;
 CASE TG_TABLE_NAME
 WHEN 'restaurant_payments' THEN
  IF NOT EXISTS (SELECT 1 FROM restaurant_orders o WHERE o.id = NEW.order_id AND o.location_id = NEW.location_id) THEN RAISE EXCEPTION 'Payment order belongs to another location'; END IF;
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.order_id, NEW.method, NEW.amount, NEW.currency, NEW.idempotency_key, NEW.paid_at, NEW.created_at)
      IS DISTINCT FROM (OLD.order_id, OLD.method, OLD.amount, OLD.currency, OLD.idempotency_key, OLD.paid_at, OLD.created_at)
   THEN RAISE EXCEPTION 'Restaurant payment is immutable'; END IF;
   IF OLD.status = 'VOIDED' AND NEW.status <> 'VOIDED' THEN RAISE EXCEPTION 'Voided payment stays voided'; END IF;
  END IF;
 WHEN 'restaurant_cash_operations' THEN
  IF NEW.employee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = NEW.employee_id AND e.business_id = loc_biz) THEN RAISE EXCEPTION 'Payout employee belongs to another business'; END IF;
  -- оплата записи салона (§49): запись того же филиала, филиал салона
  IF NEW.appointment_id IS NOT NULL AND (loc_vertical <> 'BEAUTY' OR NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = NEW.appointment_id AND a.location_id = NEW.location_id)) THEN RAISE EXCEPTION 'Appointment payment belongs to another location'; END IF;
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.kind, NEW.method, NEW.method_to, NEW.amount, NEW.currency, NEW.note, NEW.employee_id, NEW.period, NEW.occurred_at, NEW.created_at, NEW.appointment_id, NEW.idempotency_key)
      IS DISTINCT FROM (OLD.kind, OLD.method, OLD.method_to, OLD.amount, OLD.currency, OLD.note, OLD.employee_id, OLD.period, OLD.occurred_at, OLD.created_at, OLD.appointment_id, OLD.idempotency_key)
   THEN RAISE EXCEPTION 'Restaurant cash operation is immutable'; END IF;
   IF OLD.status = 'VOIDED' AND NEW.status <> 'VOIDED' THEN RAISE EXCEPTION 'Voided operation stays voided'; END IF;
  END IF;
 ELSE NULL;
 END CASE;
 RETURN NEW;
END $$;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
 path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
 EXECUTE format('ALTER FUNCTION %I.restaurant_cash_guard() SET search_path = %s',s,path);
END $$;
