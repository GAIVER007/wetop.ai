# Consolidation: actual runtime gate follow-up

Base: `787bec9d5075943ac7001d4eb89b62f431b9637e`; failed full run [39054828031](https://github.com/GAIVER007/wetop.ai/actions/runs/39054828031). This report records a corrective working-tree checkpoint, **not a passed release or production deployment**.

## What real execution established

- Full lint, root/API/web typechecks, complete unit job, site checks and supplier component checks passed.
- Canonical owner-home no-held baseline: **9/9 real service cases passed**, with authorization/RLS. The three enabled shared-home browser scenarios for hotel, beauty and food **all passed** without retries/skips.
- Isolated integration: **1532 passed, 81 skipped** in the general integration step; additional employee portal integration **39 passed** and exact restore **2 passed**. These are separate recorded steps, not an invented summed total.
- Real onboarding/recovery/guest: **20 passed, four failed**. The actual restricted tenant-role test passed, as did in-card guest citizenship editing with nonempty allocations, primary StayGuest linkage, nonempty charges and unchanged occupancy/money.
- UI shard1: **238 passed**, two restored guest-count form cases failed real mobile bounds. Beauty: **73 passed**, one compact-calendar case failed; 17 optional reference/audit captures skipped. UI shard5: **333 passed**, one fixture setup/reopen case failed. UI shard3: **292 passed**, one navigation timed out. Skips and failed steps are never called passed.

## Narrow corrections

### Real registration fixtures and response lifetime

Existing Hospitality registration deliberately rejects an already-existing Property name (`AuthService.register`, namesake guard). The test helpers mistakenly reused constant names. They now submit unique readable UUID-suffixed names; policy/rate limits/database are unchanged. Registration remains required and failures include HTTP status, not tokens or raw session responses.

The expired-session scenario correctly received 401 and navigated, but CDP could no longer read its old response body. The test now observes the **same real** upstream POST via expiry-only `route.fetch({ maxRedirects: 0 })`, captures actual status/body/cache-control, then forwards the original APIResponse unchanged. UI click, actual browser401, upstream401/no-store, canonical login origin/hash/navigation, and unchanged database snapshot assertions remain. No successful business response is synthesized. READ_ONLY expects a disabled editor trigger; restricted membership expects its actual canonical absence; both still require cached form absence and real denied API calls.

### Scoped restored form layout

The restored StayGuestsForm kept a desktop generic row whose native number inputs imposed min-content width. Its only behavior-file change is an additional class. The **already-loaded** directory.css gives that scoped form/row zero-minimum grid tracks, full-width zero-minimum fields and 44px-token controls, stacking at canonical600. No page/body clipping, hidden controls, business-action, capacity, financial, status or role change.

### Compact Beauty calendar and actual later design authority

Changing its technical max360 rule to max600 caused a separate Today row at390 and real timeline y485.6875, over the unchanged422 limit. **DESIGN.md lines41–42, Q-DES-4 (13.10), explicitly allows technical360**; lines176–181 retain general phone rules at600. Only the technical wrapping block is restored to360 with a named-rule, same-line reason citing that approval through the existing exception mechanism. The checker and baselines are not edited, and no generic visual override is allowed. Genuine new source-contract RED observed expected360/got600; subsequent design/presentation/terminology check **32 tests passed**. The actual422 and320/390 browser assertions are unchanged. Geometry-only diagnostic data was added; no customer text or input values are logged. The corrected rendered height remains pending fresh CI, not inferred from static CSS.

### Other existing test contracts

The old isolated desk-edit case asserted that count forms did not exist, contrary to the latest8Oct approval. It now checks exactly two stored1/0 per-stay forms, native bounds, real existing server-action submissions and direct real reservation/finance readback, retaining its group/notes/source/manual-close checks and stable occupancy/money.

The fake-API reopen test silently sent a PATCH without the fixture's required `x-wetop-test-client` header. Its real handler rejects such requests with403. It now uses the existing fixture transport, requires PATCH success and direct GET UZB persistence before the unchanged reopen/Escape/focus assertions. No product cache workaround or forced reload was introduced.

## Unresolved development-server observation

The workspace empty/unavailable macro timed out in an incomplete channels document with21 unresolved script requests. Static trace analysis found about15.7s used before that navigation and about29.3s of its existing45s budget left. This does **not** prove cumulative budget exhaustion. No speculative split, timeout increase, retry, load-condition weakening or auth rollback was applied. Failure-only, two-second Node HTTP evidence for a prior public local static asset was added, recording numeric status/body bytes or an error type and **always rethrowing the original navigation failure**. This is diagnostics, not a claimed fix. A fresh full exact-SHA run must actually pass this unchanged business contract.

## Verification boundary

Final parent checkpoint: **131 tests /17 files PASS**, **49 changed TS/TSX lint files PASS**, original eight protection comparisons TRUE. Fresh collection: real24, beauty91, affected fixtureUI30; root desk-edit collection3 includes schema/auth dependencies plus its actual case, not three runtime case passes. The final desk-edit review finding was closed by awaiting the actual front response body and the form's pending-disabled Save button returning enabled before checking no alert; all value/reservation/finance checks stay. Diagnostic attachment failure is warned and the original navigation failure is still rethrown outside `finally` (ESLint no-unsafe-finally). Code and limits are unchanged in meaning; neither diagnostic nor review is runtime acceptance.

Collection is not execution. Fresh full exact candidate/main CI, normal release, actual deployed image/health and authenticated live acceptance remain mandatory.

## Subsequent real-gate observation (64dd9fbac)

Run39059140610 executed **23/24 real cases successfully**. The remaining negative guest scenario stopped before its forged-RPC step: a broad `waitForRequest` captured a background card action whose arguments were reservation number/item ID, not the guest load. Its existing explicit Guest-ID assertion correctly rejected that capture. The observer now requires the exact current reservation pathname **and** the intended guest ID in addition to POST/Next-Action, before opening the editor. Payload identity, foreign-ID substitution, no-PII, denied API and unchanged-database checks are all retained; no production permission or guest-loading code was changed. This is a test-observer correction, not a claim that the final negative replay has already passed. Fresh full exact-SHA CI is still required.

The subsequent same run measured the corrected Beauty timeline at437.6875 (previously485.6875), still above the unchanged422 bound. Geometry-only data exposed a115.5px mobile toolbar; its scoped CSS retained the desktop16px padding on both sides. The next minimal correction adds only the mobile gutter token `padding: var(--space-2)` (8px) to its existing600px block. No control, label, working-hours information, border or target size is hidden or reduced. The padding-only projection421.6875 is explicitly a prediction, not runtime evidence; the actual422 browser assertion remains mandatory. A separate regression assertion genuinely failed without that mobile gutter, then passed after the one-property fix. Latest bounded matrix: **132 tests /17 verified existing files PASS**; six unit-only vectors from the actual request-observer predicate also reject the wrong action/card/guest/header/body and accept its intended arguments. These unit vectors are not API acceptance.

No production DB workloads, manual migrations, financial model/rule changes, held SQL activation, new dependencies, or new project copies were used. The normal auto-deploy preflight and protected-workspace cleanup policy remain in force.
