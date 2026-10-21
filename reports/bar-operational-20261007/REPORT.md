# BAR financial acceptance candidate

Current candidate: fresh-main base `5c52340a90d52e3344f81300a5c2a0f04ecf5253`, migration `20261011000084_bar_financial_replay`, 93 migration directories. Earlier migration numbers and results below are historical checkpoints.

Status: implementation candidate. This document records local evidence at the candidate commit; the exact-SHA full GitHub CI and final readiness are recorded in the PR manifest. This report does not authorize merge, release, migration or production deployment.

## Scope and baseline

Work is isolated in `wetop-bar-acceptance-20261007-src`, branch `codex/bar-operational-acceptance-20261007`, with private PostgreSQL 16 on localhost port 55893. The foreign shared checkout and Supabase were not modified. Main `50f04c5ce104bc366d4854e5bf831b81ddfe665f` was merged into repair checkpoint `d51556355ae8f6298b1e1db8052ef8748b520864`, producing `c4178b3fd11f6dd029698d14a1ecc8d2ac8fdfb6`. Upstream changes concerned design, Food test synchronization and CI coverage; no BAR/Finance/schema migrations changed. At that historical checkpoint main had 69 migration directories through canonical 63 and BAR used 64. At the next historical checkpoint main 89f4e5f726eff42d18e3d1a2f107dbb7b450ce6e added marketing publication migrations 64/65; BAR was renumbered to 66, making 72 directories. At the historical main 791adad02a5955102f32ffa9c6533a29bc4f3757 checkpoint, Site Assets occupied 66/67 and BAR used `20261007000068_bar_financial_replay`, making 74 directories. The current canonical BAR migration is 84 with 92 directories as stated above. Existing BAR 55-57 are preserved.

## Approved behavior

D1: payment, write-off, retail and Folio operations use a permanent Property/kind/key registry. The same normalized payload replays the original identity and current status; a changed payload returns 409. Effects and accepted key commit together. PostgreSQL advisory locks serialize retries. Four browser forms persist the key and frozen parameters before dispatch, retain them after unknown outcomes, reload and a new authenticated session, and require explicit confirmation to start another intent.

D2: Finance void locks receipt before cash, preserves the original supplier payment and audit, creates one immutable linked compensation and restores debt. Effective paid amounts include only COMPLETED cash. Repeated void is rejected; replaying the original payment returns VOIDED without another expense.

D3: reversing without restock records the original FIFO cost in a separate `nonRestockedLossMinor` indicator. The warehouse is not decremented again. `reversalRestocked` records the choice. Historical backfill validates original sale quantities/costs and complete return evidence, preserving source records and rejecting ambiguous partial restock.

D4/T11: actual SessionGuard, membership roles and AuthorInterceptor are used in acceptance. OWNER/MANAGER have refunds access; STAFF desk operations remain available but refund/settings controls and endpoints are denied; organization READ_ONLY denies all writes. BAR reversal of CLOSED Folios or any positive allocation from a COMPLETED payment returns 409 under the Folio lock, preserving balances and payment history. The earlier PR #279 REVERSED status fix is retained and covered by replay tests.

New financial rows enforce ownership and immutability for both app and BYPASSRLS service roles. UPDATE/DELETE guards survive generic grants restoration. Only a different table-owning administrative role can remove derived records during synthetic cleanup or separately approved rollback. Functions use SECURITY INVOKER and pinned current schema/public/pg_temp.

## Acceptance matrix and evidence

| Cases | Evidence | Result already established |
| --- | --- | --- |
| T01/T03/T06/T07, four operation kinds | `bar-replay-repair.test.ts`, real HTTP and PostgreSQL | one effect; same identity; conflict; intentional new key |
| T02, four kinds | AFTER INSERT failure injection in registry | complete rollback, no accepted key or partial ledger |
| T04/T09, four kinds | real API browser replay and SessionGuard | lost committed response, reload/relogin; frozen intent; one final effect |
| T05, four kinds | PostgreSQL advisory waiters, aborted client and restarted Nest API | controlled concurrency, one operation, persistent replay |
| T08, retail and Folio | persisted replay after reverse | same ID, REVERSED, no new ledger effects |
| T09 roles | `bar-real-auth.test.ts`, browser roles | real membership/session; STAFF/READ_ONLY denied writes; tenant isolation |
| T10 | linked void and no-restock tests | compensation once; restored debt; separate FIFO loss |
| T11 | `bar-reversal-policy.test.ts` | STAFF denied; closed/partially paid denied; allowed open/unpaid OWNER/MANAGER |
| T12 | browser catalog/draft/void and fixture snapshots | reload/readback; discarded unsaved cash form has no effect; original audit retained |
| Populated financial RLS | `bar-financial-rls.test.ts` | A only/B only/unset 0/empty 0/service A+B; ownership and immutability enforced |
| Historical migration | `bar-financial-backfill.test.ts` | source rows unchanged through down/up; exact keys/loss/compensation; partial restock rejects atomically |

RED before GREEN is retained in `tests/runs/logs` and the journal. The old repository reproduced replay/conflict/loss/void failures; browser failures exposed remounted Folio input keys; grants restoration reproduced DELETE access; backfill without classification reproduced missing loss. The final actual-session targeted run `2026-10-07T14-44-34Z-integration-99bc` passed all 30 repair/role/Folio tests. RLS/restore/search-path targeted run passed 13; historical backfill passed one.

Control reconciliation: purchases 280000, supplier payment 60000, remaining debt 220000; retail 12 units leaves FIFO stock cost 148000; Folio 3 leaves 100000; write-off 1 leaves 84000; inventory shortage 1 leaves 68000. Retail no-restock clone preserves 148000 warehouse cost and exposes 132000 separate loss, with cost/revenue/write-off zero after reversal. Supplier void retains payment/cash identity, sets cash VOIDED, increases debt by exactly the voided amount and leaves stock unchanged.

## Regression status

The prior complete integration run `2026-10-07T14-39-51Z-integration-726e` passed 915 tests with five existing Wizard environment skips. Latest targeted actual-session coverage then added two T08 cases; complete regression is being repeated on a fresh UTC database. Existing baseline skip declarations were not changed. No assertions were weakened or timeouts increased.

Strict root/API/web typecheck `2026-10-07T14-51-46Z-typecheck-8996` and lint `2026-10-07T14-51-46Z-lint-81b8` passed. Subsequent schema-default parity and preview-report contract changes require final verification.

First full 70-migration rehearsal applied all migrations and individually rolled back all 70; it correctly failed schema drift because Prisma described client UUID defaults for three SQL-generated UUID IDs. Matching dbgenerated declarations fix the drift; the repeated complete rehearsal is in progress.

The earlier full unit attempt had three host-resource timeouts (3791 passed, four baseline skips); isolated Channex passed, two existing auto-deploy shell tests still timed out. This is not a unit GREEN claim. The unchanged-limit final local run and full GitHub release-checks on the final pushed SHA are required. PR remains draft until all mandatory jobs, including bot/site and separate UI jobs, are GREEN.

## Evidence and boundaries

Synthetic PostgreSQL snapshots and real API browser screenshots are in this directory. Cleanup deletes task-owned operational fixtures and sessions; append-only audit and its required synthetic identity parents are retained. No real guest data or session credentials are included. Traces are disabled because they can contain authentication cookies. Public-site redirect acceptance uses a local site server.

See `MIGRATION-84.md` for backup, guarded backfill, validation and rollback. Old ENOSPC/stale generated-client notes describe earlier failed attempts only; disk was recovered and Prisma regenerated. No production, release, MV8 or unrelated financial feature was changed. Final exact SHA, complete job outcomes and readiness will be recorded in the PR manifest after CI, without changing the tested candidate SHA.

## Final fresh-main impact, 2026-10-07

The next fetch advanced origin/main to `b6db018699fa806060d3e74f8d257ec57a9ff8c2` (MV9). There are no BAR/Finance/schema/migration changes, and 64 remains free upstream. The shared API fetch helper gains an explicit read-only branch report scope; BAR calls must retain ordinary session/scope behavior and the new report field. Synthetic dev caching changes upstream and the existing auto-deploy tests now advance a fixture clock while preserving deadline/rollback assertions. Both sets of changes will be retained in the candidate sync and covered by final regression.

The complete fresh-database run passed 915 with two unchanged 5-second timeouts and five baseline Wizard skips (922 total). Browser whole-suite runs revealed the first-click readiness issue, which was fixed by an added hydrated-control assertion and passed standalone. The later whole suite passed seven but had a transient report-load API_503 in WRITE_OFF and a missed expiry alert in T09. These are retained as failed attempts, not counted as final GREEN. The final browser repetition is sequential with integration.

Additional acceptance: the frozen negative control `2026-10-07T15-19-38Z-integration-d835` failed all three expected cases. Removing the shared Finance receipt lock left zero/one observed waiters instead of one/two; omitting the no-restock loss produced zero instead of 132000 alongside a real 16000 write-off. The preceding attempt `15-16-13Z-integration-b77c` changed its source fingerprint and is explicitly not evidence. Final code was restored before the GREEN run.

The restored-code run `2026-10-07T15-21-14Z-integration-e5d4` passed all 37 BAR cases, including both deterministic pay/void orders and mixed FIFO loss. One of two unchanged MV8 contract tests timed out; the combined run is 38 PASS / 1 FAIL, not full GREEN. Source fingerprints remained unchanged.

Final browser gating: the exact-SHA release-checks workflow now includes all nine real SessionGuard/API BAR browser cases on its own disposable PostgreSQL 16 service. Local runs exposed premature assertions while the RSC response remained pending; successful actions now await full response completion, and injected-loss cases await the actual abort. Original UI/ledger assertions and the 90-second test cap remain. The local host reached that cap for the full cycle during concurrent system activity, so local partial runs are not declared a full GREEN. The final GitHub BAR job and its screenshots are mandatory evidence alongside all existing jobs.

With causal response synchronization, the final local browser run passed all four replay kinds, actual 503/session recovery, both role cases and catalog/cash-void acceptance: 8 PASS. Only the full cycle reached its unchanged 90-second deadline. CI job contract RED `2026-10-07T15-45-48Z-unit-534b` then full CI guards GREEN `2026-10-07T15-47-19Z-unit-cf3b` passed all 23 tests. Selected RED filtered 22 unrelated tests; no skip declarations were added. Full 70-migration/drift/all-down rehearsal ended RESULT OK.

Final local strict checks: root/API/web types PASS (`2026-10-07T15-49-56Z-typecheck-6236`), lint PASS (`15-49-56Z-lint-fcfe`). Full unit (`15-49-56Z-unit-72c6`) completed 3841 cases: 3825 PASS, 12 FAIL, four unchanged baseline skips. Eleven failures are existing shell cases reaching their 5-second bound; the local-db subprocess has a separate unchanged 10-second bound and returned null status. No BAR logic assertion failed. This does not constitute full local GREEN; the complete exact-SHA GitHub workflow, including the new BAR browser job, must pass before draft is removed. No assertion or timeout was changed to mask these results.


Final upstream sync: MKT7 publication/preview/domain changes were reviewed; auth changes add only token-protected sites preview to the runtime-key allowlist. BAR and Finance code are unchanged upstream. Schema and RLS additions were retained alongside BAR records. Full exact-head CI, including 72 migration apply/drift/down checks and all nine real-session BAR browser cases, is required before draft removal. Historical local counts and failures above are not represented as final CI results.


Post-MKT7 local verification on the synced source: 26 CI/auth route unit cases PASS; all 43 financial BAR integration cases PASS on new private database pmsbar_synced (72 migrations), including actual-session replay, roles, paid/closed Folio denial, payment/void race, immutable populated RLS and migration 66 historical backfill. Root/API/web typechecks PASS. Final complete CI remains required.

Post-sync lint PASS; git diff --check PASS. Final exact-SHA CI dispatch and completion are tracked in the PR manifest, without rewriting the tested commit after CI.


First full exact-SHA CI 37650842393 on 86efc591b passes 3897 unit cases, site checks and all nine BAR browser cases. Artifact visual review found reload screenshots could capture the loading skeleton after database assertions. T12 now additionally proves the reloaded catalog row, discarded draft controls and annulled cash row are visible before screenshots. This strengthens existing UI acceptance without weakening accounting assertions or changing timeouts. A new full exact-SHA CI is required for this final evidence correction.


CI 37652290756 on ddef43b95 completed: 3897 unit PASS (7 existing Linux/platform skips), 1757 bot PASS, 937 integration PASS (12 existing skips), 72 migration apply/schema-drift/all-down checks PASS, onboarding 4 PASS and authenticated e2e 26 PASS. Food/Beauty/Branches and UI shards 1/2 PASS. BAR browser 8 PASS/1 FAIL exposed a case-sensitive status assertion (persisted cash badge is exactly "аннулирован", not "Аннулир"). UI shard 3 has 325 PASS/1 FAIL: its global failure fixture now denies /auth/me before the report component renders. Both remain disclosed.

Final acceptance correction keeps original accounting assertions and timeout limits: cash status is now asserted by exact visible badge plus is-void row class both before and after reload. The global auth failure loop additionally covers both analytics routes; report-specific pa-error/statistics-error assertions remain and receive a targeted /desk/dashboard failure while auth is available; connections still receives global failure. Local sequential reproduction is GREEN for both cases. The prior overlapping local browser attempt collided on .next/artifact storage and is invalid evidence. The final full CI must run again on the corrected head.


CI 37658200209 on 3499bd067: all nine real-session BAR browser cases PASS, with 22 screenshots downloaded and Finance/catalog reload evidence visually reviewed. Food/Beauty PASS. Branches has 38 PASS/1 FAIL: a document-wide locator encounters the visible Food Today screen plus Next's temporary hidden streaming copy. The accepted READ_ONLY/STAFF test now scopes to the accessible main landmark, asserts exactly one screen and retains visibility/error assertions and unchanged limits. Its local four-combination regression PASS. No Branches/Food production behavior changed. A new full exact-head CI supersedes the unfinished prior run.


Fresh-main impact during final CI: PR285 Site Assets advanced main to 791adad02a5955102f32ffa9c6533a29bc4f3757 and occupies 66/67. No BAR/Finance changes. The unpublished BAR migration is now 68; final inventory 74 directories. The prior pending exact-head run was cancelled. Sync the new schema/RLS/marketing routes and require a new full exact-head CI. Earlier 70/72-migration evidence is historical.


Post-Site-Assets local verification: npm ci/client generation PASS; root/API/web typecheck PASS; lint/diff check PASS. Fresh private pmsbar_assets applies all 74 migrations. Critical financial suite: 42 PASS/1 OWNER auth 5000ms timeout; isolated actual-session auth repeat: all 4 PASS (39 remaining financial cases passed in the first run). No timeout, skip or assertion changes. Final full CI must prove the synced candidate as a whole.

## UUID reference canonicalization, final review

The existing API accepts UUID references in either case. Review reproduced first uppercase requests failing with 500 and opposite-case retries failing with 409 across supplier payment, write-off, retail and Folio operations. Registry payload references now use PostgreSQL canonical lowercase identity; opaque operation keys retain their original case. No SQL, migration, money or scope-policy changes were made.

Recorded RED `2026-10-07T18-20-36Z-integration-dd69`: all 8 new cases failed; 21 other cases were filtered, with no new skip declarations. Recorded GREEN `2026-10-07T18-22-49Z-integration-9945`: all 29 replay, race, rollback and UUID cases passed. Both runs have `codeChangedDuringRun=false`.

The complete release-checks run [37660711921](https://github.com/GAIVER007/wetop.ai/actions/runs/37660711921) passed on historical candidate `7316061bd4ba4257d746565b8d610cd445392ec0`: 3981 unit, 953 integration, 1757 bot, 53 site, 4 onboarding, 26 authenticated e2e, 9 BAR browser, 39 Branches, 13 Food and 10 Beauty tests, all three shared UI shards and the UI gate. All 74 migrations applied, schema drift and all-down rehearsal passed. This is predecessor evidence; the UUID repair requires a new complete CI run on its published head before readiness.

## Fresh-main impact, 2026-10-11

Main aceba95e029df7e7bdd611ab60f712cfceab537c adds BAR catalog/receipt/operation/supplier workspaces, document scanning, product edits, monthly metrics and timezone-correct Folio service dates. Preserve these contracts and approved D1/D2/D3/D4/T11 finance guards together. Upstream already fixes the detached-node mobile padding measurement without relaxing the assertion. Original candidate 95463efb16dabcd15f18328b427d1bb73e332797 completed 961 integration and the financial browser suite, but shared UI 2/3 had 329 PASS and one detached-node padding failure; it was never final GREEN. Number 68 is occupied by Site Builder; the unpublished BAR migration is now 20261011000084_bar_financial_replay after inspecting all migrations through 83. No production migration has been applied. Public wetop.ai and app.wetop.ai respond; The separate unauthenticated BAR browser shows a 401 data-loading error; authenticated domain acceptance is still outstanding. SSH to the documented deployment server timed out.


Local synced acceptance on 2026-10-11: 73 BAR unit tests and 51 critical integration tests PASS; root/API/web typecheck and lint PASS. All 90 migration directories apply, schema drift is empty and every down rehearsal PASS. Recorded browser run 2026-10-11T08-49-17Z-e2e-cc85: 10 PASS, zero skips, codeChangedDuringRun=false, 24 synthetic screenshots retained outside the checkout. Product-card recovery overlay RED: 2026-10-11T08-43-12Z-e2e-f3cc; normal click was blocked by the recovery status. The CSS repair passes normal-click replay without forcing clicks. The negative-control missing-key run 2026-10-11T08-34-19Z-e2e-d67f also has unchanged source during execution.

Full local unit 2026-10-11T08-52-53Z-unit-63f5: 4481 PASS, 30 FAIL, 4 existing platform skips. Failures are timeout-limit failures, including shell deployment/backup/restore tests; no timeout or skip policy was changed. These require repeat and final exact-head CI before readiness. The first full integration run discovers the private PostgreSQL default timezone Asia/Dubai rather than UTC; investigate retry scheduling and day-boundary failures and repeat against the UTC test environment. Do not claim final GREEN from partial suites.

Upstream advanced again to ff174dbaebaaa2f248d641938975036877a24b03 with profile-menu hydration readiness. No BAR or migration changes were found; preserve this upstream update before publishing the synced candidate. Production migration and server SHA verification remain outstanding.


Final UI review reproduced real legacy-grid collisions with permanent geometry checks: RED 2026-10-11T09-28-07Z-e2e-0f5b, both cases failed, unchanged source during execution. BAR form overrides now live in the existing sections layer; retail/Folio inputs and product-card recovery are readable and normal-click usable. Cash void SSR exposed an enabled button before hydration: RED 2026-10-11T09-34-15Z-unit-98d9, GREEN 2026-10-11T09-34-53Z-unit-cb78. The control is unavailable until its own confirmation handler hydrates, without changing D2/D4 or money behavior. Full real-session browser run 2026-10-11T09-35-56Z-e2e-111c: 10 PASS, zero skips, includes geometry and cash-void persistence.

Full local integration on published predecessor a0241cdf and a fresh UTC PostgreSQL database: 2026-10-11T09-19-10Z-integration-5c99, 1049 PASS, 16 existing skips, zero failures. No assertion or timeout changes were made. Complete fast CI for predecessor a0241cdf: 4512 unit PASS (7 existing platform skips), lint/typecheck PASS and 111 site checks PASS; BAR/Food/Beauty/Branches CI jobs passed. That run was cancelled when final visual/readiness defects required source changes. It is not final exact-head GREEN. Final immutable CI evidence and counts are reported in the PR description after the last source commit; do not create a post-CI source change or treat predecessor evidence as current readiness.


Final breakpoint regression: exact-head CI `38129589983` passed lint/types and 4516 unit cases, but rejected one newly introduced 560px breakpoint in BAR. The new breakpoint was changed to the approved 600px threshold without changing the design baseline, assertions or timeouts. Design guard replay `2026-10-11T09-55-48Z-unit-3085` passed all 18 cases. The two preceding local commands used incorrect recorder arguments and were interrupted; they are not acceptance evidence. Full browser and CI must pass on the corrected head before readiness.


Fresh-main follow-up: main `db87145d58341d1df064f6eae15d27672abd4d29` adds approved site/SEO, Market UI and calendar test-label updates, without BAR/Finance/schema or migration changes. Sync completed without conflicts; migration 84 remains free. CI `38130205837` passed unit 4517, site 124, integration 1049, API checks 4, e2e 26, BAR browser 10 and all 90 migration/drift/down checks; UI shard 2 rejected two stale housekeeping label expectations after the upstream label became `Уборка и проверка`. Three exact expected strings were updated while retaining counts, statuses and timeouts. Local six-case housekeeping GREEN: `2026-10-11T10-33-10Z-e2e-379b`, source unchanged, isolated ports 55991/55992. The first attempt stopped because port 4311 belonged to a foreign checkout; no foreign process was interrupted. Targeted unit GREEN: `10-34-39Z-unit-ca32`, 39 PASS. The final synced head requires a new complete CI; preceding results do not mark it ready.

Old-head UI shard 3 found three additional stale calendar labels (free-place link and housekeeping label). Fresh main already contains their upstream fix from PR 399; those tests were not weakened locally. The full workflow must be rerun after synchronization.


Old-head shard 1 also found the BAR overview's stale seven-KPI contract, another free-place label, and three calendar gesture/readiness failures. The approved eighth KPI (no-restock FIFO loss) now has an exact label and zero-value assertion in the synthetic UI contract. Local reproduction `2026-10-11T10-42-40Z-e2e-e878` retained four failures. Traces showed the resize target outside the grid viewport and range coordinates captured before client geometry settled. Tests now await existing React hydration readiness and loaded fonts, scroll the target into view, and retain the exact original nights, dates, confirmation and persistence assertions. The drawer test awaits hydration before its normal double click. Availability waits for its real navigation; no forced click, skip, assertion weakening or timeout increase was added. GREEN `2026-10-11T10-47-56Z-e2e-c2b4`: all seven targeted UI cases PASS, source unchanged.

Synced local BAR replay `2026-10-11T10-37-44Z-e2e-7d0f`: nine PASS, one login redirect assertion reached its unchanged five-second bound while actual navigation remained pending. The session test now awaits actual login navigation before the same URL/storage assertions, within its original test deadline. This partial run is not full GREEN; repeat evidence and the complete new-head CI remain mandatory.


Post-navigation BAR replay `2026-10-11T10-51-34Z-e2e-1b06`: eight PASS, two role cases reached the unchanged 90-second test deadline during page.goto (products/suppliers). Login redirect recovery passed. Mac telemetry at this run: encrypted swap 16 GB used of 16 GB, zero free; load about 10. Foreign processes were not touched. This local partial run is disclosed, not described as full GREEN; the exact-head disposable Linux CI must prove the complete ten-case role/replay matrix.

Final synced checks: root/API/web types PASS `2026-10-11T10-59-45Z-typecheck-a095`; lint PASS `10-59-59Z-lint-4a8b`. All targeted UI failures have causal RED/GREEN evidence. Final exact-head CI is still required for full readiness.


Complete exact-head GREEN: `91febbbe9d2603bd60f55b8fa5eb0637b131a119`, workflow `38134287789`, including the full general UI gate. Main advanced to `014b0ee0399a8c9efeefe88933254c41527c6c4b` during the run. Its changes include shared compact navigation, Food/Beauty workspaces and site updates, without BAR/Finance, schema or migrations. The only textual merge conflict was DECISIONS.md; both complete decisions were retained. Synced BAR browser `2026-10-11T11-48-20Z-e2e-3fbe` passed all ten cases locally, source unchanged.

Fresh-main design guard RED `2026-10-11T11-47-28Z-unit-b726` found four upstream violations: 2px literal navigation gap, unapproved 1250px breakpoint and two duplicate dynamic inline geometries in the empty Beauty timeline. Gap now uses the approved spacing token, breakpoint uses 1279px, and empty/full Beauty timelines share the existing geometry renderer, without a fictitious master or newly enabled booking. No baseline, guard or assertion was changed. Initial corrected targeted unit GREEN `11-51-31Z-unit-0901`: 35 PASS. Final synchronized-head checks and a new full CI are required; the earlier complete GREEN is explicitly historical.

Final corrected merge-tree checks: targeted unit 35 PASS `2026-10-11T11-52-25Z-unit-3455`, root/API/web types PASS `11-52-25Z-typecheck-2a5e`, lint PASS `11-52-25Z-lint-932b`. No source changed during those runs. Final exact-head CI and production access remain outstanding.


## Final sync to b811e67f

Main advanced again to `b811e67f8ab0e77b39b4f3aa4e2e7945fd70ffdd`, carrying the previously corrected calendar specs, guests/chart geometry and Beauty design guard annotations. No BAR/Finance/schema/migration semantics changed. The sole Beauty renderer conflict preserves both upstream geometry annotations and the shared empty/employee renderer. This reduced the historical inline-style baseline from 6 to 4; the snapshot is tightened accordingly, without suppressing new violations. The cancelled workflow 38137386672 is superseded, not GREEN evidence. Before snapshot correction, design guard RED was 19 PASS / 1 FAIL (`2026-10-11T12-00-19Z-unit-aa97`). Root/API/web typecheck and lint passed on the merged sources. A new full exact-head workflow is required before readiness.

Corrected snapshot verification: `2026-10-11T12-07-14Z-unit-c5c6`, 20 PASS. Types `2026-10-11T12-00-23Z-typecheck-b397` and lint `2026-10-11T12-00-25Z-lint-b591` PASS. Source fingerprints were stable.


## Current-contract regression sync to 13b99b02

The candidate run 38138089967 passed unit 4529 (7 existing skips), site 127, bot 1886, all 10 BAR real-session browser cases with 24 screenshots and Food. It exposed stale Beauty empty-state and Food navigation expectations; the integration scenario also expected Food creation to be denied although fresh main explicitly enables owner creation. Its audit FK cleanup failure initially masked the stale 400 assertion. These failures are retained, not reported as GREEN. Main `13b99b0285b73587cfaf82f1719f06e2ddd8e172` independently carries matching acceptance corrections.

Merged acceptance preserves upstream assertions and adds exact empty Beauty timetable/disabled creation checks, persisted Food Location ownership/vertical, absence of a Hospitality Property and one creation audit. Beauty synthetic fixture recreates its marker identity after cleanup, avoiding cascaded missing-organization errors when Playwright restarts a failed worker. No product business policy changed.

Local evidence: Beauty run `2026-10-11T12-20-20Z-e2e-3faa` passed 10 cases and failed the last stale onboarding heading; the corrected onboarding case passed `2026-10-11T12-27-08Z-e2e-aac2`. Branches Today `2026-10-11T12-27-56Z-e2e-32e4` passed 20 including the reproduced Food menu case, with two navigation/readiness failures under Mac load, which remain disclosed. Integration after cleanup exposed the exact 201-versus-400 RED in `2026-10-11T12-25-11Z-integration-f971`; corrected persistence/audit acceptance passed both tests in `2026-10-11T12-25-55Z-integration-774e`. Full exact-head CI remains mandatory.

General UI run 38138089967 found confirmed empty Beauty accessibility errors (ARIA label role, focusable scroll region and contextual link distinction), stale generic Beauty empty-heading expectations, a singleton Marketing navigation expectation, and transient missing document title during axe. These are repaired without disabling axe rules: labeled group/keyboard-accessible region, underlined setup links, exact empty-state assertions, singleton section focus/Enter contract, and an explicit existing document title assertion before axe. An experimental menu focus change was removed after identifying the singleton contract. Source menu behavior is preserved. Main c871865c independently contains matching Beauty accessibility and Marketing acceptance corrections. The interrupted local run `2026-10-11T17-01-26Z-e2e-0fd8` is not GREEN evidence. Final synced integration `2026-10-11T17-00-06Z-integration-eb7b` passed both tests; the preceding concurrent run timed out at the unchanged 5-second test limit and is disclosed.

Final main sync: `c871865ca2caf074edbbf3d554df61d15dbc5989`. Its Beauty accessibility changes and singleton Marketing assertions are preserved; the shared renderer keeps the empty timeline's labeled group and keyboard-accessible grid. Local `2026-10-11T17-06-14Z-e2e-a349`: 8 PASS (including Beauty light/dark axe and Marketing keyboard acceptance), 1 unchanged 45-second AI creation navigation timeout before axe. This is partial local evidence, not full GREEN. The document-title assertion remains strict and the full Linux suite must demonstrate the previously reproduced axe case.

Final merged sources: typecheck `2026-10-11T17-10-57Z-typecheck-2649`, lint `2026-10-11T17-10-57Z-lint-0a4e` and unit 20 `2026-10-11T17-10-57Z-unit-f4f8` PASS with stable fingerprints. Full exact-head release-checks is required after the following merge commit.


## Fresh main 29ae2a5a impact

During the final UI run, main advanced to `29ae2a5a24de2a1763cd925f697708b2f2b1cae9`: Restaurant cash migrations 86/87 and its approved model, protected vertical 401 login routing, and queued main CI. BAR 84 remains free and unchanged, as do BAR 55-57. The final directory count is 92. Food cash remains upstream scope; this repair does not redesign it. Prisma/RLS/model merges preserve both domains. Three duplicated regression-test conflicts preserve upstream behavior and the stronger persistence/ownership/audit and empty-state assertions. The matching Prisma client was generated and only this task's private localhost test database received migrations 86/87. Production was untouched.

Previous candidate e1bc6f4b passed unit 4529, site 127, integration 1049, API 4, e2e 26, BAR 10 with 24 screenshots, Beauty 11, Food 23, Branches 39, bot 1886, UI shard 2:395 and shard 3:415. Shard 1 had not finished when fresh main required another sync. It is not complete GREEN evidence. A new full exact-head run, including upstream locked-session acceptance, is mandatory.

Workflow 38159136845 subsequently completed full GREEN on e1bc6f4b. This is historical complete evidence on the 90-directory chain, not final proof for the newer 92-directory merge. Local 92-directory critical integration `2026-10-11T18-06-31Z-integration-c19e`: 45 PASS / 1 unchanged 5-second T05 Folio timeout. Exact unchanged T05 Folio retry `2026-10-11T18-09-03Z-integration-2cf1` passed in 656 ms. Its 28 non-selected cases are test-name filtering, not new skipped test declarations. No assertions or timeout limits changed.

Merged 92-directory local checks: unit 51 `2026-10-11T18-11-02Z-unit-bb16`, root/API/web typecheck `2026-10-11T18-11-01Z-typecheck-8d6b` and lint `2026-10-11T18-11-01Z-lint-23f0` PASS, with unchanged source fingerprints. No unresolved merge markers remain.


## Final profile-menu readiness RED to GREEN and fresh-main sync

Exact-head workflow 38163235973 on 96b230ff passed unit 4546, site 127, integration 1051, API 4, e2e 26, BAR browser 10 with 24 screenshots, bot 1886, Food 24, Beauty 11, Branches 39, UI shard 1 with 419 plus 8 locked-session cases, and UI shard 2 with 395. All 92 migration application/down/schema checks passed. UI shard 3 passed 414 cases and failed one profile-menu cold-navigation case with ERR_ABORTED and route-cleanup timeout. The first attempt is retained as RED, not full GREEN.

An unchanged isolated run reproduced ERR_ABORTED in all three profile-menu cases. Login URL change was followed by script interception before the authenticated header became ready. The setup now waits for the existing profile button to become enabled before installing the gate for the next document. Cold-document disabled/busy styling, blocked early click, normal click and keyboard assertions are unchanged. The same three cases passed after this setup correction in recorded run 2026-10-11T19-01-31Z-e2e-e1ee (3/3); no timeout, skip or assertion was weakened.

Fresh main 2d3476cdd2ddd92a8d8d8d2719706f0c34f70f1b adds permitted hotel search and journal labels plus Restaurant landing copy. These upstream changes are preserved; no new BAR, Finance or migration changes exist. BAR 84 remains free and the merged chain still has 92 directories. A new complete exact-head workflow is required after this sync. Production SSH still times out; HTTP 200 on both domains does not prove deployed SHA or authenticated BAR behavior.


## Calendar assumptions RED to GREEN, 2026-10-12

Workflow 38166523117 on ed801ffa passed unit 4546, site 127, integration 1051, API 4, e2e 26, BAR browser 10/24 screenshots, bot 1886, Food 24, Beauty 11, Branches 39, UI2 398 and UI3 415. UI1 passed 417 and failed two assertions: a hardcoded whole-fund downward occupancy direction after ADR-155 switched the first tile to room occupancy, and expecting current October day inside a selected September calendar. This is RED, not full GREEN. The unchanged local retry also failed before completion on the heavily loaded Mac; those timing errors are retained separately, not represented as identical assertion failures.

The monthly comparison now uses the existing endpoint-based direction oracle and retains the percentage-point unit assertion. The September range case fixes browser time to 2026-09-15 and additionally checks aria-current on precisely September 15 while retaining all 12 highlighted range days, accessibility, positioning and month navigation. Both corrected cases passed unchanged limits in run 2026-10-11T20-03-18Z-e2e-8dc3 (2/2). No product policy, runtime finance logic, skip or timeout changed.

Fresh main 5c52340a90d52e3344f81300a5c2a0f04ecf5253 adds Restaurant customer VIP/birthday migration 88. Its model/docs/schema/API/UI changes are preserved. There are no new BAR/Finance changes, BAR 84 remains free, and the merged chain has 93 migration directories. Only the private localhost database is migrated. Full exact-head CI including all 93 migration rehearsals is required on the final head.
