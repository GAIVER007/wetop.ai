-- Restore-only ACL companion for mixed migrations132,134-137,140,141,144,146,154.
-- Not a schema migration. Run after ordinary pure-ACL migrations, inside the restore transaction.
-- Copy existing privileges exactly; never replay mixed DDL or end the caller's transaction.
DO $restore_acl$
DECLARE r text; installed integer;
BEGIN
  IF to_regclass('public.customer_imports') IS NOT NULL THEN
    IF to_regclass('public.customer_import_rows') IS NULL THEN
      RAISE EXCEPTION 'Incomplete customer-import schema during ACL restore';
    END IF;
    REVOKE ALL ON customer_imports, customer_import_rows FROM PUBLIC, wetop_app;
    GRANT SELECT, INSERT, UPDATE ON customer_imports, customer_import_rows TO wetop_app;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON customer_imports, customer_import_rows FROM %I', r);
      END IF;
    END LOOP;
    REVOKE ALL ON FUNCTION customer_import_scope_guard() FROM PUBLIC;
    REVOKE ALL ON FUNCTION customer_import_row_identity_guard() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION customer_import_row_identity_guard() TO wetop_app;
    GRANT EXECUTE ON FUNCTION customer_import_scope_guard() TO wetop_app;
  ELSIF to_regclass('public.customer_import_rows') IS NOT NULL THEN
    RAISE EXCEPTION 'Incomplete customer-import schema during ACL restore';
  END IF;

  SELECT count(*) INTO installed FROM unnest(ARRAY[
    'appointment_lines','employee_service_prices',
    'beauty_appointment_reviews','beauty_review_invitations',
    'beauty_service_materials','beauty_service_material_revisions',
    'beauty_positions','beauty_position_permissions','beauty_position_assignments',
    'beauty_location_hours'
  ]) AS t(name) WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,10) THEN RAISE EXCEPTION 'Incomplete Beauty release schema during ACL restore'; END IF;
  IF installed = 10 THEN
    REVOKE ALL ON TABLE beauty_appointment_reviews, beauty_review_invitations FROM wetop_app, wetop_service;
    GRANT SELECT ON TABLE beauty_appointment_reviews, beauty_review_invitations TO wetop_app;
    GRANT SELECT, INSERT ON TABLE beauty_appointment_reviews TO wetop_service;
    GRANT SELECT, INSERT, UPDATE ON TABLE beauty_review_invitations TO wetop_service;

    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE beauty_service_materials TO wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON TABLE beauty_service_material_revisions TO wetop_app, wetop_service;

    REVOKE ALL ON beauty_positions, beauty_position_permissions, beauty_position_assignments FROM PUBLIC, wetop_app, wetop_service;
    GRANT SELECT ON beauty_positions, beauty_position_permissions, beauty_position_assignments TO wetop_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_positions, beauty_position_permissions, beauty_position_assignments TO wetop_service;

    REVOKE ALL ON beauty_location_hours FROM wetop_app, wetop_service;
    GRANT SELECT ON beauty_location_hours TO wetop_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_location_hours TO wetop_service;
  END IF;
  -- 140_client_notifications: exact ACL of the mixed migration (all-or-none)
  SELECT count(*) INTO installed FROM unnest(ARRAY['client_notifications','beauty_reminder_settings']) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,2) THEN RAISE EXCEPTION 'Incomplete client-notifications schema during ACL restore'; END IF;
  IF installed = 2 THEN
    REVOKE ALL ON client_notifications, beauty_reminder_settings FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON client_notifications TO wetop_app;
    GRANT SELECT, INSERT, UPDATE ON client_notifications TO wetop_service;
    GRANT SELECT ON beauty_reminder_settings TO wetop_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_reminder_settings TO wetop_service;
  END IF;

  -- 141_salon_loyalty: exact ACL of the mixed migration (all-or-none)
  SELECT count(*) INTO installed FROM unnest(ARRAY['bonus_programs','customer_bonus_entries','gift_certificates','gift_certificate_entries']) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,4) THEN RAISE EXCEPTION 'Incomplete salon-loyalty schema during ACL restore'; END IF;
  IF installed = 4 THEN
    REVOKE ALL ON bonus_programs, customer_bonus_entries, gift_certificates, gift_certificate_entries FROM wetop_app, wetop_service;
    GRANT SELECT ON bonus_programs TO wetop_app;
    GRANT SELECT, INSERT, UPDATE ON bonus_programs TO wetop_service;
    GRANT SELECT, INSERT ON customer_bonus_entries, gift_certificate_entries TO wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON gift_certificates TO wetop_app, wetop_service;
  END IF;
  -- 145_voice_calls: exact ACL of the voice journal (all-or-none)
  SELECT count(*) INTO installed FROM unnest(ARRAY['voice_calls','voice_callbacks','voice_profiles']) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,3) THEN RAISE EXCEPTION 'Incomplete voice schema during ACL restore'; END IF;
  IF installed = 3 THEN
    REVOKE ALL ON voice_calls, voice_callbacks, voice_profiles FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON voice_calls, voice_callbacks, voice_profiles TO wetop_service;
    GRANT SELECT ON voice_calls, voice_profiles TO wetop_app;
    GRANT SELECT ON voice_callbacks TO wetop_app;
    GRANT UPDATE (status, done_at, done_by_id) ON voice_callbacks TO wetop_app;
    -- 149_voice_booking_settings: column grants for the booking switch and the per-call limit
    GRANT INSERT (agent_id, organization_id, business_id, booking_enabled, booking_max_per_call) ON voice_profiles TO wetop_app;
    GRANT UPDATE (booking_enabled, booking_max_per_call, updated_at) ON voice_profiles TO wetop_app;
  END IF;
  -- 148_voice_booking_quotes: exact ACL of the voice booking quotes
  IF to_regclass('public.voice_booking_quotes') IS NOT NULL THEN
    REVOKE ALL ON voice_booking_quotes FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON voice_booking_quotes TO wetop_service;
    GRANT SELECT ON voice_booking_quotes TO wetop_app;
  END IF;

  -- 144_menu_modifiers_split: exact ACL of the mixed migration (all-or-none)
  SELECT count(*) INTO installed FROM unnest(ARRAY['menu_modifier_groups','menu_modifiers','menu_item_modifier_groups','restaurant_order_item_modifiers','restaurant_payment_items']) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,5) THEN RAISE EXCEPTION 'Incomplete menu-modifiers schema during ACL restore'; END IF;
  IF installed = 5 THEN
    REVOKE ALL ON menu_modifier_groups, menu_modifiers, menu_item_modifier_groups, restaurant_order_item_modifiers, restaurant_payment_items FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON menu_modifier_groups, menu_modifiers, menu_item_modifier_groups, restaurant_order_item_modifiers TO wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON restaurant_payment_items TO wetop_app, wetop_service;
  END IF;

  -- 151_branch_payment_method_settings: exact ACL of the mixed migration (no DELETE: methods are switched off)
  IF to_regclass('public.branch_payment_method_settings') IS NOT NULL THEN
    REVOKE ALL ON branch_payment_method_settings FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON branch_payment_method_settings TO wetop_app, wetop_service;
  END IF;

  -- 152_restaurant_reminders: exact ACL of the mixed migration (all-or-none)
  SELECT count(*) INTO installed FROM unnest(ARRAY['restaurant_reservation_notifications','food_reminder_settings']) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,2) THEN RAISE EXCEPTION 'Incomplete restaurant-reminders schema during ACL restore'; END IF;
  IF installed = 2 THEN
    REVOKE ALL ON restaurant_reservation_notifications, food_reminder_settings FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON restaurant_reservation_notifications TO wetop_app;
    GRANT SELECT, INSERT, UPDATE ON restaurant_reservation_notifications TO wetop_service;
    GRANT SELECT ON food_reminder_settings TO wetop_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON food_reminder_settings TO wetop_service;
  END IF;

  -- 146_content_drafts: exact ACL of the mixed migration (draft is archived, never deleted)
  IF to_regclass('public.content_drafts') IS NOT NULL THEN
    REVOKE ALL ON content_drafts FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON content_drafts TO wetop_app, wetop_service;
  END IF;

  -- 150_location_competitors: exact ACL of the mixed migration (all-or-none); competitors are archived, never deleted
  SELECT count(*) INTO installed FROM unnest(ARRAY['location_competitors','location_competitor_snapshots']) AS t(name)
    WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,2) THEN RAISE EXCEPTION 'Incomplete location-competitors schema during ACL restore'; END IF;
  IF installed = 2 THEN
    REVOKE ALL ON location_competitors, location_competitor_snapshots FROM wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE ON location_competitors TO wetop_app, wetop_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON location_competitor_snapshots TO wetop_app, wetop_service;
  END IF;

  -- 154 staff_telegram_notifications (STAFF-TG-20261020): the three tables exist together or not at all.
  SELECT count(*) INTO installed FROM unnest(ARRAY[
    'staff_telegram_links','staff_telegram_link_codes','staff_notifications'
  ]) AS t(name) WHERE to_regclass('public.' || name) IS NOT NULL;
  IF installed NOT IN (0,3) THEN RAISE EXCEPTION 'Incomplete staff Telegram schema during ACL restore'; END IF;
  IF installed = 3 THEN
    REVOKE ALL ON TABLE staff_telegram_links, staff_telegram_link_codes, staff_notifications FROM wetop_app, wetop_service;
    GRANT SELECT, UPDATE ON TABLE staff_telegram_links TO wetop_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE staff_telegram_link_codes TO wetop_app;
    GRANT SELECT, INSERT ON TABLE staff_notifications TO wetop_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE staff_telegram_links, staff_telegram_link_codes, staff_notifications TO wetop_service;
  END IF;
  -- 160/161_cash_shifts: restore metadata ACL without replaying mixed DDL.
  -- схема по search_path (на проде public, в гейте pms_test): GRANT ниже тоже без схемы
  SELECT count(*) INTO installed FROM unnest(ARRAY['cash_registers','cash_shifts','cash_handovers','cash_commands']) AS t(name)
    WHERE to_regclass(quote_ident(name)) IS NOT NULL;
  IF installed NOT IN (0,4) THEN RAISE EXCEPTION 'Incomplete cash-shift schema during ACL restore'; END IF;
  IF installed = 4 THEN
    REVOKE ALL ON cash_registers,cash_shifts,cash_handovers,cash_commands FROM PUBLIC,wetop_app,wetop_service;
    GRANT SELECT,INSERT,UPDATE ON cash_registers,cash_shifts,cash_handovers TO wetop_app,wetop_service;
    GRANT SELECT,INSERT ON cash_commands TO wetop_app,wetop_service;
    REVOKE ALL ON FUNCTION cash_scope_visible(uuid,uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION cash_scope_visible(uuid,uuid) TO wetop_app,wetop_service;
  END IF;
END $restore_acl$;
