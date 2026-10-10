# A29: UI harness repair map

Date: 2026-10-08

Scope: only the A28 failures caused by an unsettled Next.js streaming segment or a stale test expectation. Product CSS, Food assignment, and chessboard drag-and-drop behavior are outside this slice.

## Evidence and repair

| A28 failure | Evidence | Repair in this slice |
| --- | --- | --- |
| `mobile-adaptation`: `/channels` returned `padding-bottom NaN` | The prior implementation measured a page that could detach while the streamed loading segment was being replaced. `tests/ui/fixtures.ts` already defines the repository's bounded `settleStreaming` contract for this condition. | `tests/ui/mobile-adaptation.spec.ts` now uses the shared UI fixture. The assertion requires exactly one visible `.page`, reads its computed padding once, and keeps the original `padding >= bottom navigation height` and overflow thresholds. |
| `branches-ui`: seven strict-mode failures found two `food-today` nodes, one hidden | `FoodToday` is rendered once in product source. The second node matches the hidden streamed segment documented by `tests/ui/fixtures.ts`. The branches suites previously imported raw Playwright and did not settle initial loads, reloads, or branch-selection navigation. | `tests/branches-ui/branches.spec.ts` and `tests/branches-ui/today.spec.ts` call the existing `settleStreaming` helper after those navigation boundaries. Strict locators remain unchanged. |
| `channex-screens`: click on revision stayed on the events list | The shared fixture settles `goto` and `reload`, but its own documentation says link-click navigation must call `settleStreaming` explicitly. | `tests/ui/channex-screens.spec.ts` settles immediately after clicking `ui-rev-new-2`, then keeps the exact destination URL assertion. |
| `search-filter-recovery`: category action could not find the destination combobox | The spec already imported `settleStreaming` and used it for other link transitions, but omitted it for the action-menu link to availability. | The category action now settles that link transition before checking the exact `Категория` combobox and `MALE` value. |
| `chessboard-unassigned`: expected lowercase cancellation label | Ported base `8665b95e` already uses `hospitalityStatus.CANCELLED.label`, matching the canonical status registry. | No additional edit required in this slice. |

## Preserved contracts

- No `first`, `nth`, `force`, retry, arbitrary timeout, snapshot update, or threshold relaxation was added.
- The temporary `expect.poll` and `.first()` workaround in the ported mobile test was removed.
- `settleStreaming` remains bounded by the existing repository helper and does not hide a segment that remains duplicated after its grace period.
- URL, accessible-name, uniqueness, padding, overflow, and business-value assertions remain active.

## Validation status

No Next.js server or browser suite was started because another agent owns the runtime. Fresh validation is still required, sequentially:

1. Run the targeted mobile adaptation case.
2. Run both branches UI specs against their isolated API configuration.
3. Run the targeted Channex revision-navigation case.
4. Run the targeted availability category-action case.
5. Include the existing general E2E cancellation case when that suite owns the runtime.

The stop condition is one fresh pass for every targeted case with no hidden duplicate and no change to snapshots or acceptance thresholds.
