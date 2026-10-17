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

## Verification state
This is a manifest of inputs, not a PASS certificate. Compatibility changes and results must be reported separately, on final exact SHA. Source code will be frozen during final verification. `onboarding-real` delivered CI wiring is actually in the chosen base (PR631); O07 is not automatically closed merely because O07c code/test is present.
