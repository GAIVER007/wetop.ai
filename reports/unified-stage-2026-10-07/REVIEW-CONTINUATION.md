# Candidate review, 2026-10-07

Base: 94a2ae33416ece62d2bd18d8f3ef1896ed209702. Owned branch: codex/unified-acceptance-20261007. Local implementation review is complete. Final commit and complete CI remain pending.

## PR 279

Reviewed OPEN head 1eb5dab35d36bfd67ee183d0a2843deee761de80. Candidate preserves stored POSTED/REVERSED replay status and name-only nested product serialization. It does not introduce the new refunds gate or paid/closed Folio cancellation rule. The owner explicitly requested separating these policies.

## Correctness and isolation

BAR sale intent locking is transaction-local and keyed by property and request identity. Changed payload returns conflict. Lost-response browser retry retains identity; acknowledged deliberate new order receives a new identity. No money formula, schema or existing permission is changed. Supplier/product ownership checks occur before receipt draft insertion. Populated SQL and real SessionGuard tests are separate evidence.

Read-only checks, foreign mutation/link denial and snapshots of both synthetic organizations passed in the final local 24-test combined run. Invalid foreign finance scope falls back to own organization under the existing contract. This is not approval of A4b selection behavior.

## Test strength

No skipped tests, weakened financial assertions or automatic recovery retries were added. Corrected access expectations distinguish a summary from a transaction list. Existing Turnstile race test now waits for the actual expired-token response and reset before solving the next challenge. Historical failed runs remain preserved. Two AS-IS tests deliberately establish duplicate supplier payment/write-off risk; they are not safety acceptance.

## Diagnostics

QA fetch correlation is opt-in and records safe route classes, status, elapsed time and error codes. It does not record headers, bodies, session credentials or raw errors. The temporary backend diagnostic was removed after the unchanged production environment contract rejected the extra variable. Diagnostics remain in test infrastructure only. U09 reproduced front-to-proxy ECONNRESET before HTTP dispatch. The deterministic peer-close test and test-only response-header fix address idle socket reuse. The original full master now passes 24/24. Earlier uncorrelated failures remain unattributed. Full local units remain red/incomplete; no whole-candidate approval is claimed before exact-SHA CI.

## Scope and release

No new migration, release movement, main merge, production write or external event was performed. The latest GitHub release reference is not treated as runtime proof. SSH read-only inspection timed out, so actual production SHA and migration history remain unknown. BAR and Website policies are separate proposals in POLICY-PROPOSALS.md. Release readiness is not established.

## Final local verification

Transport RED 17-10-41Z-unit-0fbd; targeted GREEN 17-11-20Z-unit-f2cb, 65/65. Complete master 17-11-56Z-e2e-3711, 24/24. Complete BAR 17-14-22Z-e2e-b8a0, 24/24. Root/API/web types passed after final source changes. New diagnostic/transport files pass ESLint; earlier complete ESLint passed. Both red/incomplete complete local unit runs are retained, so full candidate correctness still depends on complete exact-SHA CI.

Owned recreated PostgreSQL 17 stand stopped and directories removed at 17:15:45Z. Four owned ports have no listeners; no foreign processes or production data touched. cleanup.json records actual completed cleanup, not a plan. No new migration or production/release write.
