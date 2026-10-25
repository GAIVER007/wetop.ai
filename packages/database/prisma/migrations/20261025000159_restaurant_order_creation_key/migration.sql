-- MOBILE-FOOD-1: утверждённая 25.10.2026 защита создания заказа от дублей.
-- Применение production только по отдельному разрешению, docs/ops/mobile-order-creation-key.md.
BEGIN;
ALTER TABLE restaurant_orders
  ADD COLUMN creation_request_key VARCHAR(100),
  ADD COLUMN creation_request_hash CHAR(64),
  ADD CONSTRAINT restaurant_orders_creation_request_valid CHECK (
    (creation_request_key IS NULL AND creation_request_hash IS NULL) OR
    (creation_request_key IS NOT NULL AND creation_request_hash IS NOT NULL
      AND creation_request_key ~ '^[A-Za-z0-9_-]{1,100}$'
      AND creation_request_hash ~ '^[a-f0-9]{64}$')
  );
CREATE UNIQUE INDEX restaurant_orders_location_id_creation_request_key_key
  ON restaurant_orders(location_id, creation_request_key);
COMMIT;
