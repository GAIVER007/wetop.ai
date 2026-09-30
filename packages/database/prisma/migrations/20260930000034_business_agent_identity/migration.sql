-- DATA_MODEL v2.8 §20 (утверждён владельцем 30.09.2026, ADR-126), срез SA1.6: личность Business Agent и перенос
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
