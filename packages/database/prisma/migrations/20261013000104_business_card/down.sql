-- Roll back the dependent card editor code first. Preserve metadata backup before dropping.
ALTER TABLE businesses DROP CONSTRAINT businesses_cover_image_valid;
ALTER TABLE businesses DROP COLUMN cover_image, DROP COLUMN description;
-- Image objects remain in private storage for controlled recovery.
