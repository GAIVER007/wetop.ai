-- После отката кода, одной транзакцией. Исходные phone, клиенты, связи и audit сохраняются.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE;
DROP TRIGGER customers_phone_normalize ON customers;
DROP FUNCTION customer_phone_normalize();
DROP INDEX customers_organization_id_phone_normalized_key;
ALTER TABLE customers DROP COLUMN phone_normalized;
DROP FUNCTION customer_phone_key(text);
COMMIT;
