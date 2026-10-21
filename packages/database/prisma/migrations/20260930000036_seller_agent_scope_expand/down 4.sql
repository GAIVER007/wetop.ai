-- Откат 20260930000036_seller_agent_scope_expand (SA2.5, шаг A): снимает функции предпроверки и возвращает прежние тела
-- seller_agent_ensure / seller_agents_backfill из 034 дословно (выбор самого раннего объекта). Данные не откатываются:
-- филиалы агентов и agent_id профилей, заполненные backfill, остаются — они однозначны и прежним кодом не читаются.
DROP FUNCTION IF EXISTS seller_agent_bind_location(uuid);
DROP FUNCTION IF EXISTS seller_scope_assert(uuid);
DROP FUNCTION IF EXISTS seller_scope_precheck(uuid);

CREATE OR REPLACE FUNCTION seller_agent_ensure(p_org uuid, p_name text DEFAULT NULL, p_applied boolean DEFAULT NULL) RETURNS boolean
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

  UPDATE seller_profiles SET agent_id = organization_id
  WHERE agent_id IS NULL AND EXISTS (SELECT 1 FROM seller_agents a WHERE a.id = seller_profiles.organization_id);
  RETURN v_created;
END $$;
