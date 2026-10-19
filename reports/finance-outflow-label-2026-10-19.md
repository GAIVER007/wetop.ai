# FIN-01: distinguish refunds from expenses in the finance UI

## Scope and invariants

The combined daily outflow already includes completed refunds and completed cash expenses. The expense KPI intentionally excludes refunds. Labelling both as expenses was misleading; the expense KPI sparkline also incorrectly used the combined outflow.

This slice:
- Labels the chart outflow **«Возвраты и расходы»** and inflow **«Поступления»**; makes the heading explicit.
- Adds a UI-only `cashExpense` daily bucket for the expense KPI sparkline. The existing combined bucket, income, displayed KPI values, result formula and API contract are unchanged.
- Keeps completed-status, transfer-exclusion and local-date filtering intact. The new bucket uses BigInt, not floating-point financial arithmetic.
- Does not change the database, API, payment/refund guards, expense categories or the formula of the result KPI.

## Real RED before implementation

Commit: `ffe74bdb2842fd3fdd42d2f40dcc810e71f84306` (test and focused CI only).

GitHub-hosted run: https://github.com/GAIVER007/wetop.ai/actions/runs/39203059169

Three regressions failed with real assertions, not imports/setup errors:
1. Combined outflow lacks the explicit refund-inclusive label.
2. A refund-only period draws an expenses sparkline despite a zero expense KPI.
3. Completed cash expenses have no separate presentation bucket.

Real journal: `tests/runs/entries/2026-10-19T05-10-02Z-unit-f1aa.json`, corresponding log alongside it.

The fixtures are synthetic and contain no guest PII. A positive guard additionally preserves a genuine cash-expense sparkline. A source-component test renders the actual components. The existing browser suite additionally checks the chart legend and its combined amount.

## Verification status

Focused GREEN: **4/4 passed**, GitHub-hosted run https://github.com/GAIVER007/wetop.ai/actions/runs/39203429120 on implementation commit `a7389018edd46cb2b50f23e339175a2914e6439a`. Real journal: `tests/runs/entries/2026-10-19T05-14-26Z-unit-97f1.json` and its log.

Independent review, full exact-head release-checks and browser verification of the changed build remain pending. Do not infer any of them from the focused GREEN run or from an earlier production browser walkthrough. The base main `2a8f7aab9c8405e03999c005d99b61ffbe8efacf` itself has a failed full gate: https://github.com/GAIVER007/wetop.ai/actions/runs/39156107469. Inherited failures must be investigated without lowering guards.

All build/test workloads run on GitHub-hosted runners; no test database or browser server is started on the production host by this slice. The dedicated workflow is a bounded no-DB regression runner with read-only permissions, pinned actions and no deployment steps. It does not replace the required release-checks gate.

## Separate unresolved concerns

The chart aggregates the returned row window whereas KPIs use complete summaries; truncation over 500 rows requires a separate scoped design/test. The result KPI's «Чистая прибыль» label has a separate metric-definition concern. Neither is silently changed here.

No production migration or manual release-pointer change is part of this fix. Private production reports/screenshots stay outside the public repository.
