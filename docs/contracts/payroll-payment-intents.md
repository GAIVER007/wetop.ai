# Existing payroll writer: bounded implementation evidence

Approved basis: DATA_MODEL §49/49.4, unified-owner-accounting plan §10.1. No new payroll ledger, financial module, schema field, or expense-total definition.

`POST /food-service/employees/:id/payouts` delegates to existing `RestaurantService.payout`. With `EXPENSE_LINKS_ENABLED=1`, a printable 1–200-character `idempotencyKey` is required directly in that service, not merely at HTTP. The normalized hash includes action, employee, month, method, integer amount and scope currency. Shared `payment_write_intents` is persisted in the existing transaction. Location serialization precedes lookup/effects. Same payload returns the original operation ID and original remaining balance from its audit record, including after void; changed payload/action conflicts with 409. A concurrent identical request serializes and replays. No short TTL.

The existing canonical restaurant EXPENSE remains the only debit. In the same transaction it receives an ACTIVE document for the amount actually paid, explicit location-scoped PAYROLL / «Оплата труда» category, settlement pointing to that very operation, persistent intent and audit. The calculated monthly payroll obligation is not posted as a second expense. No historical payroll backfill or new cash operation for pre-existing payouts is performed. Feature-off bypasses the new table access and retains the original payout flow; this branch has not been separately tested in this bounded slice.

Actual PayoutDrawer creates one key per mounted payment drawer and sends it through mutateStaff and restaurantApi unchanged; server errors preserve the mounted key. Closing/reopening/remount persistence and real browser/network-error tests remain unproved. A changed amount with a previously committed key is intentionally a conflict, not a new payment.

## Evidence

- RED: `2026-10-16T10-23-21Z-integration-e3ee` failed because the original writer rejected the new key field (an earlier setup failure b962 was a missing synthetic pay-setting currency, not business RED).
- Initial GREEN `10-24-51Z-integration-91fc`: actual writer/calculation/SQL with substituted scope transaction wrapper.
- Stronger GREEN **1/1**, `tests/runs/logs/2026-10-16T10-28-50Z-integration-38d5.log`: no writer, scope or transaction spies; real withSignedInUser OWNER location context, food scope/permission/writable checks and foodTransaction, fixed synthetic payroll and income on hard-coded dedicated `127.0.0.1:55516/wetop_owner_home`, `pms_test`. Sequential/concurrent replay, changed payload 409, missing key 400, foreign-business employee 404, exactly two canonical debits for two intents, both linked PAYROLL documents, void retaining two settlement histories, immutable document amount after void, replay after void, and actual OwnerSummaryService report KZT1000 / category «Оплата труда» KZT1000 after one void were asserted.
- Gbrain callers returned not_built; blast not_found. Local references showed one controller caller and actual form/action/API chain.

## Remaining release blockers

This does not close the combined payroll/all-legacy-cash-writers release checkbox. Generic cash aliases and all other writers are not made intent-safe by this change. Cross-location payroll races, runtime-role/RLS write tests, held-package rehearsal, feature-off isolated test, rollback failure injection, form remount/retry browser evidence, lint and full root/API/web types remain unproved. The parent's full-type timeout is not a pass. No release-readiness claim, migration application, commit, push, merge or deployment is made.
