-- SL4-M4A-20261018: производный ключ без изменения исходного phone.
-- Применять одной транзакцией после backup и preflight (plans/salons-m4a-2026-10-18.md).
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION customer_phone_key(raw text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE formatted text; digits text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  formatted := btrim(replace(replace(raw, chr(160), ' '), chr(8239), ' '), ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13));
  IF formatted !~ ('^\+?[0-9 ().' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || '-]+$') THEN RETURN NULL; END IF;
  digits := regexp_replace(formatted, '[^0-9]', '', 'g');
  IF length(digits) < 10 OR length(digits) > 15 THEN RETURN NULL; END IF;
  IF length(digits) = 11 AND left(digits, 1) IN ('7', '8') THEN RETURN '+7' || substr(digits, 2); END IF;
  IF length(digits) = 10 AND left(formatted, 1) <> '+' THEN RETURN '+7' || digits; END IF;
  RETURN '+' || digits;
END;
$$;

DO $$
DECLARE collisions bigint;
BEGIN
  SELECT count(*) INTO collisions FROM (
    SELECT organization_id, customer_phone_key(phone)
    FROM customers WHERE customer_phone_key(phone) IS NOT NULL
    GROUP BY organization_id, customer_phone_key(phone) HAVING count(*) > 1
  ) groups;
  IF collisions > 0 THEN
    RAISE EXCEPTION 'Customer phone migration blocked: % duplicate groups; resolve without automatic merge', collisions;
  END IF;
END;
$$;

ALTER TABLE customers ADD COLUMN phone_normalized varchar(16);
UPDATE customers SET phone_normalized = customer_phone_key(phone);
CREATE UNIQUE INDEX customers_organization_id_phone_normalized_key
  ON customers (organization_id, phone_normalized) WHERE phone_normalized IS NOT NULL;

CREATE FUNCTION customer_phone_normalize() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone_normalized := customer_phone_key(NEW.phone);
  RETURN NEW;
END;
$$;
DO $$ BEGIN
  EXECUTE format('ALTER FUNCTION customer_phone_key(text) SET search_path = %I, pg_catalog', current_schema());
  EXECUTE format('ALTER FUNCTION customer_phone_normalize() SET search_path = %I, pg_catalog', current_schema());
END $$;
CREATE TRIGGER customers_phone_normalize
  BEFORE INSERT OR UPDATE OF phone, phone_normalized ON customers
  FOR EACH ROW EXECUTE FUNCTION customer_phone_normalize();
COMMIT;
