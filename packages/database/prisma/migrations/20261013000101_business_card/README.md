# Business card metadata

Approved: DATA_MODEL.md 18.1.1 and ADR-ORG-CARD-20261013.

Before production, the owner saves a private database backup and records the deployed SHA. This migration is not applied by the agent to production.

Forward: apply migration.sql under the normal migration procedure. Validate nullable fields, the CHECK constraint, existing RLS policies and organization isolation. Existing business rows retain name, vertical, status and tenant ownership.

Rollback: first roll back the code that selects the new columns. Export new metadata to private backup, then apply down.sql. Files stay in private object storage for recovery. Names remain in the pre-existing name field; changing a name is an audited user action, not a migration backfill.

Uploads are re-encoded, metadata stripped, and stored through the existing private S3 adapter. No secret, raw object key or signed URL is logged or put in audit JSON.
