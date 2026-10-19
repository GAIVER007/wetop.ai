-- Pure ACL companion for existing132/134/136/137 restrictions; no new access policy.
-- No outer transaction commands: db-restore-prod.sh owns the entire restore transaction.
REVOKE ALL ON customer_imports, customer_import_rows FROM PUBLIC, wetop_app;
GRANT SELECT, INSERT, UPDATE ON customer_imports, customer_import_rows TO wetop_app;
DO $grants$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON customer_imports,customer_import_rows FROM %I',r);
    END IF;
  END LOOP;
END $grants$;
REVOKE ALL ON FUNCTION customer_import_scope_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION customer_import_row_identity_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION customer_import_row_identity_guard() TO wetop_app;
GRANT EXECUTE ON FUNCTION customer_import_scope_guard() TO wetop_app;

REVOKE ALL ON beauty_appointment_reviews, beauty_review_invitations FROM wetop_app, wetop_service;
GRANT SELECT ON beauty_appointment_reviews, beauty_review_invitations TO wetop_app;
GRANT SELECT, INSERT ON beauty_appointment_reviews TO wetop_service;
GRANT SELECT, INSERT, UPDATE ON beauty_review_invitations TO wetop_service;

REVOKE ALL ON beauty_positions, beauty_position_permissions, beauty_position_assignments FROM PUBLIC, wetop_app, wetop_service;
GRANT SELECT ON beauty_positions, beauty_position_permissions, beauty_position_assignments TO wetop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_positions, beauty_position_permissions, beauty_position_assignments TO wetop_service;

REVOKE ALL ON beauty_location_hours FROM wetop_app, wetop_service;
GRANT SELECT ON beauty_location_hours TO wetop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_location_hours TO wetop_service;
