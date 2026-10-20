# Appointment line audit writer: actual evidence

Create/move audit JSON now stores complete allowlisted line snapshots from accepted values. Move.before uses stored previous line positions, dates, price components and currency; move.after uses the same next values persisted to lines. No catalog repricing, raw input, notes or customer data. Original paid/rate/availability/location/optimistic-update guards and transaction boundaries unchanged. No schema changes.

- `2026-10-19T09-20-14Z-integration-2e50` exit1; counts={"total": 28, "passed": 0, "failed": 1, "skipped": 27, "flaky": 0}; codeChangedDuringRun=false.
- `2026-10-19T09-21-41Z-integration-630e` exit1; counts={"total": 28, "passed": 27, "failed": 1, "skipped": 0, "flaky": 0}; codeChangedDuringRun=false.
- `2026-10-19T09-22-34Z-integration-512e` exit0; counts={"total": 28, "passed": 28, "failed": 0, "skipped": 0, "flaky": 0}; codeChangedDuringRun=false.
- `2026-10-19T09-23-02Z-typecheck-1eb0` exit0; counts=null; codeChangedDuringRun=false.
- `2026-10-19T09-24-24Z-lint-003f` exit0; counts=null; codeChangedDuringRun=false.

RED2e50 reproduced missing items on real own synthetic PostgreSQL. First full630e failed only because our added fixture collided with unchanged review test on Dec1. Changed only new test date to programmatically verified unused Monday2037-01-12. Final selected integration file512e28/28, zero skips; all original27 tests retained. Root/API/web types and full lint GREEN; read-only review PASS.

PG16 identity verified: owned core-db/data, pmslocal, loopback55603, pms_test. No production/shared DB. Explicit full AuditLog assertions plus scoped history reader and catalog-rename immutability checks. This is not full project unit/integration/browser/release proof.

Recipe edit before/after and DONE exact recipe/material provenance are still separate unfinished work. Writers retain pending133/135 prerequisites; no production readiness or migration approval implied. PR678 stays preparation-only/DRAFT.
