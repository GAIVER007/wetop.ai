-- MV3, owner-approved OnboardingProgress. Production apply requires separate approval.
CREATE TABLE "onboarding_progress" (
  "location_id" uuid PRIMARY KEY REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "flow_version" integer NOT NULL CHECK ("flow_version" > 0),
  "current_step" varchar(50) NOT NULL,
  "draft" jsonb NOT NULL DEFAULT '{}',
  "completed_at" timestamptz(6),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "onboarding_draft_size" CHECK (octet_length("draft"::text) <= 65536)
);
ALTER TABLE "onboarding_progress" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tenant ON "onboarding_progress" FOR ALL TO wetop_app
USING (EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id))
WITH CHECK (EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id));
