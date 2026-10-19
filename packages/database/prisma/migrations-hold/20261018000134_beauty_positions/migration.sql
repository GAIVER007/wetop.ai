-- ОТДЕЛЬНЫЙ РЕЛИЗ: BEAUTY-ACCESS-20261018 + BEAUTY-ACCESS-REVOCATION-20261018.
-- Модель и сохранение отозванных назначений утверждены владельцем 18.10.2026.

BEGIN;

CREATE TABLE beauty_positions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  name varchar(100) NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT beauty_positions_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT beauty_positions_business_id_name_key UNIQUE (business_id, name)
);
CREATE INDEX beauty_positions_business_id_archived_at_idx ON beauty_positions(business_id, archived_at);

CREATE TABLE beauty_position_permissions (
  position_id uuid NOT NULL REFERENCES beauty_positions(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  section varchar(20) NOT NULL,
  action varchar(10) NOT NULL,
  scope varchar(8) NOT NULL,
  CONSTRAINT beauty_position_permissions_pkey PRIMARY KEY (position_id, section, action),
  CONSTRAINT beauty_position_permissions_section_check CHECK (
    section IN ('journal','appointments','customers','employees','services','finance','stock','settings','payroll','reviews')
  ),
  CONSTRAINT beauty_position_permissions_action_check CHECK (action IN ('view','create','update','delete','refund')),
  CONSTRAINT beauty_position_permissions_scope_check CHECK (scope IN ('OWN','BUSINESS')),
  CONSTRAINT beauty_position_permissions_refund_check CHECK (
    action <> 'refund' OR (section = 'finance' AND scope = 'BUSINESS')
  ),
  CONSTRAINT beauty_position_permissions_own_check CHECK (
    scope <> 'OWN' OR (action = 'view' AND section IN ('journal','appointments','payroll','reviews'))
  )
);

CREATE TABLE beauty_position_assignments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  position_id uuid NOT NULL REFERENCES beauty_positions(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  location_id uuid REFERENCES locations(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  revoked_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT beauty_position_assignments_membership_fkey
    FOREIGN KEY (user_id, organization_id) REFERENCES memberships(user_id, organization_id)
    ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX beauty_position_assignments_organization_id_user_id_idx
  ON beauty_position_assignments(organization_id, user_id);
CREATE INDEX beauty_position_assignments_business_id_location_id_idx
  ON beauty_position_assignments(business_id, location_id);
CREATE INDEX beauty_position_assignments_position_id_idx ON beauty_position_assignments(position_id);
-- Отозванная строка тоже занимает область: повторное назначение реактивирует её, а не стирает историю strict mode.
CREATE UNIQUE INDEX beauty_position_assignments_business_key
  ON beauty_position_assignments(organization_id, user_id, business_id) WHERE location_id IS NULL;
CREATE UNIQUE INDEX beauty_position_assignments_location_key
  ON beauty_position_assignments(organization_id, user_id, business_id, location_id) WHERE location_id IS NOT NULL;

CREATE FUNCTION beauty_position_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'Beauty position business is immutable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = NEW.business_id AND b.vertical = 'BEAUTY'
  ) THEN
    RAISE EXCEPTION 'Beauty business required';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM beauty_position_assignments a
      WHERE a.position_id = OLD.id AND a.revoked_at IS NULL
    ) THEN
    RAISE EXCEPTION 'Beauty position has an active assignment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER beauty_position_guard BEFORE INSERT OR UPDATE ON beauty_positions
  FOR EACH ROW EXECUTE FUNCTION beauty_position_guard();

CREATE FUNCTION beauty_position_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member_role "MembershipRole";
  position_business uuid;
  position_archived timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.location_id IS DISTINCT FROM OLD.location_id
  ) THEN
    RAISE EXCEPTION 'Beauty assignment member, organization, business and location are immutable';
  END IF;

  SELECT m.role INTO member_role
  FROM memberships m
  WHERE m.user_id = NEW.user_id AND m.organization_id = NEW.organization_id;
  IF member_role IS NULL THEN
    RAISE EXCEPTION 'Beauty assignment membership is missing';
  END IF;
  IF member_role = 'OWNER' THEN
    RAISE EXCEPTION 'Beauty assignment cannot target an owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = NEW.business_id AND b.organization_id = NEW.organization_id AND b.vertical = 'BEAUTY'
  ) THEN
    RAISE EXCEPTION 'Beauty assignment business does not belong to organization or is not Beauty';
  END IF;
  IF NEW.location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.business_id = NEW.business_id
  ) THEN
    RAISE EXCEPTION 'Beauty assignment location does not belong to business';
  END IF;

  SELECT p.business_id, p.archived_at INTO position_business, position_archived
  FROM beauty_positions p WHERE p.id = NEW.position_id FOR SHARE;
  IF position_business IS NULL THEN
    RAISE EXCEPTION 'Beauty assignment position is missing';
  END IF;
  IF position_business <> NEW.business_id THEN
    RAISE EXCEPTION 'Beauty assignment position does not belong to business';
  END IF;
  IF NEW.revoked_at IS NULL AND position_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Beauty assignment cannot activate an archived position';
  END IF;

  -- Нет membership_scopes: прежняя область всей организации. Есть хотя бы одна строка: назначение обязано
  -- помещаться в неё. Business-wide назначение требует business-wide scope, location назначение принимает
  -- business-wide или точный location scope.
  IF NEW.revoked_at IS NULL AND EXISTS (
    SELECT 1 FROM membership_scopes s
    WHERE s.user_id = NEW.user_id AND s.organization_id = NEW.organization_id
  ) AND NOT EXISTS (
    SELECT 1 FROM membership_scopes s
    WHERE s.user_id = NEW.user_id
      AND s.organization_id = NEW.organization_id
      AND s.business_id = NEW.business_id
      AND (
        (NEW.location_id IS NULL AND s.location_id IS NULL)
        OR (NEW.location_id IS NOT NULL AND (s.location_id IS NULL OR s.location_id = NEW.location_id))
      )
  ) THEN
    RAISE EXCEPTION 'Beauty assignment is outside membership scope';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER beauty_position_assignment_guard BEFORE INSERT OR UPDATE ON beauty_position_assignments
  FOR EACH ROW EXECUTE FUNCTION beauty_position_assignment_guard();

CREATE FUNCTION beauty_position_assignment_retain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Beauty position assignments are retained; set revoked_at instead';
END $$;
CREATE TRIGGER beauty_position_assignment_retain BEFORE DELETE ON beauty_position_assignments
  FOR EACH ROW EXECUTE FUNCTION beauty_position_assignment_retain();

ALTER TABLE beauty_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE beauty_position_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_position_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE beauty_position_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_position_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_tenant ON beauty_positions FOR SELECT TO wetop_app USING (EXISTS (
  SELECT 1 FROM businesses b WHERE b.id = beauty_positions.business_id AND b.organization_id = app_current_org()
));
CREATE POLICY rls_tenant ON beauty_position_permissions FOR SELECT TO wetop_app USING (EXISTS (
  SELECT 1 FROM beauty_positions p JOIN businesses b ON b.id = p.business_id
  WHERE p.id = beauty_position_permissions.position_id AND b.organization_id = app_current_org()
));
CREATE POLICY rls_tenant ON beauty_position_assignments FOR SELECT TO wetop_app
  USING (organization_id = app_current_org());

REVOKE ALL ON beauty_positions, beauty_position_permissions, beauty_position_assignments FROM PUBLIC, wetop_app, wetop_service;
GRANT SELECT ON beauty_positions, beauty_position_permissions, beauty_position_assignments TO wetop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_positions, beauty_position_permissions, beauty_position_assignments TO wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_position_guard() SET search_path = %s', s, path);
  EXECUTE format('ALTER FUNCTION %I.beauty_position_assignment_guard() SET search_path = %s', s, path);
  EXECUTE format('ALTER FUNCTION %I.beauty_position_assignment_retain() SET search_path = %s', s, path);
END $$;

COMMIT;
