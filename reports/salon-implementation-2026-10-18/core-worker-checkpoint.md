# SALON core worker historical checkpoint, 18.10.2026

Historical partial snapshot before ownership reconciliation. Superseded by `core-verification.md` and subsequent recorded runs. Interleaved sibling activity caused contradictory attribution in checkpoints; current source changes were inventoried and preserved, and the user authorized continuation at18:21 UTC. No concurrent source writer was active at that inspection.

Status: PARTIAL, ACTIVE / KEEP. No commit/push/deploy/CI/merge. HEAD remains 5b409d12024b18c5fa26d7f1568900863d02d0bd.

## Verified and changed

35/35 targeted salon tests pass, no skips or code fingerprint changes: `2026-10-18T18-18-47Z-unit-d657`.

Own changes:
- `apps/api/src/beauty/appointment-status.test.ts`: missing employeeServicePrice and beautyLocationHours fixture collections; appointment lines collection.
- `apps/web/src/app/customers/actions.test.ts`: server-only test marker mock matching sibling tests.
- `apps/web/src/app/finance/period-continuity.test.ts`: test actual financeDay authorized endpoint instead of obsolete day mock; all16 assertions retained and green.
- `apps/web/src/app/journal/labels.ts`: queued/failed/undone customer-import Russian labels; coverage guard retained.
- `tests/integration/beauty-customers.test.ts`: use actual BeautyCatalogService.createCustomer and retain independent importer.apply. All original concurrency/tenant/history/negative assertions retained. NOT YET verified green against UTF8 DB; no fixed-typecheck claim.

Baseline salon RED: parent `2026-10-18T18-03-32Z-unit-dd16`; own real DB RED `2026-10-18T18-15-00Z-integration-5a92` (9pass/7fail). Second integration `2026-10-18T18-15-47Z-integration-6ff7` exposed local SQL_ASCII environment failure in normalized phone function; separate owned UTF8 DB created, old DB preserved.

## Schedule evidence and limitations

Existing source already saves week. In own synthetic UI run `2026-10-18T18-16-06Z-e2e-58ae`, desktop reached line40 after all assertions through36: UI save09:00-18:00, API readback changed revision, reload showed09:00, onboarding schedule.done true, stale revision409. Direct SQL independently returned `Synthetic schedule master|1|09:00:00|18:00:00`. No schedule production fix invented.

Entire UI run NOT green: interrupted while waiting for profile dialog on `/employees`, mobile did not run; journal counts total2/pass0/skip2, exit130. Do not count this as passing cases or introduce skips. Later foreign test run cleared original test-results trace before it could be copied; journal/log remain. Startup issues resolved in invocation only: `NEXT_TEST_TURBOPACK_ROOT=/`, `PLAYWRIGHT_BROWSERS_PATH=/srv/hermes/workspace/wetop-salon-integration-evidence/browsers`.

Schedule integration baseline passed nine tests including persistence, authorization and tenant negatives, but old appointment fixture lacks employeeService assignment required by current held guard, causing three failures. Fix seed, not guard, if continuing.

## Isolation

Own cluster only: `/opt/data/workspace/wetop-browser-readonly-check/salon-implementation/core-db/data`, loopback55983, role salon_core, database salon_core_utf8_20261018 (UTF8). Applied ordinary136 and existing held Beauty131-135 in release-document order only here. No held promotion/schema invention. Synthetic seed, no production/sharedDB, auth/session files or PII. PGDATA preserved, own cluster left running for handoff; no deletion authorized. Logs under core-db.

## Blocker: writer ownership collision

At18:18:59, discovered another actor modifying `tests/onboarding-real/api.ts` and `tests/onboarding-real/schedule-save-real.spec.ts`, neither my changes, and running PID3528634 from18:18:45:
`test:record e2e --config tests/onboarding-real/playwright.schedule.config.ts --workers=1 --note SALON restricted wetop_app actual registration session schedule persistence proof`.
Own pending UTF8 integration correctly refused its journal lock. Foreign process/lock left untouched. Source mutation stopped. Checkpoint tool also reported sibling subagent `sa-0-482b4115` touching the shared core-progress.md, confirming concurrent ownership. Do not overwrite shared checkpoint again; this file is the independent worker record.

Parent must reconcile single-writer ownership before any further source work/staging. Foreign onboarding changes must not be attributed to this worker. Preserve original dirty .gitignore, premium screenshot, old untracked. Restaurant bar baseline untouched. Full unit, typecheck, lint and customer UTF8 integration remain pending; no all94/sitefixed claim. Code graph unavailable (not_built/not_found), fallback local source/test inspection only.
