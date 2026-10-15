-- Business card metadata, approved DATA_MODEL 18.1.1 on 13.10.2026.
-- Nullable fields preserve existing rows and existing tenant RLS policies.
ALTER TABLE businesses ADD COLUMN description varchar(1000), ADD COLUMN cover_image jsonb;
ALTER TABLE businesses ADD CONSTRAINT businesses_cover_image_valid CHECK (
 cover_image IS NULL OR (
  jsonb_typeof(cover_image) = 'object'
  AND cover_image - ARRAY['storageRef','mimeType','byteSize','width','height','sha256']::text[] = '{}'::jsonb
  AND jsonb_typeof(cover_image->'storageRef') = 'string'
  AND cover_image->>'storageRef' LIKE 'business-cards/' || organization_id::text || '/' || id::text || '/%'
  AND cover_image->>'mimeType' = 'image/webp'
  AND jsonb_typeof(cover_image->'sha256') = 'string'
  AND cover_image->>'sha256' ~ '^[0-9a-f]{64}$'
  AND jsonb_typeof(cover_image->'byteSize') = 'number'
  AND jsonb_typeof(cover_image->'width') = 'number'
  AND jsonb_typeof(cover_image->'height') = 'number'
  AND (cover_image->>'byteSize')::numeric BETWEEN 1 AND 5242880
  AND (cover_image->>'width')::numeric BETWEEN 1 AND 2400
  AND (cover_image->>'height')::numeric BETWEEN 1 AND 2400
  AND (cover_image->>'byteSize')::numeric = trunc((cover_image->>'byteSize')::numeric)
  AND (cover_image->>'width')::numeric = trunc((cover_image->>'width')::numeric)
  AND (cover_image->>'height')::numeric = trunc((cover_image->>'height')::numeric)
 ) IS TRUE
);
