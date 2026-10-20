-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (../README.md): only after exact release approval, verified restore and compatible writers.
-- Held release: actual physical occupancy, never inferred from booking/order time.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE table_occupancy_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
 table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
 reservation_id uuid REFERENCES restaurant_reservations(id) ON DELETE RESTRICT,
 order_id uuid REFERENCES restaurant_orders(id) ON DELETE RESTRICT,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ended_at timestamptz,
 created_by_id uuid REFERENCES users(id), closed_by_id uuid REFERENCES users(id),
 idempotency_key varchar(200) NOT NULL,
 CHECK(ended_at IS NULL OR ended_at>=started_at),
 UNIQUE(location_id,idempotency_key),
 EXCLUDE USING gist(table_id WITH =,tstzrange(started_at,ended_at,'[)') WITH &&)
);
CREATE UNIQUE INDEX occupancy_one_active ON table_occupancy_sessions(table_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX occupancy_one_reservation ON table_occupancy_sessions(reservation_id) WHERE ended_at IS NULL AND reservation_id IS NOT NULL;
CREATE UNIQUE INDEX occupancy_one_order ON table_occupancy_sessions(order_id) WHERE ended_at IS NULL AND order_id IS NOT NULL;
CREATE TABLE table_occupancy_commands (
 location_id uuid NOT NULL REFERENCES locations(id), intent_key varchar(200) NOT NULL,
 action text NOT NULL CHECK(action IN ('SEAT','MOVE','RELEASE')),
 table_id uuid REFERENCES dining_tables(id), session_id uuid REFERENCES table_occupancy_sessions(id),
 reservation_id uuid REFERENCES restaurant_reservations(id), order_id uuid REFERENCES restaurant_orders(id),
 result_id uuid NOT NULL REFERENCES table_occupancy_sessions(id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(location_id,intent_key)
);
CREATE FUNCTION occupancy_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.location_id,NEW.table_id,NEW.reservation_id,NEW.order_id) IS DISTINCT FROM ROW(OLD.location_id,OLD.table_id,OLD.reservation_id,OLD.order_id) THEN RAISE EXCEPTION 'retained occupancy links are immutable'; END IF;
 END IF;
 -- SHARE (not KEY SHARE) conflicts with non-key parent scope updates too.
 PERFORM b.id FROM businesses b JOIN locations l ON l.business_id=b.id WHERE l.id=NEW.location_id FOR SHARE OF b;
 PERFORM id FROM locations WHERE id=NEW.location_id FOR SHARE;
 PERFORM a.id FROM dining_areas a JOIN dining_tables t ON t.area_id=a.id WHERE t.id=NEW.table_id FOR SHARE OF a;
 PERFORM id FROM dining_tables WHERE id=NEW.table_id FOR SHARE;
 PERFORM id FROM restaurant_reservations WHERE id=NEW.reservation_id FOR SHARE;
 PERFORM id FROM restaurant_orders WHERE id=NEW.order_id FOR SHARE;
 IF NEW.table_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dining_tables t JOIN dining_areas a ON a.id=t.area_id WHERE t.id=NEW.table_id AND a.location_id=NEW.location_id) THEN RAISE EXCEPTION 'occupancy table scope mismatch'; END IF;
 IF NEW.reservation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM restaurant_reservations WHERE id=NEW.reservation_id AND location_id=NEW.location_id) THEN RAISE EXCEPTION 'occupancy reservation scope mismatch'; END IF;
 IF NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM restaurant_orders WHERE id=NEW.order_id AND location_id=NEW.location_id) THEN RAISE EXCEPTION 'occupancy order scope mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER occupancy_scope BEFORE INSERT OR UPDATE ON table_occupancy_sessions FOR EACH ROW EXECUTE FUNCTION occupancy_scope_guard();
CREATE TRIGGER occupancy_command_scope BEFORE INSERT OR UPDATE ON table_occupancy_commands FOR EACH ROW EXECUTE FUNCTION occupancy_scope_guard();
-- Parent rows are locked by the link guard; UPDATE already holds its own row lock.
CREATE FUNCTION occupancy_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE retained boolean := false; target uuid;
BEGIN
 IF TG_TABLE_NAME='dining_tables' THEN
  IF NEW.area_id IS NOT DISTINCT FROM OLD.area_id THEN RETURN NEW; END IF;
  SELECT location_id INTO target FROM dining_areas WHERE id=NEW.area_id FOR SHARE;
  SELECT EXISTS(SELECT 1 FROM table_occupancy_sessions WHERE table_id=OLD.id AND location_id IS DISTINCT FROM target) OR EXISTS(SELECT 1 FROM table_occupancy_commands WHERE table_id=OLD.id AND location_id IS DISTINCT FROM target) INTO retained;
 ELSIF TG_TABLE_NAME='dining_areas' THEN
  IF NEW.location_id IS NOT DISTINCT FROM OLD.location_id THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM table_occupancy_sessions s JOIN dining_tables t ON t.id=s.table_id WHERE t.area_id=OLD.id) OR EXISTS(SELECT 1 FROM table_occupancy_commands s JOIN dining_tables t ON t.id=s.table_id WHERE t.area_id=OLD.id) INTO retained;
 ELSIF TG_TABLE_NAME='restaurant_reservations' THEN
  IF NEW.location_id IS NOT DISTINCT FROM OLD.location_id THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM table_occupancy_sessions WHERE reservation_id=OLD.id) OR EXISTS(SELECT 1 FROM table_occupancy_commands WHERE reservation_id=OLD.id) INTO retained;
 ELSIF TG_TABLE_NAME='restaurant_orders' THEN
  IF NEW.location_id IS NOT DISTINCT FROM OLD.location_id THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM table_occupancy_sessions WHERE order_id=OLD.id) OR EXISTS(SELECT 1 FROM table_occupancy_commands WHERE order_id=OLD.id) INTO retained;
 ELSIF TG_TABLE_NAME='locations' THEN
  IF NEW.business_id IS NOT DISTINCT FROM OLD.business_id THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM table_occupancy_sessions WHERE location_id=OLD.id) INTO retained;
 ELSIF TG_TABLE_NAME='businesses' THEN
  IF NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM table_occupancy_sessions s JOIN locations l ON l.id=s.location_id WHERE l.business_id=OLD.id) INTO retained;
 END IF;
 IF retained THEN RAISE EXCEPTION 'retained occupancy parent scope is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER occupancy_parent BEFORE UPDATE ON dining_tables FOR EACH ROW EXECUTE FUNCTION occupancy_parent_guard();
CREATE TRIGGER occupancy_parent BEFORE UPDATE ON dining_areas FOR EACH ROW EXECUTE FUNCTION occupancy_parent_guard();
CREATE TRIGGER occupancy_parent BEFORE UPDATE ON restaurant_reservations FOR EACH ROW EXECUTE FUNCTION occupancy_parent_guard();
CREATE TRIGGER occupancy_parent BEFORE UPDATE ON restaurant_orders FOR EACH ROW EXECUTE FUNCTION occupancy_parent_guard();
CREATE TRIGGER occupancy_parent BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION occupancy_parent_guard();
CREATE TRIGGER occupancy_parent BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION occupancy_parent_guard();
CREATE INDEX occupancy_history_page ON table_occupancy_sessions(location_id,id);
CREATE FUNCTION occupancy_command(loc uuid,k text,act text,tbl uuid,sid uuid,res uuid,ord uuid,actor uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE old table_occupancy_commands; s table_occupancy_sessions; result uuid; observed timestamptz;
BEGIN
 IF k IS NULL OR length(k)=0 OR length(k)>200 THEN RAISE EXCEPTION 'invalid occupancy key'; END IF;
 -- Same lock order as foodTransaction: location first, tables sorted.
 PERFORM id FROM locations WHERE id=loc FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'location unavailable'; END IF;
 SELECT * INTO old FROM table_occupancy_commands WHERE location_id=loc AND intent_key=k;
 IF FOUND THEN
  IF ROW(old.action,old.table_id,old.session_id,old.reservation_id,old.order_id) IS DISTINCT FROM ROW(act,tbl,sid,res,ord) THEN RAISE EXCEPTION 'occupancy key payload conflict'; END IF;
  RETURN old.result_id;
 END IF;
 IF act NOT IN ('SEAT','MOVE','RELEASE') THEN RAISE EXCEPTION 'invalid occupancy action'; END IF;
 IF act IN ('MOVE','RELEASE') THEN
  SELECT * INTO s FROM table_occupancy_sessions WHERE id=sid AND location_id=loc AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active session unavailable'; END IF;
 END IF;
 PERFORM id FROM dining_tables WHERE id IN(tbl,s.table_id) ORDER BY id FOR UPDATE;
 observed:=clock_timestamp();
 IF act IN ('SEAT','MOVE') THEN
  IF NOT EXISTS(SELECT 1 FROM dining_tables t JOIN dining_areas a ON a.id=t.area_id WHERE t.id=tbl AND a.location_id=loc AND t.active AND a.active AND NOT t.needs_cleaning) THEN RAISE EXCEPTION 'table unavailable'; END IF;
 END IF;
 IF act IN ('MOVE','RELEASE') THEN
  UPDATE table_occupancy_sessions SET ended_at=observed,closed_by_id=actor WHERE id=s.id;
  UPDATE dining_tables SET needs_cleaning=true,updated_at=observed WHERE id=s.table_id;
  result:=s.id;
 END IF;
 IF act IN ('SEAT','MOVE') THEN
  INSERT INTO table_occupancy_sessions(location_id,table_id,reservation_id,order_id,started_at,created_by_id,idempotency_key)
  VALUES(loc,tbl,CASE WHEN act='MOVE' THEN s.reservation_id ELSE res END,CASE WHEN act='MOVE' THEN s.order_id ELSE ord END,observed,actor,k) RETURNING id INTO result;
  IF act='MOVE' AND s.reservation_id IS NOT NULL THEN UPDATE table_assignments SET table_id=tbl,assigned_at=observed,assigned_by_id=actor WHERE reservation_id=s.reservation_id; END IF;
 END IF;
 INSERT INTO table_occupancy_commands(location_id,intent_key,action,table_id,session_id,reservation_id,order_id,result_id) VALUES(loc,k,act,tbl,sid,res,ord,result);
 RETURN result;
END $$;
ALTER TABLE table_occupancy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_occupancy_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE table_occupancy_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_occupancy_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON table_occupancy_sessions TO wetop_app USING(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
CREATE POLICY rls_tenant ON table_occupancy_commands TO wetop_app USING(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org())) WITH CHECK(EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=location_id AND b.organization_id=app_current_org()));
GRANT SELECT,INSERT,UPDATE ON table_occupancy_sessions,table_occupancy_commands TO wetop_app;
REVOKE ALL ON FUNCTION occupancy_command(uuid,text,text,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION occupancy_command(uuid,text,text,uuid,uuid,uuid,uuid,uuid) TO wetop_app;

-- Bind only this migration's owned routines to the actual application schema.
DO $owner_home_search_path$
DECLARE target_schema text := current_schema(); routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=target_schema AND p.proname=ANY(ARRAY['occupancy_command','occupancy_parent_guard','occupancy_scope_guard'])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public, pg_temp',routine.signature,target_schema);
  END LOOP;
END
$owner_home_search_path$;
