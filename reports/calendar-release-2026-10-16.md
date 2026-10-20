# Calendar-only release acceptance, 2026-10-16

Base: `eaf0b57a0e2469fe0268372e29caeeb69c20e74f`, current release at preparation. Its full release-checks passed: https://github.com/GAIVER007/wetop.ai/actions/runs/38909129491.

## Scope
- Accepted compact calendar toolbar on desktop, without changing time-slot geometry or adding modes.
- Master filter controls the visible mobile calendar and defaults the master in a new appointment.
- Weekly history preserves the name of an archived/disabled master using the existing calendarColumns helper.
- Regression tests and salon setup guide.

No employee portal, personal finance, service picker, schema/migrations, API, money logic, authentication or permission changes. No new dependencies. No production data seeded or changed. The separately requested portal work remains a separate candidate.

## Local evidence on this base
- 151/151 targeted unit, including Beauty/domain/employee workspace/design checks: `2026-10-16T16-39-49Z-unit-9e2d`.
- 89/89 integration, no skips, own loopback PostgreSQL 16 at 55605, restricted wetop_app RLS checks included: `2026-10-16T16-39-59Z-integration-bacf`.
- 28/28 browser scenarios with real Beauty handlers and isolated synthetic DB: calendar/drawer both themes at desktop/mobile widths, persistent appointment lifecycle, selected-master regressions, archived history and employee workspace: `2026-10-16T16-41-02Z-e2e-c1d2`.
- All root/API/web typechecks: `2026-10-16T16-45-57Z-typecheck-e2a4`, exit 0.
- Full lint: `2026-10-16T16-47-17Z-lint-5f17`, exit 0.
- `npm run build -w apps/web`, exit 0.
- The five journal entries report codeChangedDuringRun=false.
- Independent read-only static review found no high-confidence Critical/Required regression in this delta; not a substitute for runtime tests.

Initial environment failures (stale donor-worktree Prisma resolution and a wrong external config path) were repaired without changing assertions or dropping valid query fields. Final workspace imports and generated client belong to this candidate; shared dependency source files were not modified. The original failed evidence is retained outside the published source.

## Publication boundary
These are applicable local checks, not the full repository release gate. The existing GitHub release-checks must pass on the exact candidate SHA before promotion. Current main contains unrelated active marketing migrations beyond this base, so the calendar-only candidate must not accidentally publish those migrations or unrelated work. Use only the established reviewed-main-ancestor/green-SHA/fast-forward promotion workflow; never force release, bypass a gate, alter deployment permissions or run production migrations.

At report creation this candidate is not yet published. Merge/push and deployment marker files alone are not runtime image proof. Server health and an actual domain check remain required. The current authenticated production account has a hospitality scope, where salon routes correctly redirect; no fictitious salon was created in production to manufacture a test result.
