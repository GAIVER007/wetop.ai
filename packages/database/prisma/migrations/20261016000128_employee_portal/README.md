# Employee portal: prepared additive release candidate

This is source preparation for the user-requested portal publication, NOT confirmation or authorization of production SQL execution. The four models were approved previously. No payroll formula, existing money unit or restaurant writer is changed. Production execution remains an administrator operation owned by the user.

The earlier local-only `00090` candidate is preserved in the original isolated source and evidence. This release candidate uses the next active ID `20261016000128_employee_portal`, after current main's active127, so clean CI databases and Prisma schema can be verified together. Apply only this version once; never also import the old00090/00111 variants. This directory has not been applied to production.

## Required administrator release steps
1. Pin the tested code/image SHA and the actual current production schema ledger. A marker or clone SHA is not image provenance. Do not treat any old root-approved migration package as approval for this new candidate.
2. Back up the target database/schema and referenced image objects using the established backup runbook. Restore-check the backup and record the outcome privately. Keep existing backups and rollback images.
3. Read-only preflight must find no duplicate active `(business_id,user_id)` employee bindings. Report counts, not private employee contacts. If duplicates exist, a manager resolves them explicitly; never auto-link or discard accounts.
4. Confirm existing `wetop_app` and tenant policies. Set the explicit installation schema on the same connection. Trigger/resolver search_path is captured at installation; use `public` for production, `pms_test` for isolated acceptance. No production bootstrap, reset or schema push.
5. Use only the established administrator migration/bookkeeping procedure and stop on errors. Inspect pending migrations against the actual ledger: current main also contains marketing126/127, which must not be silently bundled under the description 'only four portal tables'. Review the actual pending set separately.
6. Validate the four new tables, FKs/checks/indexes, wrong-tenant denied reads/writes as `wetop_app`, denied anonymous direct table reads, and a permitted resolver result only for an active published/consented profile. Public resolution returns identifiers only; application returns a strict public DTO without private contacts, user ID, salary or customer records.
7. Deploy compatible green code through the existing release workflow. Verify health, exact runtime evidence where available, authenticated manager/self paths and safe public projection. Never claim preparation or CI as publication.

## Local and CI acceptance
The new isolated parent candidate uses its own loopback PostgreSQL16 cluster55613 and database `pmslocal`; old55603 evidence is not modified. Calendar clusters55599/55605 and remote/shared targets are denied by the fixture guard. Dedicated GitHub job DB127.0.0.1:5432/pms_dev is accepted only with both real CI markers, not in a production process. Test setup never falls back to a database from another project.

Each reset allocates fresh synthetic tenants and never truncates another run. Staff identity uses verified fixture session actors only on the loopback test server, not production impersonation. Avatar/portfolio fixtures are repository PNG files and exercise real processing and persisted bytes. Restricted application-role/RLS tests remain required. The disk test provider does not prove production signed-URL expiry or bucket policy; verify the real provider separately without exposing storage keys.

Beauty percentage basis is a saved business choice, but unsupported automatic earnings remain explicitly unavailable rather than fabricated. Food payroll uses its existing implementation. Unknown earned/remaining amounts must not become invented zero balances.

## Rollback
`down.sql` is manual rollback documentation only, not an automatically applied migration. Disable new portal entry points first, preserve a verified backup of profile/media/policy rows and referenced objects, and use administrator approval for any destructive rollback. Existing employees, membership, bookings, restaurant and Beauty money history must remain unchanged. Do not delete blobs or run down.sql merely to make a check green.
