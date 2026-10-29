-- 170: служебная запись компании WETOP и счётчик её сайта wetop.ai (кабинет руководителя, владелец 29.10.2026).
-- Кабинет считает компанией организацию, к филиалу которой привязан сайт wetop.ai (companyOrganizationIds), и
-- считает посетителей по этому сайту. Ключ счётчика уже вписан в главную (apps/site/src/site.config.ts).
-- Только добавление строк, ничего не меняется и не удаляется. На пустой базе (новая установка, тесты) ничего не
-- делает: запись нужна только рабочей базе с клиентами. Повторный запуск ничего не дублирует.
DO $$
DECLARE org_id uuid; biz_id uuid; loc_id uuid; site_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM tracked_sites WHERE hosts && ARRAY['wetop.ai', 'www.wetop.ai']) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM tracked_sites WHERE public_key = 'pms_6bc9c752e9c0') THEN
    RAISE EXCEPTION 'Ключ счётчика wetop.ai занят другим сайтом: ничего не изменено';
  END IF;
  org_id := gen_random_uuid(); biz_id := gen_random_uuid(); loc_id := gen_random_uuid(); site_id := gen_random_uuid();
  INSERT INTO organizations (id, name, status, reporting_currency) VALUES (org_id, 'WETOP (сайт)', 'ACTIVE', 'USD');
  INSERT INTO businesses (id, organization_id, name, vertical, updated_at)
    VALUES (biz_id, org_id, 'WETOP (сайт)', 'HOSPITALITY', now());
  INSERT INTO locations (id, business_id, name, timezone, currency, updated_at)
    VALUES (loc_id, biz_id, 'wetop.ai', 'UTC', 'USD', now());
  INSERT INTO tracked_sites (id, location_id, name, hosts, public_key, status, updated_at)
    VALUES (site_id, loc_id, 'wetop.ai', ARRAY['wetop.ai', 'www.wetop.ai'], 'pms_6bc9c752e9c0', 'ACTIVE', now());
  INSERT INTO audit_logs (id, organization_id, user_id, entity_type, entity_id, action, after)
    -- строка платформы, не организации (organization_id пуст): откат может убрать служебную запись целиком
    VALUES (gen_random_uuid(), NULL, NULL, 'tracked_site', site_id::text, 'platform.company_site.counter',
            jsonb_build_object('by', 'migration-170', 'hosts', ARRAY['wetop.ai', 'www.wetop.ai']));
END $$;
