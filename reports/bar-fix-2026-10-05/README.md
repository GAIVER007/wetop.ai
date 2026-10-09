# BAR-FIX: security/invariant repair

Approved owner plan: separate upstream PR from main 75c45295, repair function search_path and tenant registry, then merge only after required validation. MV5 sync and full regression follow separately.

No schema.prisma, entities, fields or policies changed. Original migration 20261004000051_bar_inventory is unchanged. New 20261005000053_bar_function_search_path affects only the function setting.

## Red evidence

Existing function-search-path and rls-isolation tests: 6 passed, 2 failed on unchanged main. Log: tests/runs/logs/2026-10-05T05-26-01Z-integration-83a5.log. Tests and assertions unchanged.

## Rollout procedure, not executed on production

1. Owner approves rollout and target schema. Take a full pg_dump custom-format backup to secure storage, verify pg_restore --list, retain migration history and current bar_property_guard() definition/proconfig.
2. Preflight: confirm migration 51 applied; record PostgreSQL version, current_schema(), function existence and configuration. Confirm current bar table RLS/policies.
3. Apply forward migration through the existing migration runner to the approved schema. Do not replay migration 51.
4. Validate pg_proc.proconfig: current schema first, public next, pg_temp last, with no duplicate public. Check all ten bar tables remain protected and run integration invariants and bar smoke.
5. If an approved rollback is necessary, execute down.sql in the same schema and reconcile migration history using the existing rollback procedure. This restores the former insecure path, so disable affected bar writes pending forward repair. No rows are changed by either SQL file. Restore backup only for unexpected data damage after separate approval.

Production and release branch are not touched.

## Validation

- Focused green: 8/8, `tests/runs/logs/2026-10-05T05-26-59Z-integration-bcd9.log`.
- Typecheck PASS: `tests/runs/logs/2026-10-05T05-27-14Z-typecheck-0aae.log`.
- Lint PASS: `tests/runs/logs/2026-10-05T05-27-15Z-lint-ea76.log`.
- Direct local readback: `pms_test.bar_property_guard()` proconfig is `search_path=pms_test, public, pg_temp`.

Review: identifier quoted with format(%I); only the named zero-argument function altered; exact prior null setting restored by down; existing migration and tests unchanged; no rows or grants changed. Registry entries match all ten existing bar policy tables.

- Full integration PASS: 348 passed, 9 existing skips; `tests/runs/logs/2026-10-05T05-27-29Z-integration-942b.log`.
- All 59 migrations, schema drift and every down PASS: [log](migrations.log).
- Recorded runs have codeChangedDuringRun=false. No new skips, timeout increases or assertion changes.
