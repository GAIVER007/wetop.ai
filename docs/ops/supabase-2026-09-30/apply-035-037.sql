-- WETOP: Supabase SQL Editor, role postgres. Apply the complete file.
-- Backup required; see README.md. Original repository migrations 035-037.
-- Migration 038 is intentionally excluded: code-first rollout required.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(20260930, 3537);
DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000034_revoke_supabase_api_roles' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'Expected migration 034 before this bundle'; END IF;
 IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'Unresolved failed migration; stop and inspect'; END IF;
END $guard$;

-- 20260930000035_business_agent_identity
DO $bundle_0$
BEGIN
 IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000035_business_agent_identity' AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND checksum = '5b40292fe64045c8b5df6c390a8d0bc7e940c85385354a5e1877b2ac4474866c') THEN
  RAISE NOTICE 'Already applied: 20260930000035_business_agent_identity';
 ELSIF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000035_business_agent_identity' AND rolled_back_at IS NULL) THEN
  RAISE EXCEPTION 'Migration checksum/state mismatch: 20260930000035_business_agent_identity';
 ELSE
  EXECUTE $migration_0$
-- DATA_MODEL v2.8 §20 (утверждён владельцем 30.09.2026, ADR-127), срез SA1.6: личность Business Agent и перенос
-- существующего продавца. План — plans/business-ai-seller-sa16-2026-09-30.md.
--
-- Что делает (расширение без сужения: прежний код продолжает работать между миграцией и выкладкой):
--   1. seller_agents.location_id — филиал агента (FK → locations, RESTRICT), индекс;
--   2. хранимых состояний четыре — draft / active / paused / archived (Q-SA-11); active и paused требуют филиал;
--   3. не более одного неархивного AI-продавца (scenario = 'sales') на филиал (Q-SA-2): частичный уникальный индекс.
--      Агенты других типов на филиале допустимы;
--   4. триггер: филиал агента принадлежит Business той же организации (locations без organization_id, CHECK невозможен);
--   5. seller_profiles.agent_id — связь профиля с агентом (unique, FK). Первичный ключ остаётся organization_id;
--      NOT NULL и смена ключа — в «сужении» (§20.7 п. 6), пока прежний код может вставить профиль без агента.
--      Триггер при вставке профиля без агента сам заводит агента с id = organization_id (Q-SA-9);
--   6. функции seller_agent_ensure(org) и seller_agents_backfill() — перенос существующего продавца (§20.4): агент с
--      id = organization_id для организации с профилем или расширением «ИИ-продавец». Идемпотентно, повтор ничего не
--      дублирует; миграция вызывает перенос сама, тесты и «сужение» — тот же путь.
--
-- Идёт и в public, и в pms_test (ADR-042): имена без схемы, поиск идёт по search_path.

-- Предпроверка: останов без изменений
DO $$
DECLARE bad integer; orphan integer;
BEGIN
  SELECT count(*) INTO bad FROM seller_agents WHERE lifecycle NOT IN ('draft', 'archived');
  IF bad > 0 THEN
    RAISE EXCEPTION 'SA1.6 остановлена: % агентов в состояниях preparing/ready/error — код мастера пишет только draft, разобрать вручную', bad;
  END IF;

  SELECT count(*) INTO orphan
  FROM organizations o
  WHERE (EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = o.id)
         OR EXISTS (SELECT 1 FROM organization_extensions e WHERE e.organization_id = o.id AND e.extension = 'AI_SELLER'))
    AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = o.id);
  IF orphan > 0 THEN
    RAISE EXCEPTION 'SA1.6 остановлена: % организаций с продавцом без единого участника — некому быть автором агента', orphan;
  END IF;

  IF EXISTS (SELECT 1 FROM seller_agents a JOIN organizations o ON o.id = a.id WHERE a.organization_id <> o.id) THEN
    RAISE EXCEPTION 'SA1.6 остановлена: идентификатор организации уже занят агентом другой организации';
  END IF;
END $$;

-- 1. Филиал агента
ALTER TABLE "seller_agents" ADD COLUMN "location_id" UUID;
ALTER TABLE "seller_agents"
  ADD CONSTRAINT "seller_agents_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "seller_agents_location_id_idx" ON "seller_agents"("location_id");

-- 2. Состояния: preparing / ready / error не хранятся (§20.3)
ALTER TABLE "seller_agents" DROP CONSTRAINT "seller_agents_lifecycle_check";
ALTER TABLE "seller_agents"
  ADD CONSTRAINT "seller_agents_lifecycle_check" CHECK (lifecycle IN ('draft', 'active', 'paused', 'archived'));
ALTER TABLE "seller_agents"
  ADD CONSTRAINT "seller_agents_working_needs_location" CHECK (lifecycle NOT IN ('active', 'paused') OR location_id IS NOT NULL);

-- 3. Один неархивный AI-продавец на филиал (Q-SA-2)
CREATE UNIQUE INDEX "seller_agents_one_seller_per_location" ON "seller_agents"("location_id")
  WHERE location_id IS NOT NULL AND scenario = 'sales' AND lifecycle <> 'archived';

-- 4. Филиал принадлежит организации агента
CREATE FUNCTION seller_agents_check_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locations l JOIN businesses b ON b.id = l.business_id
    WHERE l.id = NEW.location_id AND b.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Филиал агента не принадлежит организации агента (seller_agents.location_id)' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "seller_agents_chain" BEFORE INSERT OR UPDATE OF organization_id, location_id ON "seller_agents"
  FOR EACH ROW EXECUTE FUNCTION seller_agents_check_chain();

-- 5. Перенос: агент организации с id = organization_id (§20.4)
CREATE FUNCTION seller_agent_ensure(p_org uuid, p_name text DEFAULT NULL, p_applied boolean DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_author uuid;
  v_location uuid;
  v_name text;
  v_applied boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM seller_agents WHERE id = p_org) THEN
    RETURN false;
  END IF;

  -- автор — самый ранний владелец, иначе самый ранний участник
  SELECT m.user_id INTO v_author FROM memberships m WHERE m.organization_id = p_org
  ORDER BY (m.role = 'OWNER') DESC, m.created_at ASC, m.user_id LIMIT 1;
  IF v_author IS NULL THEN
    -- Автора нет: агента не заводим. Сохранение профиля прежним кодом из-за этого падать не должно;
    -- организации с продавцом, но без участников, останавливает предпроверка миграции
    RETURN false;
  END IF;

  -- филиал самого раннего объекта организации — то же правило, что у фактов и котировки продавца
  SELECT p.location_id INTO v_location FROM properties p WHERE p.organization_id = p_org
  ORDER BY p.created_at ASC, p.id LIMIT 1;

  SELECT coalesce(p_name, nullif(sp.bot_name, '')), coalesce(p_applied, sp.profile_applied_at IS NOT NULL)
  INTO v_name, v_applied FROM seller_profiles sp WHERE sp.organization_id = p_org;

  INSERT INTO seller_agents (id, organization_id, created_by, name, scenario, lifecycle, location_id, profile, created_at, updated_at)
  VALUES (
    p_org, p_org, v_author, coalesce(v_name, p_name, 'AI-продавец'), 'sales',
    CASE WHEN coalesce(v_applied, false) AND v_location IS NOT NULL THEN 'active' ELSE 'draft' END,
    v_location, '{}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN true;
END $$;

CREATE FUNCTION seller_agents_backfill() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_org uuid;
  v_created integer := 0;
BEGIN
  FOR v_org IN
    SELECT o.id FROM organizations o
    WHERE (EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = o.id)
           OR EXISTS (SELECT 1 FROM organization_extensions e WHERE e.organization_id = o.id AND e.extension = 'AI_SELLER'))
      AND NOT EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = o.id)
  LOOP
    IF seller_agent_ensure(v_org) THEN v_created := v_created + 1; END IF;
  END LOOP;

  UPDATE seller_profiles SET agent_id = organization_id
  WHERE agent_id IS NULL AND EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = seller_profiles.organization_id);
  RETURN v_created;
END $$;

-- 6. Связь профиля с агентом
ALTER TABLE "seller_profiles" ADD COLUMN "agent_id" UUID;
ALTER TABLE "seller_profiles"
  ADD CONSTRAINT "seller_profiles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "seller_agents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "seller_profiles_agent_id_key" ON "seller_profiles"("agent_id");

CREATE FUNCTION seller_profiles_link_agent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.agent_id IS NULL THEN
    PERFORM seller_agent_ensure(NEW.organization_id, NEW.bot_name, NEW.profile_applied_at IS NOT NULL);
    IF EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = NEW.organization_id) THEN
      NEW.agent_id := NEW.organization_id;
    END IF;
  END IF;
  IF NEW.agent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM seller_agents a WHERE a.id = NEW.agent_id AND a.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Агент профиля принадлежит другой организации (seller_profiles.agent_id)' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "seller_profiles_link" BEFORE INSERT OR UPDATE OF agent_id, organization_id ON "seller_profiles"
  FOR EACH ROW EXECUTE FUNCTION seller_profiles_link_agent();

-- 7. Перенос существующих продавцов
SELECT seller_agents_backfill();

$migration_0$;
  INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '5b40292fe64045c8b5df6c390a8d0bc7e940c85385354a5e1877b2ac4474866c', now(), '20260930000035_business_agent_identity', NULL, NULL, now(), 1);
 END IF;
END $bundle_0$;

-- 20260930000036_seller_agent_scope_expand
DO $bundle_1$
BEGIN
 IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000036_seller_agent_scope_expand' AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND checksum = '26853b7490d3724bc1a78b6e977010dbc94dea7eb3d7dbe4ac8f03b0998c6eab') THEN
  RAISE NOTICE 'Already applied: 20260930000036_seller_agent_scope_expand';
 ELSIF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000036_seller_agent_scope_expand' AND rolled_back_at IS NULL) THEN
  RAISE EXCEPTION 'Migration checksum/state mismatch: 20260930000036_seller_agent_scope_expand';
 ELSE
  EXECUTE $migration_1$
-- DATA_MODEL v2.8 §20 (ADR-127), срез SA2.5, шаг A «расширить»: предпроверка однозначности и backfill перед переводом
-- рантайма на agent_id. План — plans/business-ai-seller-sa25-2026-09-30.md §10 (решения владельца 30.09).
--
-- Что делает (старый код продолжает работать: ни один ключ и ни одно ограничение не снимается):
--   1. seller_scope_precheck(org) — таблица проверок цепочки
--        seller_profile → Organization → legacy Seller Agent (id = organization_id) → Business → Location,
--      seller_scope_assert(org) — та же проверка, останавливающая работу с перечнем нарушений;
--   2. seller_agent_ensure: филиал агента выбирается только при ОДНОЗНАЧНОСТИ (ровно один действующий филиал у
--      организации). Прежнее «самый ранний объект» (034) — догадка по created_at и отменена: при нескольких филиалах агент
--      заводится без филиала, а не с угаданным;
--   3. seller_agents_backfill: заполняет филиал legacy-агента, только если он единственно возможный, и связывает профили
--      с агентами (seller_profiles.agent_id);
--   3а. seller_agent_bind_location(agent) — тот же однозначный выбор филиала по одной организации, для API;
--   4. миграция вызывает assert по всей базе ДО backfill: любая неоднозначность — отказ без изменений, вручную решает
--      владелец (Location по created_at, названию или догадке не выбирается).
--
-- NOT NULL и смена первичного ключа seller_profiles — шаг E «сузить» (миграция 036, отдельный релиз после доказанного
-- рантайма). Идёт и в public, и в pms_test (ADR-042): имена без схемы, поиск идёт по search_path.

-- 1. Предпроверка: одна строка на проверку — total (сколько проверено) и bad (сколько нарушений)
CREATE FUNCTION seller_scope_precheck(p_org uuid DEFAULT NULL)
RETURNS TABLE (check_name text, total bigint, bad bigint)
LANGUAGE sql STABLE AS $$
  WITH
  -- организации, в которых есть что переносить: профиль, legacy-агент или расширение «ИИ-продавец»
  scoped AS (
    SELECT o.id
    FROM organizations o
    WHERE (p_org IS NULL OR o.id = p_org)
      AND (EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = o.id)
           OR EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = o.id)
           OR EXISTS (SELECT 1 FROM organization_extensions e WHERE e.organization_id = o.id AND e.extension = 'AI_SELLER'))
  ),
  -- возможные филиалы организации: действующие филиалы её объектов (Property–Location 1:1)
  candidates AS (
    SELECT p.organization_id AS org, count(DISTINCT l.id) AS n
    FROM properties p JOIN locations l ON l.id = p.location_id
    WHERE l.status = 'ACTIVE'
    GROUP BY p.organization_id
  ),
  legacy AS (
    SELECT a.id, a.organization_id, a.location_id
    FROM seller_agents a
    WHERE a.id = a.organization_id AND (p_org IS NULL OR a.organization_id = p_org)
  )
  SELECT 'profiles_without_organization'::text,
         (SELECT count(*) FROM seller_profiles sp WHERE p_org IS NULL OR sp.organization_id = p_org),
         (SELECT count(*) FROM seller_profiles sp
           WHERE (p_org IS NULL OR sp.organization_id = p_org)
             AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = sp.organization_id))
  UNION ALL
  SELECT 'profiles_without_agent',
         (SELECT count(*) FROM seller_profiles sp WHERE p_org IS NULL OR sp.organization_id = p_org),
         (SELECT count(*) FROM seller_profiles sp
           WHERE (p_org IS NULL OR sp.organization_id = p_org)
             AND NOT EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = sp.organization_id AND a.organization_id = sp.organization_id))
  UNION ALL
  SELECT 'profiles_wrong_agent',
         (SELECT count(*) FROM seller_profiles sp WHERE p_org IS NULL OR sp.organization_id = p_org),
         (SELECT count(*) FROM seller_profiles sp
           WHERE (p_org IS NULL OR sp.organization_id = p_org)
             AND sp.agent_id IS NOT NULL
             AND (sp.agent_id <> sp.organization_id
                  OR NOT EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = sp.agent_id AND a.organization_id = sp.organization_id)))
  UNION ALL
  SELECT 'legacy_agents_without_location',
         (SELECT count(*) FROM legacy),
         (SELECT count(*) FROM legacy g
           WHERE g.location_id IS NULL AND coalesce((SELECT c.n FROM candidates c WHERE c.org = g.organization_id), 0) = 0)
  UNION ALL
  SELECT 'orgs_with_many_locations',
         (SELECT count(*) FROM scoped),
         (SELECT count(*) FROM scoped s WHERE coalesce((SELECT c.n FROM candidates c WHERE c.org = s.id), 0) > 1)
  UNION ALL
  SELECT 'legacy_agents_wrong_location',
         (SELECT count(*) FROM legacy),
         (SELECT count(*) FROM legacy g
           WHERE g.location_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM properties p JOIN locations l ON l.id = p.location_id
               WHERE p.organization_id = g.organization_id AND l.id = g.location_id AND l.status = 'ACTIVE'))
  UNION ALL
  SELECT 'duplicate_sales_agents_per_location',
         (SELECT count(DISTINCT a.location_id) FROM seller_agents a
           WHERE a.location_id IS NOT NULL AND a.scenario = 'sales' AND a.lifecycle <> 'archived'
             AND (p_org IS NULL OR a.organization_id = p_org)),
         (SELECT count(*) FROM (
            SELECT a.location_id FROM seller_agents a
            WHERE a.location_id IS NOT NULL AND a.scenario = 'sales' AND a.lifecycle <> 'archived'
              AND (p_org IS NULL OR a.organization_id = p_org)
            GROUP BY a.location_id HAVING count(*) > 1) d)
  UNION ALL
  SELECT 'orgs_without_actor',
         (SELECT count(*) FROM scoped),
         (SELECT count(*) FROM scoped s WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = s.id))
$$;

-- Останавливает работу, если хоть одна проверка красная; в сообщении — каждая красная проверка и число нарушений
CREATE FUNCTION seller_scope_assert(p_org uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_report text;
BEGIN
  SELECT string_agg(check_name || '=' || bad, ', ' ORDER BY check_name) INTO v_report
  FROM seller_scope_precheck(p_org) WHERE bad > 0;
  IF v_report IS NOT NULL THEN
    RAISE EXCEPTION 'SA2.5 остановлена: цепочка seller_profile → Organization → legacy Agent → Business → Location неоднозначна (%). Филиал по created_at не выбирается — разобрать вручную', v_report
      USING ERRCODE = '23514';
  END IF;
  RETURN true;
END $$;

-- 2. Агент переносится с филиалом только при однозначности (§20.4)
CREATE OR REPLACE FUNCTION seller_agent_ensure(p_org uuid, p_name text DEFAULT NULL, p_applied boolean DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_author uuid;
  v_location uuid;
  v_candidates integer;
  v_name text;
  v_applied boolean;
  v_row_name text;
  v_row_applied boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM seller_agents WHERE id = p_org) THEN
    RETURN false;
  END IF;

  -- автор — самый ранний владелец, иначе самый ранний участник
  SELECT m.user_id INTO v_author FROM memberships m WHERE m.organization_id = p_org
  ORDER BY (m.role = 'OWNER') DESC, m.created_at ASC, m.user_id LIMIT 1;
  IF v_author IS NULL THEN
    -- Автора нет: агента не заводим. Организации с продавцом, но без участников, останавливает предпроверка
    -- (seller_scope_assert); профиль без агента после сужения (036) не вставляется, до него — сохранялся без связи
    RETURN false;
  END IF;

  -- филиал — только единственный возможный: действующие филиалы объектов организации (Property–Location 1:1)
  SELECT count(*), (array_agg(c.location_id))[1] INTO v_candidates, v_location
  FROM (
    SELECT DISTINCT p.location_id
    FROM properties p JOIN locations l ON l.id = p.location_id
    WHERE p.organization_id = p_org AND l.status = 'ACTIVE'
  ) c;
  IF v_candidates <> 1 THEN
    v_location := NULL;
  END IF;
  -- филиал уже держит другой неархивный AI-продавец (Q-SA-2): не занимаем его и не падаем на уникальном индексе
  IF v_location IS NOT NULL AND EXISTS (
    SELECT 1 FROM seller_agents x
    WHERE x.location_id = v_location AND x.scenario = 'sales' AND x.lifecycle <> 'archived'
  ) THEN
    v_location := NULL;
  END IF;

  -- Профиль может ещё не существовать (триггер срабатывает ДО вставки строки): SELECT INTO без строки обнуляет цели, поэтому
  -- значения из строки читаются в отдельные переменные, а не поверх переданных аргументов (в 034 принятый профиль,
  -- вставленный прежним кодом, оставлял агента черновиком)
  SELECT nullif(sp.bot_name, ''), sp.profile_applied_at IS NOT NULL INTO v_row_name, v_row_applied
  FROM seller_profiles sp WHERE sp.organization_id = p_org;
  v_name := coalesce(p_name, v_row_name, 'AI-продавец');
  v_applied := coalesce(p_applied, v_row_applied, false);

  INSERT INTO seller_agents (id, organization_id, created_by, name, scenario, lifecycle, location_id, profile, created_at, updated_at)
  VALUES (
    p_org, p_org, v_author, v_name, 'sales',
    CASE WHEN v_applied AND v_location IS NOT NULL THEN 'active' ELSE 'draft' END,
    v_location, '{}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN true;
END $$;

-- 3. Перенос: агенты, филиалы единственно возможных, связи профилей
CREATE OR REPLACE FUNCTION seller_agents_backfill() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_org uuid;
  v_created integer := 0;
BEGIN
  FOR v_org IN
    SELECT o.id FROM organizations o
    WHERE (EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = o.id)
           OR EXISTS (SELECT 1 FROM organization_extensions e WHERE e.organization_id = o.id AND e.extension = 'AI_SELLER'))
      AND NOT EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = o.id)
  LOOP
    IF seller_agent_ensure(v_org) THEN v_created := v_created + 1; END IF;
  END LOOP;

  -- legacy-агент без филиала получает его, только если филиал у организации ровно один
  UPDATE seller_agents a
  SET location_id = one.location_id,
      lifecycle = CASE WHEN a.lifecycle = 'draft'
                            AND EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = a.id AND sp.profile_applied_at IS NOT NULL)
                       THEN 'active' ELSE a.lifecycle END,
      updated_at = now()
  FROM (
    SELECT p.organization_id AS org, (array_agg(DISTINCT l.id))[1] AS location_id
    FROM properties p JOIN locations l ON l.id = p.location_id
    WHERE l.status = 'ACTIVE'
    GROUP BY p.organization_id
    HAVING count(DISTINCT l.id) = 1
  ) one
  WHERE a.id = a.organization_id AND a.organization_id = one.org AND a.location_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM seller_agents x
      WHERE x.location_id = one.location_id AND x.scenario = 'sales' AND x.lifecycle <> 'archived' AND x.id <> a.id);

  -- рабочий агент с филиалом и принятым профилем — active (в 034 агент, заведённый триггером при вставке принятого профиля,
  -- оставался черновиком: значения из ещё не вставленной строки терялись)
  UPDATE seller_agents a
  SET lifecycle = 'active', updated_at = now()
  WHERE a.id = a.organization_id AND a.lifecycle = 'draft' AND a.location_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = a.id AND sp.profile_applied_at IS NOT NULL);

  UPDATE seller_profiles SET agent_id = organization_id
  WHERE agent_id IS NULL AND EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = seller_profiles.organization_id);
  RETURN v_created;
END $$;

-- 3а. Перенесённый продавец без филиала (объект появился позже профиля): единственно возможный филиал ставит база, по
-- одной организации. У агентов SA2 (id ≠ organization_id) филиал выбирает человек, функция их не трогает.
CREATE FUNCTION seller_agent_bind_location(p_agent uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_org uuid;
  v_location uuid;
  v_candidates integer;
BEGIN
  SELECT organization_id, location_id INTO v_org, v_location FROM seller_agents WHERE id = p_agent;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_location IS NOT NULL THEN RETURN v_location; END IF;
  IF p_agent <> v_org THEN RETURN NULL; END IF;

  SELECT count(*), (array_agg(c.location_id))[1] INTO v_candidates, v_location
  FROM (
    SELECT DISTINCT p.location_id
    FROM properties p JOIN locations l ON l.id = p.location_id
    WHERE p.organization_id = v_org AND l.status = 'ACTIVE'
  ) c;
  IF v_candidates <> 1 THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM seller_agents x
    WHERE x.location_id = v_location AND x.scenario = 'sales' AND x.lifecycle <> 'archived' AND x.id <> p_agent
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE seller_agents a
  SET location_id = v_location,
      lifecycle = CASE WHEN a.lifecycle = 'draft'
                            AND EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.organization_id = a.id AND sp.profile_applied_at IS NOT NULL)
                       THEN 'active' ELSE a.lifecycle END,
      updated_at = now()
  WHERE a.id = p_agent;
  RETURN v_location;
END $$;

-- 4. Предпроверка по всей базе, затем backfill. Красная проверка — отказ миграции без изменений данных
SELECT seller_scope_assert();
SELECT seller_agents_backfill();
SELECT seller_scope_assert();

$migration_1$;
  INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '26853b7490d3724bc1a78b6e977010dbc94dea7eb3d7dbe4ac8f03b0998c6eab', now(), '20260930000036_seller_agent_scope_expand', NULL, NULL, now(), 1);
 END IF;
END $bundle_1$;

-- 20260930000037_direct_sales_discounts
DO $bundle_2$
BEGIN
 IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000037_direct_sales_discounts' AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND checksum = '1e297955a0f0f905a16d6413e8d87f763a739a723c8c6a9d42c3f854c739f7e3') THEN
  RAISE NOTICE 'Already applied: 20260930000037_direct_sales_discounts';
 ELSIF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260930000037_direct_sales_discounts' AND rolled_back_at IS NULL) THEN
  RAISE EXCEPTION 'Migration checksum/state mismatch: 20260930000037_direct_sales_discounts';
 ELSE
  EXECUTE $migration_2$
-- DATA_MODEL v2.7 §20 (утверждено владельцем 29.09.2026, ADR-128, срез D4): производный тариф и промокод.
-- Все поля новые и необязательные: у существующих тарифов и броней ничего не меняется.

-- Производный тариф: родитель, процент, окно продаж, минимум ночей
ALTER TABLE "rate_plans"
  ADD COLUMN "parent_rate_plan_id" uuid,
  ADD COLUMN "discount_percent" integer,
  ADD COLUMN "min_days_before_arrival" integer,
  ADD COLUMN "max_days_before_arrival" integer,
  ADD COLUMN "min_nights" integer;

ALTER TABLE "rate_plans"
  ADD CONSTRAINT "rate_plans_parent_rate_plan_id_fkey" FOREIGN KEY ("parent_rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "rate_plans_parent_not_self" CHECK ("parent_rate_plan_id" IS NULL OR "parent_rate_plan_id" <> "id"),
  -- производный тариф — это родитель и процент вместе; без родителя ни процента, ни условий
  ADD CONSTRAINT "rate_plans_derived_shape" CHECK (
    ("parent_rate_plan_id" IS NULL AND "discount_percent" IS NULL AND "min_days_before_arrival" IS NULL
      AND "max_days_before_arrival" IS NULL AND "min_nights" IS NULL)
    OR ("parent_rate_plan_id" IS NOT NULL AND "discount_percent" IS NOT NULL)
  ),
  ADD CONSTRAINT "rate_plans_discount_percent" CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 1 AND 90),
  ADD CONSTRAINT "rate_plans_window_days" CHECK (
    ("min_days_before_arrival" IS NULL OR "min_days_before_arrival" >= 0)
    AND ("max_days_before_arrival" IS NULL OR "max_days_before_arrival" >= 0)
    AND ("min_days_before_arrival" IS NULL OR "max_days_before_arrival" IS NULL
         OR "min_days_before_arrival" <= "max_days_before_arrival")
  ),
  ADD CONSTRAINT "rate_plans_min_nights" CHECK ("min_nights" IS NULL OR "min_nights" >= 1);

CREATE INDEX "rate_plans_parent_rate_plan_id_idx" ON "rate_plans"("parent_rate_plan_id");

-- Родитель — обычный тариф того же объекта и той же валюты; у тарифа с производными родителя быть не может.
-- CHECK этого не выразит (нужна другая строка), поэтому триггер: цепочка «производный от производного» невозможна.
CREATE OR REPLACE FUNCTION rate_plans_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_row RECORD;
BEGIN
  IF NEW."parent_rate_plan_id" IS NOT NULL THEN
    SELECT "property_id", "currency", "parent_rate_plan_id" INTO parent_row
      FROM "rate_plans" WHERE "id" = NEW."parent_rate_plan_id";
    IF parent_row."property_id" IS DISTINCT FROM NEW."property_id" THEN
      RAISE EXCEPTION 'Родитель производного тарифа должен быть на том же объекте';
    END IF;
    IF parent_row."currency" IS DISTINCT FROM NEW."currency" THEN
      RAISE EXCEPTION 'Родитель производного тарифа должен быть в той же валюте';
    END IF;
    IF parent_row."parent_rate_plan_id" IS NOT NULL THEN
      RAISE EXCEPTION 'Родитель производного тарифа не может сам быть производным';
    END IF;
    IF EXISTS (SELECT 1 FROM "rate_plans" WHERE "parent_rate_plan_id" = NEW."id") THEN
      RAISE EXCEPTION 'У тарифа есть производные: сделать его производным нельзя';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "rate_plans_parent_guard" BEFORE INSERT OR UPDATE OF "parent_rate_plan_id", "currency", "property_id"
  ON "rate_plans" FOR EACH ROW EXECUTE FUNCTION rate_plans_parent_guard();

-- Промокод объекта
CREATE TABLE "promo_codes" (
  "id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "code" text NOT NULL,
  "discount_percent" integer NOT NULL,
  "stay_from" date,
  "stay_to" date,
  "max_uses" integer,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_codes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "promo_codes_code_format" CHECK ("code" ~ '^[A-Z0-9_-]{3,32}$'),
  CONSTRAINT "promo_codes_discount_percent" CHECK ("discount_percent" BETWEEN 1 AND 90),
  CONSTRAINT "promo_codes_period" CHECK ("stay_from" IS NULL OR "stay_to" IS NULL OR "stay_from" <= "stay_to"),
  CONSTRAINT "promo_codes_max_uses" CHECK ("max_uses" IS NULL OR "max_uses" >= 1)
);
CREATE UNIQUE INDEX "promo_codes_property_id_code_key" ON "promo_codes"("property_id", "code");

-- След промокода в брони; число использований — число броней с этой ссылкой
ALTER TABLE "reservations" ADD COLUMN "promo_code_id" uuid;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "reservations_promo_code_id_idx" ON "reservations"("promo_code_id");

-- Изоляция организаций (§17): объект в строке — как у остальных таблиц объекта (миграция 028)
ALTER TABLE "promo_codes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "promo_codes" FOR ALL TO wetop_app
  USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"));

$migration_2$;
  INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '1e297955a0f0f905a16d6413e8d87f763a739a723c8c6a9d42c3f854c739f7e3', now(), '20260930000037_direct_sales_discounts', NULL, NULL, now(), 1);
 END IF;
END $bundle_2$;

SELECT seller_scope_assert();
DO $validation$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reservations' AND column_name='promo_code_id') THEN RAISE EXCEPTION 'promo_code_id missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='promo_codes' AND c.relrowsecurity) THEN RAISE EXCEPTION 'promo_codes RLS missing'; END IF;
END $validation$;
COMMIT;
SELECT 'WETOP migrations 035-037 applied' AS result;
