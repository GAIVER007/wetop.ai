# BAR acceptance matrix, interim 07.10.2026

This matrix describes observed assertions, not acceptance of unapproved financial policy. All data is synthetic. Evidence: recorded full AppModule/SessionGuard/PostgreSQL 17 run 2026-10-07T14-36-33Z-e2e-6aa6 (18/18), plus the individual RED/GREEN records in PROGRESS.md. Values below are KZT; persisted API values use integer minor units.

| Scenario | Expected | Actual evidence | Status and remaining criteria |
|---|---|---|---|
| C01 | Catalog and archive history | Two synthetic products, supplier and category created via guarded API | PASS for barcode, package units, markup, unused archive and retained history |
| C02 | Draft no stock/debt/cash | Draft report stock cost 0 | PASS for draft and unsaved-departure invariants: current combined 15-13-00Z and three repeats 15-22-47Z. Separate intermittent setup 503 remains open |
| C03 | Purchases 2800, stock cost/debt 2800 | Real receipt posting and report agree | PASS for posted numeric cycle and repeated posting 409 in 13-47-51Z |
| C04 | Paid 600, debt 2200 | Guarded supplier payment and report agree | PARTIAL, full repayment to zero and overpayment rejection verified in 13-47-51Z; cancelled payment policy remains; duplicate supplier payment after lost response is RISK CONFIRMED |
| C05 | Revenue 3840, FIFO cost 1320, stock cost 1480 | Persisted sale and read API agree; net cash 3240 in C06 prerequisite | PASS for numeric cycle; not every per-step audit assertion is covered |
| C06 | Charge 960, FIFO 480, stock cost 1000; cash unchanged | Real open synthetic Folio SERVICE charge and report; cash rows unchanged | PASS for tested open Folio cycle |
| C07 | Write-off 160, stock cost 840 | Real write-off and report; cash unchanged | PARTIAL: amount, author, organization and reason pass; lost-response duplicate write-off is RISK CONFIRMED |
| C08 | Shortage 160, stock cost 680; repeat no new movement | Persisted units -1, unit cost 160, fixture user; repeat movement count unchanged | PASS for tested shortage cycle |
| C09 | REVERSED/VOIDED, stock cost 2800 | DB status/cash and report confirmed | PASS for restock numeric cycle: original 10+2 lot split and repeated 409 verified in 13-47-51Z; no-restock policy remains C10 |
| C10 | No restock; cost policy approved separately | Not executed yet | NOT RUN, owner cost-treatment decision required for acceptance |
| C11 | Invalid quantity/overpay no effects; zero actual allowed | -1/0 rejected 400, shortage/overpay 409; unchanged reports; inventory actual 0 persisted | PASS for tested invalid quantities, excess payment, zero actual and foreign related IDs; not every possible invalid payload is covered |
| C12 | Closed/paid Folio contract | Not executed yet | NOT RUN, owner decision required for dependent changes |
| C13 | Replay after reversal returns stored REVERSED without effects | Real replay returns REVERSED; counts and cash/report unchanged | PARTIAL: retail and Folio lost-response UI retry, edited payload 409, deliberate next retail order, stored REVERSED and identical concurrency passed. Reload retained the Folio charge. Retry identity across browser reload/new window is not verified |
| C14 | Approved role matrix | READ_ONLY reads sales, new sale rejected 403 with unchanged report | PARTIAL: existing OWNER/MANAGER/STAFF and READ_ONLY matrix tested through real SessionGuard; new reversal policy pending |
| C15 | Cross-tenant guards and RLS | 370/370 populated RLS and ownership/concurrency SQL tests passed on PostgreSQL 17 (13-49-54Z) | PASS for tested foreign product/receipt/sale/cash/charge/Folio reads, writes and related-ID substitutions in both directions, plus populated SQL ownership/concurrency. This is not certification of all production security |
| C16 | No stock/debt/posting/reversal race effects | Real row-lock barrier observed two waiting sale requests; statuses 201/409, one sale, stock 0 | PASS for controlled last-unit, debt payment, receipt posting, restock reversal and same-intent replay races |

Numeric reconciliation: 2800 = sales COGS 1800 + write-off 160 + shortage 160 + remaining stock 680. Revenue 4800, sales margin 3000 before write-off/shortage. Supplier paid 600, debt 2200. Folio charge is not cash income.

Mobile browser: populated BAR stock and sales visible, reload retained data, screenshot `bar/mobile-populated.png`. This establishes data readback, not completeness of all BAR controls.

Production/runtime acceptance and release approval are not included in these local results.

## Continuation findings, 07.10.2026

The recorded 16-09-24Z run passed 23 of 24 tests. The failing assertion expected an operation ID in a cash summary which exposes categories and balances, not operations. The assertion is corrected to require the own category ID and name; the foreign-data and unchanged-ledger assertions remain mandatory. This is a fixture expectation correction, not an application bug fix.

- C04/C13 supplier payment: a response dropped after commit leaves one payment; resubmission creates a second payment and reduces debt again. RISK CONFIRMED. The remaining-debt lock prevents overpayment but does not provide request idempotency.
- C07/C13 write-off: a response dropped after commit leaves one stock movement; resubmission creates a second movement and consumes stock again. RISK CONFIRMED. FIFO locking does not provide request idempotency.
- C14: existing OWNER/MANAGER/STAFF and READ_ONLY checks pass through actual SessionGuard. No new reversal permission policy has been implemented.
- C15: direct foreign cash/charge/Folio mutations and substituted related IDs are rejected with unchanged snapshots of both organizations. Final combined confirmation is pending.
- A4b: the legacy finance scope contract falls back to the actor's organization for a foreign scope selector. Isolation and explicit-selection policy are different criteria; the latter remains OPEN.
- Unexpected setup 503: fresh correlated runs have not reproduced it. The original failures remain recorded and the underlying cause is NOT ESTABLISHED. No retry, authentication weakening or timeout increase has been introduced to hide it.

PR #279 is preserved only for accurate replay status and safe product serialization. Its additional cancellation permissions and paid/closed Folio rules remain separate proposals as requested by the owner.

Final local combined run: `2026-10-07T16-13-23Z-e2e-bb48`, 24/24 passing test assertions on PostgreSQL 17. C15 foreign read/write/link checks pass in both directions; snapshots of both tenants remain unchanged. C14 existing role/read-only checks pass. The two AS-IS repeat-risk tests pass by proving duplicates are possible, not by proving idempotency. Unexpected setup 503 did not reproduce; its cause remains open. Safe correlation evidence: `diagnostics/continuation-161323-correlated.jsonl`.

Final post-transport BAR run: 17-14-22Z-e2e-b8a0, 24/24 assertions. The two risk-confirmation tests continue to demonstrate missing supplier payment/write-off idempotency. Stand cleanup completed; see cleanup.json.
