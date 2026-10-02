-- Roll back application first. Removing these fields loses retry history, not reservations.
DROP INDEX IF EXISTS reservations_property_id_creation_key_key;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservation_creation_pair;
ALTER TABLE reservations DROP COLUMN IF EXISTS creation_key, DROP COLUMN IF EXISTS creation_fingerprint;
