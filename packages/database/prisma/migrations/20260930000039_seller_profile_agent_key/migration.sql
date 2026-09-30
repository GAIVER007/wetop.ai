-- DATA_MODEL v2.8 §20.7 п. 6 и §20.11 (ADR-127), срез SA2.5, шаг «сузить»: `seller_profiles` принадлежит АГЕНТУ, а не организации.
--
-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (`docs/ops/sa25-agent-scope.md` §4): применяется только после того, как код, читающий профиль по `agent_id`
-- (образ SA2.5), выложен и смоуки Luxx зелёные. Код до SA2.5 (профиль по `organization_id`) на схеме после этой миграции не работает:
-- его `upsert ... ON CONFLICT (organization_id)` больше не найдёт уникальный индекс.
--
-- Что делает:
--   1. предпроверка: `seller_scope_assert()` (та же цепочка, что в 035) и «ни у одного профиля нет пустого agent_id»; любое
--      нарушение — отказ без изменений;
--   2. первичный ключ — `agent_id` (NOT NULL); уникальный индекс `seller_profiles_agent_id_key` уходит — его заменяет ключ;
--   3. `organization_id` остаётся обычной колонкой с внешним ключом (политика RLS §17.3 читает её) и получает индекс:
--      у организации теперь может быть по профилю на каждого агента.
-- Триггер `seller_profiles_link` остаётся: он сверяет, что агент профиля принадлежит организации профиля.
-- Идёт и в public, и в pms_test (ADR-042): имена без схемы, поиск идёт по search_path.

SELECT seller_scope_assert();

DO $$
DECLARE orphan integer;
BEGIN
  SELECT count(*) INTO orphan FROM seller_profiles WHERE agent_id IS NULL;
  IF orphan > 0 THEN
    RAISE EXCEPTION 'SA2.5 (сужение) остановлена: % профилей без agent_id — сначала выкатить 035 и дождаться backfill', orphan;
  END IF;
END $$;

ALTER TABLE "seller_profiles" DROP CONSTRAINT "seller_profiles_pkey";
ALTER TABLE "seller_profiles" ALTER COLUMN "agent_id" SET NOT NULL;
DROP INDEX "seller_profiles_agent_id_key";
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("agent_id");
CREATE INDEX "seller_profiles_organization_id_idx" ON "seller_profiles"("organization_id");
