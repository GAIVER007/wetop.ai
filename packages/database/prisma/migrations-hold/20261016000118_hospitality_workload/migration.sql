-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (../README.md): only after exact release approval, verified restore and compatible writers.
-- HELD: explicit property tracking only. No reconstruction before observed_at.
CREATE TABLE hospitality_workload_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES properties(id),
 location_id uuid NOT NULL REFERENCES locations(id),timezone text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),revision bigint GENERATED ALWAYS AS IDENTITY,
 UNIQUE(id,property_id,location_id)
);
CREATE TABLE hospitality_workload_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL,property_id uuid NOT NULL,location_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('UNIT','ALLOCATION','BLOCK')),source_id uuid NOT NULL,
 unit_id uuid NOT NULL,kind text CHECK(kind IN ('ROOM','BED')),active boolean,
 date_from date,date_to date,status text,
 FOREIGN KEY(version_id,property_id,location_id) REFERENCES hospitality_workload_versions(id,property_id,location_id)
);
CREATE INDEX hospitality_history_scope ON hospitality_workload_versions(property_id,observed_at,revision);
CREATE INDEX hospitality_source_version ON hospitality_workload_sources(version_id);
CREATE FUNCTION capture_hospitality_workload(target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v uuid:=gen_random_uuid(); loc uuid; zone text;
BEGIN
 SELECT p.location_id,p.timezone INTO STRICT loc,zone FROM properties p JOIN locations l ON l.id=p.location_id JOIN businesses b ON b.id=l.business_id WHERE p.id=target AND p.organization_id=b.organization_id AND b.vertical='HOSPITALITY' FOR UPDATE OF p;
 INSERT INTO hospitality_workload_versions(id,property_id,location_id,timezone) VALUES(v,target,loc,zone);
 INSERT INTO hospitality_workload_sources(version_id,property_id,location_id,source_kind,source_id,unit_id,kind,active)
 SELECT v,target,loc,'UNIT',u.id,u.id,u.kind::text,u.active FROM inventory_units u WHERE u.property_id=target;
 INSERT INTO hospitality_workload_sources(version_id,property_id,location_id,source_kind,source_id,unit_id,date_from,date_to,status)
 SELECT v,target,loc,'ALLOCATION',a.id,a.inventory_unit_id,a.start_date,a.end_date,i.status::text FROM allocations a JOIN inventory_units u ON u.id=a.inventory_unit_id JOIN reservation_items i ON i.id=a.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE u.property_id=target AND r.property_id=target;
 INSERT INTO hospitality_workload_sources(version_id,property_id,location_id,source_kind,source_id,unit_id,date_from,date_to,status)
 SELECT v,target,loc,'BLOCK',b.id,b.inventory_unit_id,b.date_from,b.date_to,b.type::text FROM inventory_blocks b JOIN inventory_units u ON u.id=b.inventory_unit_id WHERE u.property_id=target;
END $$;
CREATE FUNCTION hospitality_workload_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; rowdata record;
BEGIN
 IF TG_OP='DELETE' THEN rowdata:=OLD; ELSE rowdata:=NEW; END IF;
 IF TG_TABLE_NAME='inventory_units' THEN target:=rowdata.property_id;
 ELSIF TG_TABLE_NAME='properties' THEN target:=rowdata.id;
 ELSIF TG_TABLE_NAME='reservation_items' THEN SELECT property_id INTO target FROM reservations WHERE id=rowdata.reservation_id;
 ELSE SELECT property_id INTO target FROM inventory_units WHERE id=rowdata.inventory_unit_id; END IF;
 IF EXISTS(SELECT 1 FROM hospitality_workload_versions WHERE property_id=target) THEN PERFORM capture_hospitality_workload(target); END IF;
 RETURN rowdata;
END $$;
CREATE TRIGGER hospitality_units AFTER INSERT OR UPDATE OR DELETE ON inventory_units FOR EACH ROW EXECUTE FUNCTION hospitality_workload_changed();
CREATE TRIGGER hospitality_allocations AFTER INSERT OR UPDATE OR DELETE ON allocations FOR EACH ROW EXECUTE FUNCTION hospitality_workload_changed();
CREATE TRIGGER hospitality_blocks AFTER INSERT OR UPDATE OR DELETE ON inventory_blocks FOR EACH ROW EXECUTE FUNCTION hospitality_workload_changed();
CREATE TRIGGER hospitality_stays AFTER INSERT OR UPDATE OR DELETE ON reservation_items FOR EACH ROW EXECUTE FUNCTION hospitality_workload_changed();
CREATE TRIGGER hospitality_zone AFTER UPDATE OF timezone ON properties FOR EACH ROW EXECUTE FUNCTION hospitality_workload_changed();
CREATE FUNCTION hospitality_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'HOSPITALITY_HISTORY_IMMUTABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM properties p JOIN locations l ON l.id=p.location_id JOIN businesses b ON b.id=l.business_id WHERE p.id=NEW.property_id AND p.location_id=NEW.location_id AND p.organization_id=b.organization_id) THEN RAISE EXCEPTION 'HOSPITALITY_HISTORY_SCOPE'; END IF;
 IF TG_TABLE_NAME='hospitality_workload_sources' THEN
 IF NOT EXISTS(SELECT 1 FROM inventory_units u WHERE u.id=NEW.unit_id AND u.property_id=NEW.property_id) THEN RAISE EXCEPTION 'HOSPITALITY_UNIT_SCOPE'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['hospitality_workload_versions','hospitality_workload_sources'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY rls_tenant ON %I TO wetop_app USING(EXISTS(SELECT 1 FROM properties p WHERE p.id=property_id AND p.organization_id=app_current_org())) WITH CHECK(EXISTS(SELECT 1 FROM properties p WHERE p.id=property_id AND p.organization_id=app_current_org()))',tab);
 EXECUTE format('CREATE TRIGGER hospitality_immutable BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION hospitality_history_guard()',tab);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO wetop_app',tab);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE hospitality_workload_versions_revision_seq TO wetop_app;
REVOKE ALL ON FUNCTION capture_hospitality_workload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_hospitality_workload(uuid) TO wetop_app;

-- Bind only this migration's owned routines to the actual application schema.
DO $owner_home_search_path$
DECLARE target_schema text := current_schema(); routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=target_schema AND p.proname=ANY(ARRAY['capture_hospitality_workload','hospitality_history_guard','hospitality_workload_changed'])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public, pg_temp',routine.signature,target_schema);
  END LOOP;
END
$owner_home_search_path$;
