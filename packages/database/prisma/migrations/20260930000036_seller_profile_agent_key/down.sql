-- Откат 20260930000036_seller_profile_agent_key: первичный ключ `seller_profiles` возвращается на `organization_id`.
-- Отказывает, если у организации уже несколько профилей (несколько агентов): молча склеивать или удалять чужое нельзя.
DO $$
DECLARE many integer;
BEGIN
  SELECT count(*) INTO many FROM (SELECT 1 FROM seller_profiles GROUP BY organization_id HAVING count(*) > 1) d;
  IF many > 0 THEN
    RAISE EXCEPTION 'Откат 036 невозможен: у % организаций несколько профилей (несколько агентов) — оставьте схему', many;
  END IF;
END $$;

DROP INDEX IF EXISTS "seller_profiles_organization_id_idx";
ALTER TABLE "seller_profiles" DROP CONSTRAINT "seller_profiles_pkey";
ALTER TABLE "seller_profiles" ALTER COLUMN "agent_id" DROP NOT NULL;
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("organization_id");
CREATE UNIQUE INDEX "seller_profiles_agent_id_key" ON "seller_profiles"("agent_id");
