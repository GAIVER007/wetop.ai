# BAR-REPAIR-2: dispatch and BAR guards implemented; reverse-parent acceptance STOP

Date: 2026-10-05. PR #245 remains DRAFT. DO NOT MERGE.
Base SHA: `abe59d83693655f87c51059a8e1915196d35d07f`.
Branch: `codex/bar-repair-2`. Current head is recorded in the PR description.
Only an isolated clone and a dedicated localhost PostgreSQL 16 cluster were used.
Original dirty checkout, shared dev database, production and release untouched. MV6 not started.

## Implemented scope

Migration 55: `20261005000055_bar_property_guard_dispatch`, unchanged from b8bbe140.
Migration 56: `20261005000056_bar_ownership_guards`, next canonical free number checked
against freshly fetched main before creation. Migrations 51/53/54 remain unchanged.

Root cause: NEW is a RECORD whose shape depends on the trigger table. Combining
TG_TABLE_NAME and fields from distinct row types in one SQL expression does not safely
guard field resolution. Product INSERT attempts supplier_id; receipt INSERT attempts category_id.
Explicit IF / ELSIF dispatch isolates row-field expressions. Unknown tables fail closed.

Owner-approved DATA_MODEL/DECISIONS invariants implemented by 56:

- Property is immutable after INSERT for categories, products, suppliers, receipts,
  lots, movements and sales. Assignment of the same property remains valid.
- Receipt lines: receipt.property = product.property, INSERT and both relation UPDATEs.
- Lots: property = product.property = receipt_line.receipt.property; product = receipt_line.product.
- Movements: property = product.property; optional lot must match both property and product.
- Sale lines: sale.property = product.property, including both relation UPDATEs.
- Supplier payments: receipt.property = cash_operation.property; unused cash fixtures prevent
  uniqueness from masking ownership rejection.
- Sales: optional folio, cash operation and charge through folio belong to sale.property;
  when both charge and folio are given, charge.folio_id = sale.folio_id.
- Receipt-line and lot product edits reject invalidation of existing BAR lot/movement children.

Three new functions are SECURITY INVOKER, never SECURITY DEFINER. Every BAR guard has exact
`pms_test, public, pg_temp` path in the test schema; public installation uses `public, pg_temp`.
Catalog test explicitly verifies all three new function identities, prosecdef=false and paths.
FOR SHARE reference locks serialize child validation with parent relation edits.
Migration preflight requires administrative visibility (superuser or BYPASSRLS), checks all
existing property/link equalities and aborts on legacy corruption instead of repairing financial data.

## RED -> GREEN evidence

All evidence is in tests/runs/journal.jsonl and sanitized per-run logs. Code fingerprints
were stable during recorded runs. No new skips, weakened rejection assertions or increased timeouts.

| Evidence | Run | Result |
|---|---|---|
| Dispatch RED before 55 | d763 | 9 FAIL / 3 PASS; missing supplier_id/category_id reproduced |
| Dispatch + existing search-path GREEN | 1de9 | 14/14 PASS |
| Initial child ownership probe | 96a2 | 7 confirmed bypasses; cash fixture uniqueness was inconclusive |
| Corrected cash + expanded ownership RED before 56 | 8956 | 92 FAIL / 36 PASS across app/service and INSERT/UPDATE |
| Focused guards + populated RLS + search-path + RLS regression | c2f6 | 148/148 PASS |
| Final full integration before adding reverse-parent regression | 39f0 | 487 PASS, 11 existing skips, zero FAIL |
| Final full unit | be8d | 3367 PASS, 4 existing skips, zero FAIL |
| Root/API/web typecheck and lint | 0849 / 3117 | PASS including the new reverse-parent test |
| Full migration chain, Prisma drift, 62 individual down rehearsals | migration-rehearsal.txt | RESULT: OK |
| New external-parent regression | 2f6f | 10 FAIL / 2 PASS, confirmed remaining hole |

Full integration 39f0 contains dispatch 12/12, expanded ownership 105/105,
populated RLS/ownership 24/24, function-search-path 2/2 and rls-isolation 6/6.
Existing BAR unit/API/web tests are included in the full unit run (23/23).
The latest source now includes a permanent RED external-parent test, so the current
full integration merge gate is NOT GREEN despite the preceding passing full run.

Invalid diagnostic runs are retained transparently: c825 had a SQL cast fixture error;
3777 had an incorrect accommodation enum. Neither is claimed as RED defect evidence.
Initial full-suite failures came from SQL_ASCII/Asia-Dubai database defaults, shell locale
and excessive parallel worker load. The replacement isolated cluster is UTF8, en_US.UTF-8,
UTC; unit uses portable LC_ALL=C and maxWorkers=2, with all original timeouts unchanged.
Initial 021f rejection-message mismatches were corrected to exact new guard messages,
not weakened to generic error acceptance. Existing unit/integration skips predate this PR;
all new BAR tests run without skips.

## Exact populated visibility matrix

Each cell is the actual count [A, B] selected by fixture IDs. For every table a fresh session
proves current_setting('app.org_id',true) IS NULL before testing absence. Empty is separate.
Identity assertions accompany counts; fixture transactions roll back.

| Table | app A | app B | absent | empty | service |
|---|---|---|---|---|---|
| bar_categories | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_products | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_receipt_lines | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_receipts | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_sale_lines | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_sales | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_stock_lots | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_stock_movements | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_supplier_payments | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_suppliers | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |

50/50 populated role/table checks PASS. All ten tables FORCE RLS; service BYPASSRLS;
app is neither superuser nor BYPASSRLS. Direct app A INSERT of Product/Supplier/Receipt/Sale
into property B is DENY (receipt may be denied first by its invoker supplier guard).
All seven previously confirmed child bypasses and unused foreign cash now DENY.
104 behavioral ownership tests cover both app/service roles, both INSERT/UPDATE relation
fields, same-property product identity mismatches, nullable movement lot, valid linked-sale
INSERTs and UPDATEs, same-property category/supplier edits and property no-op assignments.

## Remaining concrete security hole: mutation of external parents

An existing BAR row is not updated when its referenced cash/hospitality row changes.
The BAR trigger therefore does not fire. Permanent regression:
`tests/integration/bar-external-parent-ownership.test.ts` (2f6f).

| Parent mutation breaking an existing valid BAR link | app | service |
|---|---|---|
| CashOperation.property for supplier payment, to another visible Property | ALLOWED | ALLOWED |
| CashOperation.property for sale, to another visible Property | ALLOWED | ALLOWED |
| Charge.folio to a different own Folio (sale has an explicit Folio) | ALLOWED | ALLOWED |
| Folio.reservation_item to unused foreign item | DENY by RLS | ALLOWED |
| ReservationItem.reservation to foreign reservation | DENY by RLS | ALLOWED |
| Reservation.property to another visible Property | ALLOWED | ALLOWED |

All allowed cases report UPDATE rowCount=1. New tests require denial and remain RED.
RLS does not solve service writes and does not distinguish properties within the same org.

Minimal next proposal, pending scope approval: reverse invoker guards on
cash_operations.property_id, charges.folio_id, folios.reservation_item_id,
reservation_items.reservation_id and reservations.property_id. Reject only a mutation
that invalidates an existing BAR link; permit unrelated cash/hospitality rows and valid
same-property relinks. No blanket cash/hospitality immutability, prices, booking rules,
FIFO or financial arithmetic changes. This preserves the already-approved BAR invariants
while touching external tables expressly excluded from the original repair scope.

Service/API protection review: receipt creation validates input shapes and accepts caller
product IDs without property lookup; DB 56 now denies those invalid links. Normal sale,
stock and supplier payment paths select/create their rows in the chosen property.
No BAR API exposes these external-parent relinks; direct SQL under service remains possible,
which is why this is a merge blocker rather than a theoretical warning.

source_type/source_id audit item: existing movement/reversal lookups include property scope;
no concrete cross-property source lookup exploit was reproduced. No polymorphic source
ownership model added. Beauty, MV5, Food Service, Hospitality application code and cashbox
semantics remain unchanged. External parent guard implementation is paused for scope approval.

## Rollback and release

Application rollback must retain 55/56: signatures and existing BAR triggers stay compatible.
Technical down 55 restores the known broken body (path stays pinned). Technical down 56 removes
new guards and reopens ownership holes. Both downs are disposable exact-schema rehearsals,
NOT recommended operational production rollback. Production must use an approved forward
correction retaining working guards, with backup and validation. No production apply occurred.
All 62 down snapshots passed, including 55 and 56. See migration-rehearsal.txt.

Do not remove draft or merge until reverse-parent decision, RED -> GREEN repair and renewed
full checks. Fresh main, mergeability and absence of new BAR changes must be rechecked then.
