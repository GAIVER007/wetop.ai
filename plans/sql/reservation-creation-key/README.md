# Reservation creation retry, 2026-10-01

Approved by owner in this chat: model and production migration after isolated testing.
Migration: `20261001000040_reservation_creation_key`.

## Behavior

Optional creation key for backwards compatibility; the new manual form always supplies it.
Unique per property. Same normalized request returns the original reservation, even if
availability has since changed. Different request with the same key returns 409.
A transaction advisory lock serializes duplicates; unique index is the final constraint.
Guest, reservation, folio and allocation writes stay in the existing transaction.
No existing booking, amount, allocation or permission is rewritten.

Quote uses the same preparation code as create, stops before any domain writes and
returns integer minor units. Create recalculates independently; changed total returns 409.

## Validation

Run focused API, UI and isolated PostgreSQL tests. Check up/down/up on a separate database.
Production preflight: current SHA, clean migration ledger, successful fresh dump using
`docs/ops/backups.md`. Use the normal migration runner in `docs/deploy.md`, never edit
Prisma migration history by hand.
Validate both columns, unique index and CHECK constraint; verify migration ledger success.
Deploy the tested SHA with `wetop-auto-deploy --migrations-applied <SHA>`.
Repeat invalid-date UI scenario without submitting an actual reservation.

## Rollback

Roll back application first. Additive schema is compatible with old application and may
remain in place. If schema rollback is necessary, export creation_key/fingerprint with
reservation IDs into the protected backup first, then execute migration down.sql.
This removes retry metadata only, never bookings. Do not retry old pending commands after
removing retry metadata; locate their original reservation first. Restore metadata from
the backup before resuming keyed requests. Record failed migration status through Prisma
only if an actual migration failure requires it.
