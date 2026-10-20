# Marketing expense linkage — bounded backend contract

Approved basis: DATA_MODEL §49; unified-owner-accounting §3 and §10.1.5.

- Existing MarketingBudgetRepository create/import remain budget-only. No automatic cash payment or speculative historical classification.
- POST /expenses accepts optional marketingExpenseId (UUID), mutually exclusive with supplierReceiptId at DB constraint. Exact persisted source amount, currency and location required. Same intent replays; new intent for already-bound source conflicts via UNIQUE.
- POST /expenses/:id/settlements links only existing HOTEL_CASH or RESTAURANT_CASH. No new debit. Existing supplier receipt/payment validation remains unchanged.
- Held114 invoker-rights hooks synchronize unpaid source edits into the document; direct unpaid document amount edits synchronize the source atomically. FX/reporting-currency ambiguity is a conflict, never a conversion. Linked scope moves and document currency rewrites fail closed.
- Any settlement ever freezes financial fields on both ends, even after source VOIDED. Source deletion is RESTRICT; settlement persists. Audit MARKETING_DOCUMENT_SYNC records document before/after with organization ownership.
- Unlinked marketing records are payment-unlinked budget entries, not paid expenses. Budget countedInBudget is not cash status. Canonical expense summary continues using only canonical cash; category attribution does not add a second amount.

## Evidence / scope
Real isolated PostgreSQL only, fixed 127.0.0.1:55516/wetop_owner_home, pms_test. RED c43c: new real legacy repository test observed missing source binding. GREEN final 7663 (after supplier intent hash compatibility fix): 12/12 expense tests including legacy create/edit, unpaid bidirectional sync, existing cash retry, MARKETING classification, unchanged cash total, independent budget, FX/source mismatch, foreign tenant runtime role, void history. Regression db88: 9/9 owner-money including fresh held114 clone application and hotel currency/supplier runtime path. API unit ce21: 11/11.

Typecheck de54: root/API exhausted the mandated 512 MB heap; web completed. This is not a passing typecheck or code diagnostic.

Full release NOT READY. No broad UI, new-payment flow, FX conversion, payroll or production migration included. No shared database, reset, deployment, commit or push. Local existing schema received only replacement guard plus additive marketing triggers, not a full migration replay. Rollback remains compatible writer/read flag rollback; retain financial links/history. Held114 stays unreleased.
