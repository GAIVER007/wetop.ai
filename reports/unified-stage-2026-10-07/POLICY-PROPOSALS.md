# Separate owner decisions, no implementation approval implied

## BAR

| Decision | Proposed behavior | Consequence |
| --- | --- | --- |
| Supplier payment repeat | Persist one client intent ID and normalized payload per property. Same payload replays saved payment; changed payload returns 409. Retain intent through failed response, reload and restart. | New persistent model/unique key and migration required. Current remaining-debt lock prevents overpayment but cannot distinguish retry from a second small payment. |
| Stock write-off repeat | Same durable intent mechanism. One FIFO write-off and audit for one intent; changed product/quantity/reason returns 409. | New persistence/migration required. Current stock lock prevents negative stock, not a duplicate write-off with enough remaining stock. |
| Supplier payment void | Keep original payment/cash/audit rows; exclude voided cash from paid supplier total and restore the unpaid debt. Lock receipt and related payment in consistent order. | Changes report/accounting policy; historical voided payments need read-only reconciliation before any repair. No historical rows deleted. |
| Reverse without restock | Preserve original FIFO stock removal and expose its cost as a distinct loss. Do not silently erase COGS or count it twice as ordinary write-off. | Requires approved metric/formula and durable reversal classification. Proposed restock flag/backfill must be reviewed separately. |
| Reversal permissions | OWNER/MANAGER require refunds; STAFF may sell but not reverse. READ_ONLY reads only. | Tightens current BAR desk reversal permission. PR279 includes this change, excluded from this candidate until explicit decision. |
| Paid/closed Folio | Conservatively reject BAR reverse if account closed or any completed positive payment allocation exists. Partial payment counts as paid. Refund/reopen is a separate workflow. | Protects closed/paid accounts but restricts current behavior. PR279 includes this guard, excluded here pending explicit agreement. |
| Positive inventory adjustment | Require approved costing rule; suggested average current cost, explicit manual cost when no stock. | Existing Q-BAR-9 remains open. Do not create inventory surplus or invent its cost. |

These are proposals, not accepted contracts. A green test for existing behavior does not approve them.

## Website and A4b

Proposed website configuration contract: HOSPITALITY only, OWNER/MANAGER through existing settings permission, explicit selected active branch. STAFF and other verticals denied; READ_ONLY may read permitted configuration but cannot mutate. Do not choose the first hotel when scope is missing. Organization/business summaries should use explicit aggregate contracts rather than a branch fallback.

A4b proposal: ensure active Business and Location at every selection boundary, preserve current explicit-scope authorization, remove indefinite process cache for mutable organization/business selection. A request-local lookup cache can avoid repeated DB work within one request without retaining an archived selection between requests. Alternative is generation-based invalidation on every archive/update, which creates more mutation coupling and missed-invalidation risk.

Consequences: an archived branch becomes unavailable immediately; configuration requires branch selection; more DB lookups compared with indefinite cache. Benchmark repeated dashboard queries and archive/reselect isolation after agreement. Service integrationPropertyId behavior must be assessed separately and is not changed by this proposal.

Required before implementation: owner confirms roles, active-state behavior, scope and cache strategy; record decision/model implications and tests. No website/A4b code changed in this candidate.
