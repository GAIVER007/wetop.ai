# Independent employee portal SPEC re-review

## Verdict: PASS

PASS for source-level compliance with the approved employee portal contour. Both required findings R1 and R2 from `final-spec-review.md` are resolved in the current working-tree source. No remaining required SPEC implementation gap was found in this re-review. This is not a claim that final gates passed or that production is ready or published.

## Scope and evidence boundary

- Repository: `/srv/hermes/workspace/wetop-portal-release-61af7b90`.
- Read-only Git inspection observed HEAD `c46ef1c52` plus the parent's candidate changes. New portal files were read directly, not inferred from the tracked diff.
- Acceptance authority: `docs/employee-three-audiences-proposal.md`, `docs/employee-portal-wire-contract.md`, and the explicit approval in `DATA_MODEL.md:3`.
- Reviewed implementation and regression-test source independently. The prior review was used to identify required follow-up, not as a substitute for inspecting the fixes.
- No tests, builds, DB operations, environment/auth/secret reads, production interaction, source edits or Git mutations were performed. Generic review-skill mutation testing was deliberately not performed because this review is expressly read-only.
- The only reviewer-written file is this external report. Final execution evidence remains the parent's responsibility.

## Required finding closure

### R1: Affected appointments after own week/time-off saves - RESOLVED

`apps/api/src/employee-portal/employee-portal.service.ts:111-134` now constructs a separate private `scheduleConflicts` projection:

- Resolves the employee and business before querying. Reads only that employee's busy appointments in active assigned locations of that business, with `endsAt > checkedFrom` and statuses `BOOKED`, `CONFIRMED`, `DONE`.
- Orders by `startsAt,id`, fetches at most 501 rows, evaluates only the first 500 and explicitly reports `checkedCount` and `truncated`. It is independent of the selected-day appointment filter.
- Reuses canonical `fitsSchedule` with each appointment branch's timezone, that branch's working hours and the employee's inclusive absence dates. Canonical behavior was checked at `packages/domain/src/beauty/beauty.ts:119-147`.
- Returns identifiers, local date, times, branch, service and canonical reason only. The conflict projection has no customer name/contact, notes, prices or other employees. FOOD_SERVICE produces an empty check.
- Week changes remain selected-branch-only with the existing employee lock and expected revision. Absence creation/deletion remains employee-owned. These paths do not cancel or move appointments or write payments (`service.ts:160-171`). Mutation responses call `get` after commit and therefore recompute the warning (`:203-204`).

The new typed boundary is present in `packages/domain/src/employee-portal/types.ts:33-46`. `apps/web/src/components/employee-portal/cabinet.tsx:54-70` displays the affected list with branch-local time and reason, preservation notice, explicit empty state and an incomplete-check alert instead of an unconditional all-clear. The same tab has actual absence create/list/delete controls. `forms.tsx:31-36` applies the returned DTO to cabinet state; `apps/web/src/app/my-work/actions.ts:50-61` and `apps/web/src/lib/employee-portal-api.ts:19-21` connect these controls to real endpoints.

Regression source at `tests/integration/employee-portal-schedule-conflicts.test.ts:43-77` asserts warning after week replacement, cross-branch local-date absence handling, removal clearing warnings, stale revision rejection, exclusion of another employee and customer data, bounded/incomplete checks, and unchanged appointment/payment snapshots. Browser source at `tests/employee-portal-ui/portal.spec.mjs:92-110` covers actual absence save/reload/delete and preservation of dated absences during a week save. These are inspected assertions, not tests run by this reviewer.

### R2: Explicit anonymous JSON cache/revocation policy - RESOLVED

`apps/api/src/employee-portal/employee-portal.module.ts:74-77` sets `Cache-Control: no-store` on the response before calling profile resolution. Thus successful handler responses, invalid location input and unpublished-profile exceptions share the explicit policy rather than relying only on a frontend fetch option.

`tests/integration/employee-portal-schedule-conflicts.test.ts:80-92` now contains real HTTP assertions for published 200, invalid-location 400 and unpublished 404 responses, all with `no-store`. `apps/web/src/lib/employee-portal-api.ts:27-38` keeps the anonymous fetch separate from private transport and uses `cache: 'no-store'`.

The wire contract at `docs/employee-portal-wire-contract.md:34` explicitly distinguishes withdrawal of new public profile reads, 60-second signed media links, the existing S3 adapter's `private, max-age=86400` browser retention and irretrievable downloaded/copied bytes. It does not promise immediate media-byte revocation or change storage-provider policy.

## Wider acceptance re-check

| Area | Independent source assessment |
| --- | --- |
| Manager/self/public isolation | PASS. Manager controller retains `@Access('staff')`; self retains `@Access('self')` and passes null identity, never a submitted employee ID (`employee-portal.module.ts:12-55`). Service checks active verified membership, current business/organization and authorized scope, requires an unambiguous active self mapping and checks selected branch assignment (`service.ts:23-55`). Public lookup uses the narrow published identity resolver and constructs a distinct public allowlist DTO (`:252-269`), not a private DTO with frontend-hidden fields. |
| Mass assignment and account mapping | PASS. `boundary.ts:4-7,18-42` rejects unexpected fields and validates consent/revision. Self has no account, publication or pay-setting endpoints; service independently rejects those manager operations for self (`service.ts:143`). Account linking locks the existing user, validates confirmed active membership and authorized business scope, rejects silent reassignment/duplicate mapping, and supports explicit unlink (`:172-185`). No new password or email-match ownership system. |
| Public content and branch pricing | PASS. Public reads require published/consented profile, active employee/business and permitted organization state; portfolio is published/consented only. No account, private contact, pay, absence or customer fields enter the returned public object. Multi-branch without a selection yields branch choices and no invented prices; services use enabled selected-branch effective price/duration/currency (`service.ts:261-269`). Self content edits withdraw publication pending manager reapproval (`:149,197,200,244`). |
| Real media and retries | PASS. Upload resolves access before processing/storage, requires actual configured SiteAssetStorage, reuses processSiteImage, stores processed bytes before the metadata transaction and compensates only the new object on failure. Per-employee serialization and processed-hash/metadata dedup retain existing media and approval on a retry (`service.ts:219-250`). `tests/integration/employee-portal-media-retry.test.ts:22-62` covers sequential/concurrent work retry, later approval, distinct metadata/employees and avatar revision stability. Storage-off is an honest 503, not synthetic success. |
| Food payroll parity and SELECT_LOCATION | PASS. `service.ts:67-89` uses canonical payrollTotals, selected viewing-branch timezone/currency, closed orders across business branches, own period adjustments and real conducted payouts. Compared directly with unchanged `apps/api/src/food-service/restaurant.service.ts:1565-1649`. Branchless unresolved Food returns SELECT_LOCATION with null monetary totals and empty adjustments while retaining stored conditions, not an invented UTC calculation. `tests/integration/employee-portal-payroll-scope.test.ts:53-109` compares all four existing pay models and both viewing branches against actual legacy payroll. |
| Beauty salary and financial writers | PASS. Beauty exposes real conditions, adjustments, payouts and chosen basis while earnings/remaining stay null with NOT_CONFIGURED or UNSUPPORTED_POLICY and a clear explanation (`service.ts:74-80`; `cabinet.tsx:72-90`). No closed-period/refund formula is invented. Policy changes are manager-only and Beauty-only. Existing restaurant financial writer source has no working-tree diff; self adds no payout/adjustment writer. |
| Per-service booking and managed-site slots/book flow | PASS. `booking-target.ts:15-35` permits only an eligible published, hash-validated Beauty site with exact branch/tracked identity, active host and one primary domain. `specialists/[slug]/page.tsx:41-47` adds a clicked service through the existing booking helper while preserving employee/form target. `apps/sites/src/render/beauty-form-script.ts:28-40,52-93,103-121` validates explicit targets, queries actual `/w/beauty/slots`, rejects mismatches instead of substituting another employee, keeps zoned slot timestamps and validates confirmation. Existing `lead-script.ts` embeds this helper and retains its existing endpoint/request-key/CAPTCHA submission pipeline. This is not a replacement booking backend. |
| Four approved additive models | PASS. Prisma has EmployeePublicProfile, EmployeeMedia, EmployeePortfolioItem and BeautyPayrollPolicy (`schema.prisma:3178-3225`). Migration128 adds only the approved four tables, restrictive references, default-off public flags, consent constraints, one-avatar constraint, duplicate-active-binding preflight index, ownership trigger and tenant RLS. No additional financial model or payout table is introduced. |
| ACL-only129 and stock restore | PASS. `20261016000129_employee_portal_grants/migration.sql:1-21` replays128's four-table/function rights without schema/data/RLS changes, role creation or internal transaction boundaries. The unchanged `scripts/ops/db-restore-prod.sh:93-125` selects pure ACL migrations and wraps restore/replay atomically. `tests/restore/employee-portal-grants-restore.test.ts:48-136` rehearses actual no-privileges dump/stock restore, optional-role absence/presence, exact ACL/RLS/policy equivalence, repeated129 and no-op rollback. These are source assertions only. |
| Compact calendar and existing employee experience | PASS. Read-only Git history shows c3093496e's calendar lineage integrated via05b0ad85e under observed HEAD. Working-tree diffs are empty for both appointments UI trees and restaurant.service.ts. Master/waiter differentiation remains explicit in cabinet rendering; waiter has own orders/pay without a salon services tab or generated salon booking target by default. No new calendar implementation is required. |

Tenant enforcement also has real-role regression source in `tests/integration/employee-portal-rls.test.ts:17-22,38-70`, using SET LOCAL ROLE wetop_app and tenant context, with foreign updates/deletes and resolver restrictions. This is not proof of production DB state.

## Prior non-blocking observations

- O1 is fixed: migration129 README now references `tests/restore/employee-portal-grants-restore.test.ts`, the standalone config and dedicated local port55624 (`README.md:11-20`).
- O2 remains a non-blocking retention limitation: logical avatar/work removal does not reclaim old persisted blobs, and deleted work metadata can leave its EmployeeMedia row. Fresh DTO removal is real. Do not describe logical deletion as physical erasure; a later cleanup policy must remain reference-checked and employee-owned. This does not reopen R2 or justify destructive cleanup during the freeze.

## Execution and owner-only limitations

1. No runtime pass is asserted here. The parent must attach its actual final API/DB/storage/browser/build/lint/type evidence, including the approved 320/390/1440, both-theme and keyboard/accessibility acceptance. The inspected gallery loop itself covers1440/390, not evidence that320 or keyboard checks have executed.
2. Production SQL, backup/preflight/schema-ledger validation and application of128/129 remain owner-controlled. Upstream marketing126/127 must not be silently omitted from the actual pending-ledger review.
3. Real Kazakhstan private S3 configuration, bucket privacy, signed GET and retention behavior require authorized provider verification. A disk fixture does not establish these facts.
4. Cloudflare/domain publication access and actual eligible managed-site deployment remain owner-only external blockers, not code defects to disguise with fake URLs or successful synthetic responses.
5. The already published c309 calendar is preserved, not republished or reimplemented by this review. No release/deploy/production authorization is implied.

## Disposition

**PASS. Required source gaps: none found.** R1 and R2 are closed by the inspected implementation and targeted regression source. Final gate execution and owner-only production prerequisites are separate from this SPEC source verdict.
