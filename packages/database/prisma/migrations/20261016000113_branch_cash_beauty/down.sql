-- Откат §48: отказ, если у салона уже есть операции или сверки кассы (без 113 им нет места)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM restaurant_cash_operations c JOIN locations l ON l.id=c.location_id JOIN businesses b ON b.id=l.business_id WHERE b.vertical='BEAUTY'
    UNION ALL SELECT 1 FROM restaurant_cash_reconciliations c JOIN locations l ON l.id=c.location_id JOIN businesses b ON b.id=l.business_id WHERE b.vertical='BEAUTY') THEN
    RAISE EXCEPTION 'Salon branch cash rows exist: rollback of 113 would lose them';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION restaurant_cash_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc_biz uuid;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.location_id <> OLD.location_id THEN RAISE EXCEPTION 'Restaurant parent is immutable'; END IF;
 SELECT b.id INTO loc_biz FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = NEW.location_id AND b.vertical = 'FOOD_SERVICE';
 IF loc_biz IS NULL THEN RAISE EXCEPTION 'Restaurant location required'; END IF;
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
  IF TG_OP = 'UPDATE' THEN
   IF (NEW.kind, NEW.method, NEW.method_to, NEW.amount, NEW.currency, NEW.note, NEW.employee_id, NEW.period, NEW.occurred_at, NEW.created_at)
      IS DISTINCT FROM (OLD.kind, OLD.method, OLD.method_to, OLD.amount, OLD.currency, OLD.note, OLD.employee_id, OLD.period, OLD.occurred_at, OLD.created_at)
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
