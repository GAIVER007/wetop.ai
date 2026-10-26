-- Остановить новый API и отправку mobile перед откатом. Не терять принятые ключи.
BEGIN;
LOCK TABLE restaurant_orders IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM restaurant_orders WHERE creation_request_key IS NOT NULL) THEN
    RAISE EXCEPTION 'Creation keys exist: retain protection and use forward repair';
  END IF;
END $$;
DROP INDEX restaurant_orders_location_id_creation_request_key_key;
ALTER TABLE restaurant_orders DROP CONSTRAINT restaurant_orders_creation_request_valid,
  DROP COLUMN creation_request_key, DROP COLUMN creation_request_hash;
COMMIT;
