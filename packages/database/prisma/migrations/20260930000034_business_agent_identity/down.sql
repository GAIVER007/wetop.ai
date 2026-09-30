-- Откат 20260930000034_business_agent_identity (DATA_MODEL §20, SA1.6): снимает добавленное и удаляет агентов, созданных
-- переносом (id = organization_id). Агенты гостевого мастера (случайные id) не трогаются; историю бота откат не касается.
DROP TRIGGER IF EXISTS "seller_profiles_link" ON "seller_profiles";
DROP TRIGGER IF EXISTS "seller_agents_chain" ON "seller_agents";
DROP FUNCTION IF EXISTS seller_profiles_link_agent();
DROP FUNCTION IF EXISTS seller_agents_backfill();
DROP FUNCTION IF EXISTS seller_agent_ensure(uuid, text, boolean);
DROP FUNCTION IF EXISTS seller_agents_check_chain();

DROP INDEX IF EXISTS "seller_profiles_agent_id_key";
ALTER TABLE "seller_profiles" DROP CONSTRAINT IF EXISTS "seller_profiles_agent_id_fkey";
ALTER TABLE "seller_profiles" DROP COLUMN IF EXISTS "agent_id";

DELETE FROM "seller_agents" a
WHERE a.id = a.organization_id AND NOT EXISTS (SELECT 1 FROM "wizard_drafts" d WHERE d.agent_id = a.id);

DROP INDEX IF EXISTS "seller_agents_one_seller_per_location";
ALTER TABLE "seller_agents" DROP CONSTRAINT IF EXISTS "seller_agents_working_needs_location";
ALTER TABLE "seller_agents" DROP CONSTRAINT IF EXISTS "seller_agents_lifecycle_check";
UPDATE "seller_agents" SET lifecycle = 'draft' WHERE lifecycle IN ('active', 'paused');
ALTER TABLE "seller_agents"
  ADD CONSTRAINT "seller_agents_lifecycle_check" CHECK (lifecycle IN ('draft', 'preparing', 'ready', 'error', 'archived'));
DROP INDEX IF EXISTS "seller_agents_location_id_idx";
ALTER TABLE "seller_agents" DROP CONSTRAINT IF EXISTS "seller_agents_location_id_fkey";
ALTER TABLE "seller_agents" DROP COLUMN IF EXISTS "location_id";
