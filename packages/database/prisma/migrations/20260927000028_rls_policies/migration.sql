-- DATA_MODEL v1.13 §17.3 (ADR-103), план plans/rls-2026-09-27.md шаги 3–4: Row Level Security.
--
-- Политики действуют только на роль wetop_app (TO wetop_app). FORCE не ставится (§17.3): владелец таблиц — роль
-- миграций, служебная роль — BYPASSRLS; пока API не переключён на wetop_app (DATABASE_APP_URL), поведение прежнее.
-- У wetop_app без переменной app.org_id строк нет: app_current_org() = NULL, сравнение с NULL — ложь.

-- Объект своей организации
CREATE OR REPLACE FUNCTION app_property_visible(pid uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM "properties" p WHERE p."id" = pid AND p."organization_id" = app_current_org())
$$;

DO $$
DECLARE
  t text;
  -- организация прямо в строке
  direct text[] := ARRAY['memberships','sessions','invites','user_errors','seller_profiles','organization_extensions',
                         'seller_agents','wizard_drafts','properties','guests','audit_logs'];
  -- объект в строке
  by_property text[] := ARRAY['buildings','accommodation_types','inventory_units','reservations','rate_plans',
                              'channel_mappings','services','payments','tracked_sites'];
  -- через родителя: таблица, колонка, родитель (у родителя своя политика — она и режет)
  by_parent text[][] := ARRAY[
    ['floors','building_id','buildings'],
    ['physical_rooms','floor_id','floors'],
    ['reservation_items','reservation_id','reservations'],
    ['stay_guests','reservation_item_id','reservation_items'],
    ['allocations','reservation_item_id','reservation_items'],
    ['guest_documents','guest_id','guests'],
    ['housekeeping_events','inventory_unit_id','inventory_units'],
    ['inventory_blocks','inventory_unit_id','inventory_units'],
    ['rate_plan_accommodation_types','rate_plan_id','rate_plans'],
    ['daily_rates','rate_plan_id','rate_plans'],
    ['restrictions','rate_plan_id','rate_plans'],
    ['folios','reservation_item_id','reservation_items'],
    ['charges','folio_id','folios'],
    ['payment_allocations','folio_id','folios'],
    ['refunds','folio_id','folios'],
    ['web_sessions','site_id','tracked_sites'],
    ['web_pageviews','session_id','web_sessions'],
    ['web_events','session_id','web_sessions'],
    ['wizard_jobs','draft_id','wizard_drafts'],
    ['wizard_messages','draft_id','wizard_drafts']
  ];
  i int;
BEGIN
  EXECUTE 'ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_tenant ON "organizations" FOR ALL TO wetop_app
             USING ("id" = app_current_org()) WITH CHECK ("id" = app_current_org())';

  FOREACH t IN ARRAY direct LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY rls_tenant ON %I FOR ALL TO wetop_app
                      USING ("organization_id" = app_current_org()) WITH CHECK ("organization_id" = app_current_org())', t);
  END LOOP;

  FOREACH t IN ARRAY by_property LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY rls_tenant ON %I FOR ALL TO wetop_app
                      USING (app_property_visible("property_id")) WITH CHECK (app_property_visible("property_id"))', t);
  END LOOP;

  FOR i IN 1 .. array_length(by_parent, 1) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', by_parent[i][1]);
    EXECUTE format('CREATE POLICY rls_tenant ON %1$I FOR ALL TO wetop_app
                      USING (EXISTS (SELECT 1 FROM %3$I parent WHERE parent."id" = %1$I.%2$I))
                      WITH CHECK (EXISTS (SELECT 1 FROM %3$I parent WHERE parent."id" = %1$I.%2$I))',
                   by_parent[i][1], by_parent[i][2], by_parent[i][3]);
  END LOOP;
END $$;
