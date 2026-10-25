-- CASH-SHIFTS-20261025: additive. Production applies owner after backup.
CREATE FUNCTION cash_scope_visible(p uuid, l uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN p IS NOT NULL THEN app_property_visible(p) ELSE EXISTS (
  SELECT 1 FROM locations x JOIN businesses b ON b.id=x.business_id
  WHERE x.id=l AND b.organization_id=app_current_org()
 ) END
$$;
CREATE TABLE cash_registers (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id),
 property_id uuid UNIQUE REFERENCES properties(id), location_id uuid UNIQUE REFERENCES locations(id),
 name text NOT NULL, currency char(3) NOT NULL, cashier_ids uuid[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((property_id IS NULL) <> (location_id IS NULL))
);
CREATE TABLE cash_shifts (
 id uuid PRIMARY KEY, register_id uuid NOT NULL REFERENCES cash_registers(id),
 responsible_user_id uuid NOT NULL REFERENCES users(id), opened_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz, closed_by_id uuid REFERENCES users(id),
 opening jsonb NOT NULL, closing jsonb,
 CHECK ((closed_at IS NULL AND closing IS NULL AND closed_by_id IS NULL)
  OR (closed_at IS NOT NULL AND closing IS NOT NULL AND closed_by_id IS NOT NULL))
);
CREATE UNIQUE INDEX cash_shifts_one_open ON cash_shifts(register_id) WHERE closed_at IS NULL;
CREATE INDEX cash_shifts_history ON cash_shifts(register_id,opened_at DESC);
ALTER TABLE cash_operations ADD COLUMN cash_shift_id uuid REFERENCES cash_shifts(id);
ALTER TABLE restaurant_cash_operations ADD COLUMN cash_shift_id uuid REFERENCES cash_shifts(id);
CREATE TABLE cash_handovers (
 id uuid PRIMARY KEY, register_id uuid NOT NULL REFERENCES cash_registers(id),
 shift_id uuid NOT NULL REFERENCES cash_shifts(id), amount bigint NOT NULL CHECK(amount>0),
 recipient_id uuid NOT NULL REFERENCES users(id), requested_by_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz,
 CHECK (recipient_id<>requested_by_id), UNIQUE(shift_id)
);
CREATE TABLE cash_commands (
 register_id uuid NOT NULL REFERENCES cash_registers(id), command_key uuid NOT NULL,
 fingerprint text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(register_id,command_key)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cash_registers','cash_shifts','cash_handovers','cash_commands'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO wetop_app,wetop_service',t);
  EXECUTE format('REVOKE DELETE ON %I FROM wetop_app,wetop_service',t);
 END LOOP;
END $$;
CREATE POLICY rls_tenant ON cash_registers FOR ALL TO wetop_app
 USING (cash_scope_visible(property_id,location_id)) WITH CHECK (cash_scope_visible(property_id,location_id));
CREATE POLICY rls_tenant ON cash_shifts FOR ALL TO wetop_app
 USING (EXISTS(SELECT 1 FROM cash_registers r WHERE r.id=register_id))
 WITH CHECK (EXISTS(SELECT 1 FROM cash_registers r WHERE r.id=register_id));
CREATE POLICY rls_tenant ON cash_handovers FOR ALL TO wetop_app
 USING (EXISTS(SELECT 1 FROM cash_registers r WHERE r.id=register_id))
 WITH CHECK (EXISTS(SELECT 1 FROM cash_registers r WHERE r.id=register_id));
CREATE POLICY rls_tenant ON cash_commands FOR ALL TO wetop_app
 USING (EXISTS(SELECT 1 FROM cash_registers r WHERE r.id=register_id))
 WITH CHECK (EXISTS(SELECT 1 FROM cash_registers r WHERE r.id=register_id));
GRANT EXECUTE ON FUNCTION cash_scope_visible(uuid,uuid) TO wetop_app,wetop_service;
