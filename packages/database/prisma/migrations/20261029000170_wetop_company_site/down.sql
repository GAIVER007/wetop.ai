-- Откат 170: убрать служебную запись WETOP (сайт), только если у неё нет людей и посетителей не копили.
-- Посетители сайта (web_sessions) при откате остаются в базе вместе с записью: тогда откат ничего не делает.
DO $$
DECLARE site record;
BEGIN
  SELECT t.id, l.id AS loc, b.id AS biz, b.organization_id AS org INTO site
  FROM tracked_sites t JOIN locations l ON l.id = t.location_id JOIN businesses b ON b.id = l.business_id
  WHERE t.public_key = 'pms_6bc9c752e9c0';
  IF site.id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM web_sessions WHERE site_id = site.id)
     OR EXISTS (SELECT 1 FROM memberships WHERE organization_id = site.org) THEN
    RAISE NOTICE 'WETOP (сайт) уже с посетителями или людьми: оставлено как есть'; RETURN;
  END IF;
  -- журнал только дописывается: строка о заведении остаётся, рядом пишется строка об откате
  INSERT INTO audit_logs (id, organization_id, user_id, entity_type, entity_id, action, after)
    VALUES (gen_random_uuid(), NULL, NULL, 'tracked_site', site.id::text, 'platform.company_site.counter_removed',
            jsonb_build_object('by', 'migration-170-down'));
  DELETE FROM tracked_sites WHERE id = site.id;
  DELETE FROM locations WHERE id = site.loc;
  DELETE FROM businesses WHERE id = site.biz;
  DELETE FROM organizations WHERE id = site.org AND name = 'WETOP (сайт)';
END $$;
