-- Approved 2026-10-01: durable retry for manual reservations, scoped to the property.
ALTER TABLE reservations ADD COLUMN creation_key uuid,
  ADD COLUMN creation_fingerprint varchar(64);
CREATE UNIQUE INDEX reservations_property_id_creation_key_key ON reservations(property_id, creation_key);
ALTER TABLE reservations ADD CONSTRAINT reservation_creation_pair CHECK
  ((creation_key IS NULL AND creation_fingerprint IS NULL) OR
   (creation_key IS NOT NULL AND creation_fingerprint IS NOT NULL AND creation_fingerprint ~ '^[0-9a-f]{64}$'));
