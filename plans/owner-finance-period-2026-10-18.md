# Owner finance period continuity, 2026-10-18

Owner-approved continuation: after live read-only diagnosis, owner instructed «ну решай», then «продолжай». This slice fixes period loss, not the whole common analytics task.

## Reproduction

Actual authenticated `/today?period=month` showed 2026-10-01..2026-10-18. Its report link was `/finance`; BEAUTY rendered hardcoded 2026-10-12..2026-10-18. FOOD_SERVICE `/finance` redirected without query. Existing live-capture RED is retained outside the repository, not relabelled GREEN before deployment.

## Narrow implementation

1. Add executable regressions before production edits: owner links for all three verticals and three periods, finance routing, BEAUTY requested days, defaults and failures.
2. Build all owner finance links from canonical API `period.fromDate/toDate`, not server clock recalculation.
3. Forward dates through finance dispatch. Keep hospitality report parsing and financial definitions unchanged.
4. BEAUTY fetches the requested location-date window with bounded concurrency. Keep default seven days and the existing per-day request/export limit of 31 days. Invalid windows or source failures must not become another period or zero money. Captions name the selected period rather than always seven days.
5. FOOD_SERVICE preserves explicit dates and follows existing first-value search-param convention. Do not alter its financial aggregation.
6. Run focused RED/GREEN through `test:record`, adjacent regressions, lint and types. Publish only after reviewing real outputs. Full live acceptance remains pending deployment.

## Safety and ownership

Existing tree `/srv/hermes/workspace/wetop-pr599-reconcile`, branch `fix/owner-report-period-20261018`, current-main base `fb0e786e0b3f99f745284d860d84094b5a6cb5eb`. Original published HEAD is retained at `archive/pr599-reconcile-stand-9305228fd`. Two original dependency link objects are preserved intact in the private controller handoff directory; targets were not modified. All-UID process clearance and clean handoff recorded there. No new project tree, no production writes, no DB tests against production, no schema/role/model changes, no CSS/design changes.

Gbrain callers returned `not_built` and blast `not_found` for the affected functions. Local caller search confirms Next route entrypoints, `today/page.tsx`, existing `unified-owner.test.ts`, and `growth/business-sales.test.ts`. This is not evidence of no callers.
