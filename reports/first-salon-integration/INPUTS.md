# First salon integration: frozen inputs

- Base: `3a56ef7e2e3fe0544a80d3f08e98ec7b099672c6` (chosen once; PR631 adds delivered onboarding-real, its minimum11/zero-skip CI contract, O07c router-close fix).
- Prior orientation: `660a388868c7f0f37ba3edfbca1dea56c2ca5e1d`. No automatic rebase onto later main.
- Branch: `integrate/first-salon-20261017`. No merge, main/release pushes, force-push, deployment, flags or production migrations authorized.
- Creation controller refused55/10 trees. Owner separately approved reusing an existing completed clean worktree, with old history/evidence preserved. Reused `wetop-supplier-retry-release`, main-clone worktree, prior PR609 MERGED, clean Git, no visible hermes cwd/fd/maps references before reuse. Prior branch `fix/supplier-payment-retry-20261017` and its `86ae9b2315a2b75be4b613bdc327e7d4174d188d` were not changed/deleted.

| Accepted source | Transferred commit |
|---|---|
|5a2ddb63a38ca834838a836c4a675dd952455cfc|54c2bd0ea121e4fefa9e7bcd94e889c460620210|
|127fc730488678426457359dc7dc02f75d27005b|11f4fabf5697979a6af1d4885fa9308282c9a070|
|d2f435b502a17aa66d3e28027d54c6dc185fc3f0|ec417e70b640bec11baa8ab2be108d4dd5a619b1|

Each commit retains `cherry picked from` provenance. No later calendar redesign or revoked7d7d1c49 is requested/transferred. Calendar source branch, commits and dirty work are not edited.

## Conflict decisions
- `DECISIONS.md`, first commit, append-vs-append/disjoint intent: retained all main/TZ21 decisions and appended accepted F01 decision.
- `QUESTIONS.md`, third commit, append-vs-append/disjoint intent: retained main auth questions and appended the existing F03 search-privacy question.
- Other calendar files merged automatically; focused semantic preservation review of PR626/630 required before qualification. No whole-file ours/theirs resolution.

## Explicit limits
Search after reload and browser-history restoration are NOT declared fixed. Search remains memory-only; policy question remains open. No new PII persistence.

## Delivered blocker fixes integrated once

The baseline stays3a56ef7e; completed PR632/633/634 were subsequently delivered in published main15a3a06e907f18851e71fd16691bff5522b58466. They address the same reproduced release blockers (original-version integration fixtures, application-role CI URL, O07c card-address race, onboarding resume visible-route assertion) plus an existing Hospitality currency-loading block with its regression, NOT Homepage V4. Integrated this exact published snapshot once in f6213fa85, not an ongoing rebase. No later main automatically imported. Three conflicts were resolved per hunk: retain our original-GET archive token and safe diagnostics, retain explicit missing-token negative check, retain equivalent newer-card router synchronization while also taking the delivered native-history state fix/guarded close. Original regression assertions remain.

## Owner-approved PR638 scope extension

After discovering separately merged PR638 in main, the owner explicitly chose: «Включить PR №638 в общий выпуск: явно расширить состав и проверить изменённые график, цены и права вместе с календарём». The existing candidate/PR637 is reused, not duplicated. Import published snapshot700f4d60e57c88e547261228cc9901630fc86706, containing PR636 test coherence, PR638 week grid/currency-unit prices/region lists/SELF schedule read-only, and completed PR639 viewport-test isolation. No production merge or deployment is authorized by this scope extension. Fixed historical base3a56 remains documented; later main commits are NOT followed automatically.

Preserved: accepted calendar3 picks, PR626/630 guards/CAS, original profile/schedule source versions, profile stale negative test, O03/O07c/onboarding-real. Approved semantic changes: SELF schedule/absence writes403, manager target writes remain; absence editor removed but stored data/manager API/calendar denial kept; weekly grid edits recurring weekdays, not a new date-specific data model. No migrations or held SQL introduced.

Four source issues reproduced before fixes: portal seed still used forbidden SELF write403; O01 filled the now-hidden minor-unit transport field; read-only grid offered an editable hours dialog; legacy TimeOff browser case still targeted intentionally removed controls. Minimal fixes use manager endpoint+original DTO week token, labelled visible currency input, canEdit-gated name/editor, and a negative-hidden-controls + existing manager API fixture while retaining booking denial/timezone assertions. Bounded grid regression exercises real PostgreSQL default-hours persistence and repeated stale writes without token replacement. Three merge conflicts were reconciled independently: retain both question appendices, structurally complete typed employee fixture/navigation invariants, recomputed portal declarations10 plus explicit stale-regression presence. Reconciliation details and RED/GREEN logs are external evidence, not full-gate certificates.

Old run39038617243 checks immutable90903 **without638** and must not be cancelled or credited to this expanded candidate. The expanded final SHA requires its own complete release-checks.

## Final targeted gate blocker: synthetic guest cleanup transport

Old90903 release-checks completed FAILED solely in main-UI shard5's G6 afterEach POST control cleanup (all G6 business assertions passed; other executing suites succeeded and the aggregate reflected this shard failure). The retained trace puts cleanup about5997ms after the request context's previous response, at Node24's6000ms idle-socket expiry boundary. Evidence supports a keep-alive expiry/reuse race, not a guest-creation defect; socket-level timing remains an inference rather than packet capture. The exact old artifact digest was verified against GitHub. No full-gate retry was used as diagnosis.

A deterministic loopback-only test executes the actual G6 cleanup hook and models an expired pooled socket. RED3 reproduced socket hangup, silently accepted HTTP503, and missing isolated-context disposal. Minimal fix: cleanup gets a fresh short-lived Playwright request context, explicitly checks successful HTTP response, and always disposes it. No retries, timeout extensions, skipped guest cases or changed G6 business assertions. Network tests GREEN3 and original G6 browser scenario passed with the same45-second budget, using the existing tree directly (external config, no project copy). This test-only fix leaves approved app/calendar/CAS source unchanged; its new exact SHA still requires the full mandatory gate.

On0c87fa4fc the combined new-grid2, portal22, CAS/rights41 and onboarding-real11 all passed with zero skips/flaky/source changes. The full earlier Beauty target had38/40 pass before the real controlled-switch defect; moving its immediate state update outside the deferred action then passed the two new grid cases. These local stages are not substituted for a new exact-head global gate.

## Verification state
This is a manifest of inputs, not a PASS certificate. Compatibility changes and results must be reported separately, on final exact SHA. Source code will be frozen during final verification. `onboarding-real` delivered CI wiring is actually in the chosen base (PR631); O07 is not automatically closed merely because O07c code/test is present.
