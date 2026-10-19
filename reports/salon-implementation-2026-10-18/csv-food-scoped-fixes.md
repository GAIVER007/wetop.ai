# Scoped implementation: CSV attribution and real Food fixture membership

Base: cd954b5f19d098e798c02d3837e98af952772692. Two separate atomic fixes, not full Beauty completion and not production deployment.

## CSV correction

appointmentsCsv now uses the existing salon-report local-start-day attribution in the branch timezone, then deduplicates appointment IDs. Prior-day calendar tails cannot create another full-money export row or suppress an eligible start-day row. Existing exact minor-unit formatting, currencies, all line names, formula escaping and customer privacy remain unchanged. No data model, money formula, API or permissions changed.

RED: 2026-10-18T21-35-30Z-unit-9049, four new regression failures, two old checks passed. GREEN: 2026-10-18T21-35-52Z-unit-78b1, 13/13 including seven existing salon-report tests. Final repeat: 2026-10-19T04-32-05Z-unit-d363,13/13. Independent scoped static review deleg_0c888f14 passed, no blocking security/logic findings; existing partial fixture double-cast was a nonblocking suggestion.

## Food fixture correction

The synthetic OWNER previously existed only in the HTTP actor, not the memberships table required by real Beauty mutation revalidation. Persist only this fixture's membership, restore it on reset and synchronize its real STAFF/OWNER role on control changes. Do not alter product authorization or assertions. Marker-guarded transactional cleanup deletes only owned organization children before their parents, including payments/cash, appointment lines, employee prices and the exact fixture membership.

Real HTTP RED: 2026-10-18T21-36-32Z-e2e-5d5f,2/2 failed with the same403 as CI. GREEN: 2026-10-18T21-38-29Z-e2e-52da,2/2 passed. Independent scoped static review deleg_2b2c7540 passed, no blocking security/logic findings. Full local Food suite was interrupted for server safety, is NOT green and is not substituted by the targeted run. Keep its preserved artifacts; use the full immutable GitHub gate for release acceptance.

## Fresh shared checks

2026-10-19T04-29-11Z-typecheck-97c1: root/API/web GREEN.
2026-10-19T04-31-08Z-lint-1707: full lint GREEN.
All passing records above must retain codeChangedDuringRun=false. No skip/timeouts/security guard relaxation or dependency changes.

CI39167344145 on the base completed failure; it is not the gate for these new commits. A new immutable candidate still needs its full gate. No merge, release branch move, production migration or deployment performed.
