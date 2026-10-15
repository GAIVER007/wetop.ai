# MV1 production migration handoff

MV1 accepted and merged: PR #238, merge d91c207a. Migration 20261004000051_food_service_vertical is not applied to production by this session. Owner must approve and execute separately from this handoff. Values below must be captured from target at execution time, they are not fabricated production observations.

## Preflight

- Record PostgreSQL `SELECT version();`, migration status and deployed release SHA.
- `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname='BusinessVertical' ORDER BY enumsortorder;`
- `SELECT count(*) FROM businesses;`
- `SELECT vertical::text,count(*) FROM businesses GROUP BY vertical::text;`
- Record Property and Location counts. Confirm existing Businesses are HOSPITALITY/BEAUTY and no unexpected schema drift.
- Encrypted pg_dump custom-format backup outside Git, restrict access and validate isolated restore. Record backup timestamp and storage reference without credentials.

## Apply and verify

Apply reviewed migration via normal Prisma deployment procedure against the direct target connection from secret storage. Enum becomes HOSPITALITY, BEAUTY, FOOD_SERVICE. Counts of Business, Location and Property remain unchanged; no backfill. Verify migration status and empty schema diff. Run authenticated Hospitality smoke: login, scope selection, chessboard/reservations/inventory/rates read; check provider webhook route binding without submitting production external events.

## Rollback conditions

On application errors revert the application image first. Additive enum can remain while Food rows are absent. To remove enum: approved write-free window, no FOOD_SERVICE rows, reviewed down.sql from migration directory. It takes a table lock and refuses destructive conversion. Reconcile Prisma migration history before any reapply. If Food rows exist, application rollback only, no data conversion or deletion. Backup restore needs a separately approved recovery decision because post-backup writes would be lost.

Pilot rollout: REGISTRATION_OPEN remains the existing API gate; Beauty/Food allowlists are server-only and default empty. Do not configure real pilot email values until owner authorizes the target rollout. Site deep links alone never open access.

Prerequisite for MV2 production rollout: first owner-applied and verified MV1 enum migration. Do not enable the FOOD_SERVICE allowlist on a database that still has only two enum values.

## MV2 acceptance and release checklist, 04.10.2026

PR #239 merged into main at a4fac4b68acbc8f6d84e1c2350c5060a4832fa32. MV2 accepted and closed. No production rollout authorized by this acceptance. Real pilot allowlists remain unset.

Before a separately authorized production release: validated backup; owner-applied migration 51 and enum verification; full auth/registration smoke; Hospitality signup smoke; real email verification smoke; pilot deny smoke with empty/nonmatching allowlist; pilot allow smoke using a synthetic test email. Record actual evidence, do not infer mail delivery from API success.

registrationContext() is only the first-Business registration-completion helper. Earliest ACTIVE Business is not a future generic selector for multi-business organizations.
