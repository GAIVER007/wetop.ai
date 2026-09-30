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
BEGIN
  IF EXISTS (SELECT 1 FROM seller_agents WHERE id = p_org) THEN
    RETURN false;
  END IF;

  -- автор — самый ранний владелец, иначе самый ранний участник
  SELECT m.user_id INTO v_author FROM memberships m WHERE m.organization_id = p_org
  ORDER BY (m.role = 'OWNER') DESC, m.created_at ASC, m.user_id LIMIT 1;
  IF v_author IS NULL THEN
    -- Автора нет: агента не заводим. Сохранение профиля прежним кодом из-за этого падать не должно;
    -- организации с продавцом, но без участников, останавливает предпроверка (seller_scope_assert)
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
