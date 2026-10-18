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

## Measured residual overflow and verified closure

Focused GitHub browser run39063198703 on d9a339395 reproduced both unchanged320/390 cases: document scrollWidth456 at both viewports, while restored stay-count number fields already fit. Geometry-only attachments identify the direct change-dates panel's implicit grid column415px inside288/358px panel borders, and the following notes/source edit panel's358.219px intrinsic column. Their rows/native selects expanded outside the constrained panels; this was not remaining stay-count input overflow.

92a4496c1 adds only a semantic reservation-actions class and scoped direct-form zero-minimum grid tracks/row bounds. Nested stay-count forms, handlers, permissions, defaults, finance and all controls remain unchanged. The three new source-contract assertions genuinely failed before the fix, then passed. Most importantly, the exact same two existing browser cases actually PASS in GitHub run39063939150 (2 passed18.7s), including whole-document bounds and stored field checks. No overflow hiding, limit changes, retries or baseline updates were used.

The temporary branch-only read-only diagnostic job did not run the reference-capture/write job (verified skipped). It is not the full release gate. Its entire temporary workflow change is now retired byte-for-byte to original SHA2569b2bdc4badf4f613c281ecdd5e1c730370b59808f081707668eec15de2db2725 before final candidate CI.

## Remaining CI reliability corrections and final bounded checkpoint

UI CI previously scheduled one test worker while preparing two active isolated API/app/site sets. An explicit CI-only UI_RUNTIME_WORKERS1 now drives both projects and servers from the same pure selection, preserving the complete duplicate-free union of218 source specs and all five shards. Defaulttwo, separate auth/vertical configurations,45s budgets, zero retries and all guards remain. Independent source review approved the narrow change. This is an objective topology correction, not proof that prior shutdowns were OOM.

F2 now derives its test period after each successful fixture reset from the actual validated fixture today. The previous module-load clock and later-reset clock demonstrably disagreed across midnight; actual-source VM verification reproduced RED then GREEN. The two pure regressions also reject missing/malformed/impossible dates. Production finance code/rules are unchanged; VM and pure tests are not actual API acceptance.

Final parent bounded checkpoint after workflow restoration:161 tests across21 verified files PASS;55 changed TS/TSX ESLint files PASS. Eight original protected-business comparisons remain TRUE. Fresh full exact candidate and resulting-main release-checks, deployment and authenticated live acceptance remain mandatory, especially real24-case security/recovery acceptance, Beauty's unchanged422 bound and all UI shards. Neither the successful two-case probe nor local units authorize merge or publication.

## Subsequent full-gate findings and actual targeted closures

The next full gate39064287753 actually passed all24 real API/recovery/guest/RLS-connection cases (2.4m), core lint/types/unit/site, canonical auth, runtime audit, food, branches and employee portal. It did **not** turn green: Beauty still measured437.6875 and UI1 had five failures in reports-finance. Other job conclusions must be read from the completed full run, not inferred here.

The earlier mobile8px declaration was a no-op, not an effective vertical reduction: B05 already applied the same padding. The projection was therefore wrong. The corrected scoped property is `padding: 0 var(--space-2)`, preserving horizontal spacing, all controls and their44px targets. Its strengthened source regression genuinely failed on the old value, then passed; no422 bound change. GitHub focused run39066144555 executed the existing compactness/filtering/hidden-occupancy case successfully. This is actual closure of that case, not a claim that the whole vertical/full gate passed.

The first reports-finance failure was directly traced to HTTP503 with the synthetic failure envelope, not finance arithmetic or a403. The fixture's process-global failPath wildcard can survive a file boundary: quality had no cleanup after its intentional API failures, finance had no baseline reset, and shared fixtures do not auto-reset. No production authorization or financial handling was weakened. Quality now awaits and success-checks reset after each case; finance establishes the same checked baseline before each case. All original bodies/assertions remain byte-identical. Four actual-hook VM contract regressions genuinely failed for missing hooks and then passed; these are not browser/API financial acceptance.

Controlled GitHub run39066891295 then actually executed the existing negative quality case **first**, followed by the existing positive financial API/UI totals case in the same main-ui-0 runtime. Its retained JSON independently verifies exactly2 passed,0 skipped,0 unexpected,0 flaky and this start-time order. The earlier822 diagnostic already ran both cases successfully but its job failed because a relative JSON path was wrong; the checker was retained and an absolute diagnostic output path corrected. The later entire diagnostic job succeeded. No reference snapshots were updated.

All temporary diagnostic workflow changes are again retired byte-for-byte to original9b2bdc4b SHA256 before the next complete exact-candidate gate. Final parent bounded checkpoint:165 tests in22 verified files PASS,58 changed TS/TSX lint files PASS, eight original business-preservation comparisons TRUE. Actual focused successes do not replace that gate, resulting-main CI, normal deployment or authenticated live acceptance.

## Real desk-action completion follow-up

Full gate39067371513 on1d completed15/16 jobs successfully, including every UI shard, whole Beauty vertical and actual24-case API recovery/guest/RLS suite. The only failed job was late real desk E2E: the second correct guests-action POST returned200 headers but `response.finished()` never observed RSC transport completion. Its terminal UI had already released pending; no subsequent authoritative readback ran, so neither success nor a particular framework bug was inferred from headers alone.

The test-only fix first submits invalid0/0 with native HTML validation bypassed only in test DOM (min1 assertions retained), requires the specific server adult-minimum error and unchanged full real card/finance, restores native validation, submits valid1/0 while the old error is demonstrably still present, then requires that error to disappear, pending to finish, values to match and all full authoritative snapshots to remain equal. The actual action preserves the error through editing/pending and returns null error only after awaited API success. RPC correlation now also requires the target item and both real multipart count fields. Whole-stream wait is replaced by a stronger semantic completion witness, not removed in favor of HTTP200. Both stays and every prior group/notes/source/finance/close/cancel assertion and180s budget remain intact.

Actual focused CI39070198271 on164e94e73 passed mandatory schema guard, authenticated session setup and the full original desk scenario:3 passed,0 skipped,0 flaky/retry. Strict JSON report was downloaded and parsed. Three new source-only regression guards had genuine3-test RED then GREEN; they are not represented as runtime proof. No production or financial/schema/auth/model change was made. Temporary manual diagnostic workflow is restored byte-exact9b2 before the next full new-SHA gate. Final parent bounded verification:168 tests in23 files PASS,59 changed TypeScript/TSX lint files PASS, all eight original business-preservation comparisons TRUE. Main merge, separate main CI, normal release, deployed-image health and authenticated12-case/four-photo acceptance remain mandatory.
