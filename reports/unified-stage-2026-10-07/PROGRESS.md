# Unified acceptance progress, 07.10.2026

This is an intermediate report, not release approval or completed C01-C16 acceptance.

Base: 94a2ae33416ece62d2bd18d8f3ef1896ed209702. Branch: codex/unified-acceptance-20261007. U07 cherry-pick: fd465e42fef0970a8ca712f5a3f06ab688794c2f. Later source changes are not committed yet.

## Evidence

- AVAIL-SUM-01 and FIN-NAV-01: four RED cases (desktop/mobile), log 2026-10-07T12-40-15Z-e2e-453c. Minimum display/navigation fixes, combined search/history/finance filter/print/report regression 30/30 GREEN, log 2026-10-07T12-42-14Z-e2e-829a. These are browser UI tests against synthetic loopback API, not live domain evidence.
- Turnstile: 2 FAIL / 4 PASS in six repetitions, log 2026-10-07T12-43-57Z-e2e-8332. Test raced the 403 reset by submitting a new token before reset completion. Precise error/reset/enabled assertions added; creation-key/token assertions preserved. Ten repetitions GREEN, log 2026-10-07T12-46-19Z-e2e-9e9b. Widget application and CAPTCHA checks unchanged.
- Calendar/DS0a integration: three RED failures (undefined space-3, added font literal, unapproved breakpoint), log 2026-10-07T12-51-23Z-unit-2279. Source tokens corrected; baseline and guard assertions unchanged. Target unit 84/84 GREEN, log 2026-10-07T12-52-18Z-unit-f733.
- BAR populated HTTP lists/reversed replay: real AppModule, SessionGuard, restricted app DB role, PostgreSQL 17 synthetic data. Two RED, log 2026-10-07T12-48-33Z-e2e-acf2; two GREEN, log 2026-10-07T12-49-13Z-e2e-30c1.
- Expanded BAR: C06-C08, invalid quantities/overpayment and read-only API cases passed in log 2026-10-07T12-54-52Z-e2e-926d. Browser case failed (locator found hidden option) amid ENOSPC, not accepted as PASS. The subsequent full seven-test BAR run passed, log 2026-10-07T13-04-41Z-e2e-f939. Exact cell label and PostgreSQL statistics snapshot refresh fixed two test-harness errors. The last-unit race used a real row-lock barrier and persisted one sale with HTTP 201/409 and zero stock. Mobile populated data survived reload. This does not complete all C01-C16 criteria.

## Environment and boundaries

Local PostgreSQL version marker is 17; own data directory /tmp/wetop-unified-pgdata-20261007, port 55934. Production data/secrets were not copied. Real dispatch is disabled in the fixture. Stand cleanup remains pending and must be proven after checks, not claimed now.

ENOSPC interrupted browser execution. Only generated caches/dependencies belonging to this chat's completed U07 runs and this stopped run were removed; source, reports and database data were preserved. Available storage increased to 2.5 GiB.

Runtime production SHA and migration state remain NOT VERIFIED, the configured hostinger alias did not identify the WETOP deployment. No deploy attempted.

## Pending

Full U01-U12 on combination, calendar/role/scope regressions, complete BAR matrix and controlled concurrency, owner financial/access decisions, exact final SHA/full CI, review and actual stand cleanup. Do not promote partial scenario assertions to full C-number acceptance.

## BAR browser diagnostic

The passing mobile run logged a hydration attribute warning after screenshot caret suppression (`style={caret-color:transparent}`). No application change is justified by that test-side attribute alone. Full operational acceptance and remaining policies are still pending.

## Final status of this local run

BAR seven-test rerun GREEN (13-04-41Z). Calendar selection run failed from ENOSPC before acceptance, log 13-06-24Z; 117 selected checks are NOT ACCEPTED. Remaining U07/full CI/review are not complete. No production or release changes.

Cleanup executed 07.10.2026: owned PostgreSQL 17 stopped, owned synthetic data directory and embedded binaries removed, stopped browser servers had no listeners on 55823/55824/55825/3100/4311/3002. Final port verification is recorded separately. Only owned generated Next caches removed. Source, reports and foreign trees preserved. Synthetic ephemeral session header in failed request diagnostics redacted before saving evidence.

## Continued read-only preflight (07.10.2026)

After storage was freed, 23 GiB were available and own locks were empty. The same owned branch/HEAD was retained, no latest-main additions. Calendar/role/workspace selected 117 cases started again. Captured integration RED: inherited compact-screen maximum bottom gap is 32px; actual 46px after the side-summary layout narrowed and wrapped the legend. Footer layout repair is recorded in DECISIONS.md, test threshold unchanged.

The WETOP server address documented in docs/deploy.md (187.77.145.152) was tried with BatchMode and StrictHostKeyChecking, read-only deploy-marker/checkout SHA commands. SSH port 22 timed out before connection. Runtime SHA remains NOT VERIFIED; no server mutation or alternate-host bypass.

## Calendar integration RED

Recorded selection 2026-10-07T13-17-58Z-e2e-fd86: 116 PASS, 1 FAIL of 117. Sole failure: compact-screen bottom gap 46px, required <=32. Roles, mobile gestures 360/390/430, populated preview command persistence, cross-route desktop/mobile walkthrough and error/retry cases passed. Footer moved outside the left grid column to full page width, retaining all labels. Threshold and row count assertions unchanged. Repeated calendar selection is running; no GREEN claim yet.

## Calendar integration GREEN

Recorded rerun 2026-10-07T13-32-43Z-e2e-04ce: 44/44 PASS. This includes the unchanged eight visible rows and maximum bottom gap 32px acceptance, desktop workspace, filters, mobile 360/390/430, focus, history and preview behavior. Fresh screenshots preserved in calendar/. The previous 116/117 run supplies the wider role/workspace evidence; final full CI remains pending. PostgreSQL 17 synthetic stand is being recreated for combined U01-U12 validation. No production or release mutation.

## Combined full API master verification

Recorded 2026-10-07T13-40-23Z-e2e-ec69: 24/24 PASS on recreated isolated PostgreSQL 17. U01-U12, mobile Food completion, full outage, timeout, 503 before commit, lost response after commit, repeat, 409 concurrent window, real expired/revoked session, STAFF/read-only denial and initial protected-page outage recovery passed. Both test files require fixture cleanup via real QA API in afterAll. Final destruction of the current synthetic stand remains pending. Production/release untouched.

## Expanded BAR guarded API verification

Recorded 2026-10-07T13-47-51Z-e2e-ac0d: 8/8 PASS. C09 returned the original lot split (10 at 10000 minor, 2 at 16000 minor); repeated reverse returned 409 without effects. C03 repeated receipt posting returned 409 with unchanged lot/movement/cash counts and report. C04 remaining supplier debt was paid to zero, stock unchanged; one-minor-unit overpayment returned 409 without effects. Other previous BAR assertions and controlled last-unit race repeated successfully. C01-C16 remains partial because cross-tenant HTTP, other races, lost-response browser retry and owner policy gates are not all complete.

## PostgreSQL 17 BAR security regression

Recorded 2026-10-07T13-49-54Z-integration-430c: 370/370 PASS across populated tenant RLS, property guards, child/parent ownership, external parent ownership and controlled parent/link concurrency. Tests exercise wetop_app and wetop_service, including READ COMMITTED and REPEATABLE READ races. SQL fixtures roll back or drop their isolated schema in afterAll. This is current-candidate local evidence, not production security certification.

## Guarded foreign IDs and operational races

C15 HTTP selection 2026-10-07T13-51-16Z-e2e-b1c5: 1/1 PASS. Foreign product sale/write-off/price, receipt posting/payment and sale reversal all returned 404; both tenant reports, sales and stock unchanged. C16 selection 2026-10-07T13-52-21Z-e2e-4111: 4/4 PASS. Real row-lock barriers observed two waiting requests before release, outcomes 201/409. Last-unit sale, remaining-debt payment, receipt posting and restock reversal persisted exactly one effect.

## C13 retry identity RED and environment collision

Two action tests are RED in 2026-10-07T13-56-16Z-unit-4d79 (8 PASS, 2 FAIL): retail and Folio actions generate a fresh UUID on each call rather than forwarding a form intent key. No repair implemented yet. Browser lost-response test first stopped on a test locator ambiguity (13-53-33Z); locator now scopes the exact retail submit button. The next run (13-55-08Z) failed before tests because port 55824 was occupied by a different tree, wetop-mv9-acceptance-20261007, running Food UI. Ownership verified from process cwd and command; foreign process was not stopped. Browser duplicate reproduction remains NOT VERIFIED.

## C13 browser RED/GREEN

Real guarded browser RED 2026-10-07T13-59-09Z-e2e-af9e: response dropped after the actual committed retail sale; repeating the same form created a third DB sale instead of the expected two. Minimal action retry identity and controlled fields added without schema or calculation changes. Intermediate 14-01-21Z failed the strengthened field-retention assertion because native form reset still cleared the select; reset cancellation added. GREEN 2026-10-07T14-02-26Z-e2e-626e: input remains, retry preserves two sales, then another deliberate submission after confirmed success creates the third separate sale. Unit identity RED 2/10, then GREEN 10/10 (14-00-35Z). Full BAR regression now running. Direct API changed-payload and Folio browser retry remain unverified.

## Full expanded BAR regression

Recorded 2026-10-07T14-03-29Z-e2e-7729: 13/13 PASS after the form retry repair. Real guarded API, PostgreSQL 17, mobile populated reload, foreign IDs, four controlled operational races, stock/debt integer reconciliation and lost-response retail retry all passed. This is not full C01-C16 policy acceptance: remaining catalog/draft coverage, Folio browser retry, direct changed-payload replay and unapproved policy variants stay open. Full CI exact final SHA remains pending.

## C13 changed-payload replay RED/GREEN

Real API RED 2026-10-07T14-09-31Z-e2e-cd6b returned HTTP 201 with the original sale for the same key and quantity 13 rather than 12. Repository now compares existing stored line product/quantity, retail cash method and Folio destination before replay, returning 409 on mismatch. No new fields/migration or monetary calculation. Target GREEN 2026-10-07T14-10-13Z-e2e-57e9: 3/3, including browser loss/retry/new sale and REVERSED replay. Variants for product/method/destination are now included in the full rerun. Simultaneous same-key and Folio browser replay remain unverified.

## Dedicated fixture ports and current BAR regression

Foreign full API stand occupied 55824 twice, causing startup failure before tests (14-24-55Z-e2e-e42b). Its process was not stopped. Configurable validated loopback ports added only to test infrastructure: RED 2/2 (14-26-48Z-unit-8fc8), GREEN 2/2 (14-30-54Z-unit-9922). Defaults remain unchanged. Current BAR 16/16 PASS (14-31-12Z-e2e-8fff) on own 56080..56082 and PostgreSQL 17/55934, including held uncertain intent, edited payload conflict, retry of original payload and a deliberate next order after acknowledgement. No schema, financial formula or production changes. Master rerun is pending; current stand cleanup is still pending.

## Current master and same-intent concurrency

Current full master 24/24 PASS (14-31-39Z-e2e-2792), including the actual timeout and initial protected-page API outage. Both afterAll QA cleanup calls passed. This does not replace final stand destruction.

C13 controlled identical concurrent requests reproduced 201/500 (14-33-58Z-e2e-565d). Transaction intent lock added before replay in both sale paths, no schema or money calculation change. GREEN 1/1 (14-35-00Z-e2e-045a): both HTTP 201, same persisted ID, one sale and one movement. Full expanded BAR rerun now includes Folio browser loss/retry and write-off audit author/reason; outcome pending.

## Expanded BAR current GREEN and CI coverage

18/18 PASS (14-36-33Z-e2e-6aa6), including Folio browser lost-response retry/reload with one charge and one sale, write-off author/organization/reason/cost, and controlled same-intent replay. The previous 17/18 run (14-36-01Z-e2e-66fe) failed only because a new test assumed a different success label; the test now asserts the existing exact label, application message unchanged. No accepted financial policy inferred from these results.

Release-checks now adds guarded BAR acceptance after the general database E2E step, so synthetic BAR fixtures cannot affect the earlier baseline suite. Existing gates and PostgreSQL 16 CI service remain unchanged; local operational verification is PostgreSQL 17. CI presence/order regression RED 1/23 (14-37-07Z-unit-4c95), GREEN 23/23 (14-37-32Z-unit-840e). This is pipeline configuration evidence, not a completed GitHub CI run.

## Compact calendar and unsaved receipt

Current compact-screen 3/3 PASS (14-38-08Z-e2e-7658): eight rows, no document scroll, bottom gap <=32px, collapse and density persistence. Current C02 unsaved receipt departure 1/1 PASS (14-42-20Z-e2e-a0c2): preview 300 KZT, leaving and reopening resets unsaved form, report and receipt/lot/movement/cash counts unchanged. Initial C02 check (14-39-11Z-e2e-6749) lacked a completed hotel fixture and was redirected by the existing onboarding gate; fixed by completing the real hotel wizard, not bypassing the gate. Lint found one new regex-spacing style error in the CI test, corrected with {2}; no disabled rule. Full unit rerun in progress, current stand still exists.

## Full unit regression

Recorded 14-43-02Z-unit-2c2f: 3828 PASS, 4 inherited skips, 408 files (407 PASS, 1 inherited skip). Two workers reduce local contention; no assertion, timeout or skip weakened. This includes current replay locking, uncertain form intent and CI ordering tests. Subsequent additions to C15 browser coverage and comment wording must be tracked separately; this result is not the final remote CI of a committed candidate.

## Receipt link validation and unresolved combined outage

Full BAR 14-51-38Z-e2e-813c: 19 PASS / 1 FAIL of 20, NOT accepted as full GREEN. C15 supplier and line product validation returns 404 with unchanged receipts/lines/reports in both tenants. C02 failed during hotel setup after an unplanned API 503, before reaching the receipt scenario. Isolated C02 had passed previously; current combined failure remains under investigation. During diagnosis API unauthenticated /auth/me returned 401 in 0.103s, fixture health returned {}, PG had no blocked app connections. This does not establish the origin of the earlier 503. A loopback-only proxy trace is being collected without headers, bodies or credentials; repeat selection in progress.

The mobile hydration diagnostic contains only Playwright-added caret-color inline attributes. Screenshot now uses caret initial, and the test additionally asserts no page errors or console errors. Application markup and runtime error logging are unchanged. This is stronger error detection, not an ignored warning.

## Repeated browser diagnostic

Recorded 14-59-27Z-e2e-a176: 7 PASS / 2 FAIL of 9. Both failures expected the lost-response alert while the Folio form still showed its pending button. All three mobile error checks and all three unsaved receipt checks passed. Safe proxy evidence and both pending-state snapshots are preserved in diagnostics. This does not establish the original C02 503 cause. The test now waits for the real Next server-action response and completion before asserting the same alert and database invariants; no timeout, skip or result requirement changed. Three Folio repetitions are running.

## Completed server-action boundary regression

15-10-55Z-e2e-ad2b: three Folio lost-response browser repetitions PASS. Each retains the selected fields, reads exactly one committed charge, retries without a second charge and reloads with one sale. Real action response completion is asserted before checking the alert; no default assertion timeout changed. Current full BAR and static checks are running.

## Current full BAR result and static checks

15-13-00Z-e2e-95e6: 19 PASS / 1 FAIL of 20. Retail lost-response scenario did not reach sale: register/setup returned an unexpected API 503, and the category field was absent. C02 unsaved receipt, Folio lost-response and both C15 matrices passed. Proxy trace has no upstream or 5xx records, so the fetch error origin remains unestablished. All current lint/root/web/API typechecks exited 0. No final CI or release readiness claimed.

## Retail and unsaved receipt repeated diagnostic

15-22-47Z-e2e-f9f6: 6/6 PASS, three retail lost-response/retry sequences and three unsaved receipt departures. Each retail test logged UND_ERR_SOCKET at the intentional dropped-response stage; this does not explain the previous setup 503. Optional preload now restricts route logging to a fixed allowlist, and the proxy records intentional drop completion separately. No headers, bodies, credentials or raw URLs logged. Current complete BAR rerun pending.

## Complete BAR GREEN and actual stand cleanup

15-26-02Z-e2e-f905: 20/20 PASS on synthetic PostgreSQL 17 and guarded API. Proxy evidence confirms exactly two intentional response drops, both after HTTP 201, one retail and one Folio; no proxy upstream failures in this run. Previous unexpected setup 503 remains unexplained and is not erased by this GREEN. Optional diagnostic preload required explicit Node imports to satisfy ESLint; targeted lint recheck follows.

Actual cleanup completed 2026-10-07 15:29 UTC: own PostgreSQL stopped, ports 55934/56080/56081/56082 have no listeners, exact owned temporary PG data and binary directories removed after uid/path/version checks. cleanup.json records the result. No production or foreign process touched. Historical tracked screenshots and generated Next declarations restored; current evidence retained under this report.

Still pending: approved website/A4b decision, financial/role BAR decisions, exhaustive foreign cash/charge/Folio HTTP matrix, intermittent setup 503 origin, exact final candidate review/commit and full CI. No merge/release/deploy authorization implied.

## Continuation preflight and first correlated run

Owner continuation plan recorded in plans/unified-acceptance-continuation-2026-10-07.md. Same owned tree, HEAD fd465e42, base94a2ae334. PR279 open at 1eb5dab35d36bfd67ee183d0a2843deee761de80; accurate stored-status replay already preserved. Additional refunds/paid/closed Folio rules are excluded after owner confirmed separate presentation in this chat.

GitHub refs read-only: release afe78398bd873e4e93f0aa5262416d447252ce93, main89f4e5f726eff42d18e3d1a2f107dbb7b450ce6e. Actual SSH187.77.145.152:22 timed out. Runtime/migrations UNKNOWN, GitHub ref is not runtime evidence. No production actions.

15-55-11Z-e2e-0c9a: 20PASS2FAIL/22. Access fixture requested100years but API permits366days, status400 as designed; change to actual10day window. Mobile error assertion caught diagnostic console.error forwarded by Next into browser; change diagnostic output to process.stderr.write rather than filtering browser errors. All previous20 scenarios otherwise ran; original setup503 not reproduced. Correlated proxy/API evidence preserved. New current role/refunds/settings/read-only matrix PASS on real SessionGuard.

## 16:13 combined continuation run

Recorded `2026-10-07T16-13-23Z-e2e-bb48`: 24/24 assertions passed, including real SessionGuard access tests and two AS-IS financial repeat-risk observations. Correlation contains 797 API start/response pairs, no API 5xx, and four deliberate post-commit response drops: retail, Folio, supplier payment and write-off. Next caught UND_ERR_SOCKET only for the deliberately dropped browser sale responses. This result does not explain the two historical unexpected setup 503 failures. Their cause remains unresolved. Static final check is in progress; full final-SHA CI, cleanup and release readiness are not yet confirmed.

## Final static and unit check

Lint passed. Type checks initially rejected the optional correlation socket field; changed its explicit type to `string | undefined`, then root/API/web type checks passed. Full unit run `16-19-49Z-unit-7621`: 39 failures, 3789 passed, four inherited skips. Failures include script execution timeouts and the RateWindows runtime assertion 795ms against unchanged <400ms requirement. Local load was 9.81/14.13/14.35 with a separate foreign unit process running; this is environmental evidence, not proof that all failures are environmental. No timeout or assertion was relaxed. The failed run is retained; exact-SHA full CI remains mandatory.

## Transport regression and complete master GREEN

Deterministic peer-close regression RED: 17-10-41Z-unit-0fbd, stale pooled socket returns ECONNRESET. Test-only proxy response headers now strip upstream keep-alive and set Connection: close. No application retry, authentication or timeout change. GREEN 17-11-20Z-unit-f2cb: 65/65, including CI and production-env contracts. Original complete master run 17-11-56Z-e2e-3711: 24/24, U01-U12 plus all fault/session/role recovery variants. U09 previously failed at reopening (16-23-18Z-e2e-617a) and now passes. The two older uncorrelated setup 503 failures remain unattributed, not deleted.

Second complete local unit run 16-30-59Z-unit-8089: 3811 passed, 10 timed failures, four inherited skips, two worker startup errors; two files were not executed. No complete unit pass claimed. Default full Linux CI is still required; local timings, failures and incomplete coverage remain recorded.

Read-only SSH retried against 187.77.145.152 with strict host checking: connection timeout. Actual production SHA and migrations remain unknown. No writes or release action.

## Complete BAR after transport fix

17-14-22Z-e2e-b8a0: 24/24 assertions pass. Full real SessionGuard access/roles, concurrency, sales lost-response retries, receipt link ownership and AS-IS supplier payment/write-off risk observations retained. Runtime 27.8s. No broader financial acceptance inferred.
