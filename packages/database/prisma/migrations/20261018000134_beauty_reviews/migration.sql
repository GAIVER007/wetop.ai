-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ: BEAUTY-REVIEWS-20261018.
-- Apply only with the compatible API release after backup and validation described in README.md.

BEGIN;

CREATE TABLE "beauty_appointment_reviews" (
  "appointment_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "stars" SMALLINT NOT NULL,
  "comment" TEXT,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "beauty_appointment_reviews_pkey" PRIMARY KEY ("appointment_id", "employee_id"),
  CONSTRAINT "beauty_appointment_reviews_appointment_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "beauty_appointment_reviews_employee_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "beauty_appointment_reviews_stars_check" CHECK ("stars" BETWEEN 1 AND 5)
);
CREATE INDEX "beauty_appointment_reviews_employee_submitted_idx"
  ON "beauty_appointment_reviews"("employee_id", "submitted_at");

CREATE TABLE "beauty_review_invitations" (
  "appointment_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "submitted_at" TIMESTAMPTZ(6),
  CONSTRAINT "beauty_review_invitations_pkey" PRIMARY KEY ("appointment_id"),
  CONSTRAINT "beauty_review_invitations_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "beauty_review_invitations_appointment_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE OR REPLACE FUNCTION beauty_appointment_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE appointment_status text;
BEGIN
  SELECT a.status::text INTO appointment_status
  FROM appointments a
  WHERE a.id = NEW.appointment_id;

  IF appointment_status IS DISTINCT FROM 'DONE' THEN
    RAISE EXCEPTION 'Beauty review requires a completed appointment';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM appointment_lines line
    WHERE line.appointment_id = NEW.appointment_id
      AND line.employee_id = NEW.employee_id
  ) THEN
    RAISE EXCEPTION 'Beauty review master must belong to an appointment line';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "beauty_appointment_reviews_guard"
  BEFORE INSERT ON "beauty_appointment_reviews"
  FOR EACH ROW EXECUTE FUNCTION beauty_appointment_review_guard();

ALTER TABLE "beauty_appointment_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beauty_appointment_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "beauty_appointment_reviews" FOR SELECT TO wetop_app
  USING (EXISTS (
    SELECT 1 FROM appointments a
    JOIN locations l ON l.id = a.location_id
    JOIN businesses b ON b.id = l.business_id
    WHERE a.id = beauty_appointment_reviews.appointment_id
      AND b.organization_id = app_current_org()
  ));

ALTER TABLE "beauty_review_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beauty_review_invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "beauty_review_invitations" FOR SELECT TO wetop_app
  USING (EXISTS (
    SELECT 1 FROM appointments a
    JOIN locations l ON l.id = a.location_id
    JOIN businesses b ON b.id = l.business_id
    WHERE a.id = beauty_review_invitations.appointment_id
      AND b.organization_id = app_current_org()
  ));

REVOKE ALL ON TABLE "beauty_appointment_reviews", "beauty_review_invitations" FROM wetop_app, wetop_service;
GRANT SELECT ON TABLE "beauty_appointment_reviews", "beauty_review_invitations" TO wetop_app;
GRANT SELECT, INSERT ON TABLE "beauty_appointment_reviews" TO wetop_service;
GRANT SELECT, INSERT, UPDATE ON TABLE "beauty_review_invitations" TO wetop_service;

DO $$
DECLARE s text := current_schema(); path text;
BEGIN
  path := CASE WHEN s='public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp',s) END;
  EXECUTE format('ALTER FUNCTION %I.beauty_appointment_review_guard() SET search_path = %s',s,path);
END $$;

COMMIT;
