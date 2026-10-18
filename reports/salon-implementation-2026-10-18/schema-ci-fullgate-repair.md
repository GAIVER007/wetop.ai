# Full release-gate repair after candidate b194d4986

Status: local repair verification; full GitHub gate on the next immutable candidate remains required. This document is NOT production migration authorization, a deployment receipt, or completion of the 94-point salon product register.

## Actual failures and bounded changes

- CI 39159530856 on b194d49866c2fd8e40ae1db04859204e9f966528 finished **failure**. Fast types/lint/unit, bot, runtime audit, entry checks and two main-UI shards passed. The migration rollback, onboarding, employee portal, branch cleanup, Food UI and remaining main-UI checks exposed the issues below.
- Stock rollback 135 did not restore the two prior function search paths and the exact original stock-guard body. Restore the canonical pre-135 comment and the existing schema-aware `search_path` rule. Do not normalize away differences in the checker. Strengthen the isolated rollback signature to include every public trigger function's definition and `proconfig`.
- All **five forward SQL files remain byte-identical**. Four original down files remain identical. Only down135 is intentionally repaired: SHA256 `57ef11ff0477a9f067abd3ea9bc17508889c87e39aba72b5c4ab4806646fb844` → `86e6e1b6d2af3113f38ee6146f280d1a53da9cdf85074ea9a37a30eb014c8291`. The exact five-name/hash manifest remains strict; productionApplied remains false.
- Next's real compiler rejected the two non-async customer server-action overload declarations. Mark those declarations async; the implementation, signatures, authorization, customer identity rules and money logic are unchanged.
- Portal fixture: provide an explicitly synthetic signing key only after its existing owned test-database guard. Production signing code and its missing-key rejection remain unchanged.
- Branch fixture cleanup: delete its own appointment lines before parent appointments, using the same organization scope. Do not remove financial/history constraints or widen cleanup.
- Real onboarding: use the canonical `/employees/<id>/profile` screen and services form. Retain lost-response recovery with exactly one ID, a later distinct ID, partial-assignment error recovery, native keyboard submission, exact API readback and no common-profile writes. Check both canonical and legacy audit families and the persisted `#services` tab.
- Generic synthetic-only customer/journal prerequisites: use catalog articles, then the canonical creation URL. This synthetic API does not implement the rich employee portal; seed the service assignment with the same scoped API-fixture pattern already used in beauty-catalog tests. Capture the real test browser's session/scope, verify catalogue location, and assert exact acknowledgement plus independent readback. Dedicated real-DB portal/onboarding service UI coverage remains mandatory, not replaced by this seed.
- Generic appointment adapter: explicitly decode the current ONE unadjusted `items` entry into the existing resource lookups. Keep all resource, sellability, hours, absence, overlap, customer and snapshot calculations unchanged. Refuse malformed, mixed, multiline, manual-price and duration payloads rather than pretending to implement advanced behavior. This is an isolated in-memory test fixture, not real-DB evidence or a production API change.
- Generic schedule test: seed and display the same explicit week, avoiding UTC/Almaty Sunday/Monday drift. Preserve the existing-appointments warning assertion.
- Hotel compact-card test: derive the window from the actual two-night TEST3 API fixture, select its unique caption-bearing anchor and assert span=2. Preserve zero menu, visible short name and exact text checks. The old broad selector had chosen TEST6 with three visible nights. **No hotel calendar production code changes.**

## Recorded execution

All commands use `npm run test:record`; exact arguments and sourceStable are in the journal entries.

| Record | Actual result |
|---|---|
| 2026-10-18T20-31-55Z-integration-290d | New exact function/proconfig regression RED: 8 passed, 1 failed on the unsafe rollback |
| 2026-10-18T20-32-56Z-integration-5b90 | Stronger schema proof GREEN: 9/9 |
| 2026-10-18T20-33-02Z-unit-2afa | Manifest/fixture/hold guards: 52/52 |
| 2026-10-18T21-01-07Z-unit-5a54 | New generic-item adapter RED: missing implementation |
| 2026-10-18T21-02-10Z-unit-0be8 | Bounded adapter: 19/19, including refusal cases |
| 2026-10-18T21-02-28Z-e2e-69de | Direct no-copy main-UI regression: 8/8; customers, derived money, filtering, mobile, both themes, booking, schedule warning and two-night hotel caption |
| 2026-10-18T21-06-31Z-typecheck-ff20 | Root/API/web types passed |
| 2026-10-18T21-06-56Z-integration-5e3b | Full selected real-DB scope: 79/79, including exact rollback, real restricted role, tenant/history/concurrency and unchanged stock/FIFO scenarios |
| 2026-10-18T20-04-10Z-e2e-16e1 | Earlier in this repair: complete employee-portal fixture suite 26/26 |
| 2026-10-18T20-20-36Z-e2e-de3d | Complete branch fixture suite: 70 passed, 4 existing skips; 27 pre-existing unrelated appointment lines remained identical by count and SHA256 |
| 2026-10-18T20-16-14Z-e2e-b2a2 | Earlier real onboarding: 24/25; remaining failure exposed the exact `#services` contract, subsequently corrected, not counted green here |

The later focused real onboarding check, full unit, final lint and independent machine-readable verdicts are appended to the companion verification JSON before publication. Partial runs do not certify the entire GitHub matrix.

## Environment and artifact preservation

Own PostgreSQL16 cluster only, initially on approved local fixture port55603 for portal/branch checks and then55983 for the strict owned release-schema guard. Data is retained; no production/shared database, external provider, real guest data or production auth/session files are used.

On this server, private read-only linked dependencies require the existing guarded web Turbopack root override; the marketing-site local driver uses supported `next dev --webpack`. API authorization/runtime-role settings and test selection/assertions/budgets remain unchanged. Main UI runs use the direct alternative config, **never the copy-making main-UI runner** on this host.

Lint initially traversed a generated, ignored Prisma proof config under `test-results` rather than project source. Preserve that owned proof intact outside source at `wetop-browser-readonly-check/salon-implementation/final-owned-schema-proof`; both file SHA256 values stayed identical. No artifact was deleted or edited and no lint rule was disabled. The recorded original path remains historical; `prisma-diff.log` states `-- This is an empty migration.` Full unchanged-source lint is rerun.

Unrelated dirty `.gitignore`, premium dashboard screenshot, generated Next declaration and other generated/pre-existing artifacts remain preserved and excluded from the scoped commits. Tree remains ACTIVE/KEEP. No cleanup, stash, reset, force push, merge, deployment or production migration is authorized by this repair.
