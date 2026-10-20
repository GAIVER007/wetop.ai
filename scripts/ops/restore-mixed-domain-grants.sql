-- Restore-only ACL companion for mixed migrations132,134-137.
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
END $restore_acl$;
