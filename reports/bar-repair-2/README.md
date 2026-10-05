# BAR-REPAIR-2: trigger repaired, ownership acceptance blocked

Date: 2026-10-05. Status: STOP, security hole confirmed. Not ready to merge.
Base SHA: `abe59d83693655f87c51059a8e1915196d35d07f`.
Branch: `codex/bar-repair-2`. Isolated clone: `/tmp/wetop-bar-repair-2`.
Database: dedicated local PostgreSQL 16 cluster, port 55432, database wetop_bar,
schema pms_test. All BAR test data is synthetic and rolled back. No shared dev DB,
production, release or external API was touched. MV6 was not started.

## Migration and root cause

Fresh main includes migrations 51 (BAR inventory), 53 (pinned path), 54 (FORCE RLS).
No additional BAR change was found in the fresh base. Canonical next free migration:
`20261005000055_bar_property_guard_dispatch`. Historical migrations remain unchanged.

`NEW` is a RECORD whose row type depends on the trigger's table. An expression that
combines TG_TABLE_NAME and NEW fields from distinct row types is not a safe field-access
contract: PostgreSQL resolves the expression's record fields before the intended table-specific
validation can complete. The old function attempts supplier_id on a product and category_id
on a receipt. Explicit IF / ELSIF dispatch separates the expressions by row type.
Migration 55 retains the function OID/identity and existing trigger names, rejects unknown
tables, and guarantees search_path with a separate owning-schema ALTER FUNCTION.

## RED before GREEN evidence

Permanent test: `tests/integration/bar-property-guard.test.ts`.

- Initial run c825 failed partly because of test SQL parameter casts; it is NOT defect evidence.
- Corrected RED d763 ran before migration 55: 9 failed / 3 passed, including own product
  `record "new" has no field "supplier_id"` and own receipt
  `record "new" has no field "category_id"`.
- GREEN 1de9: trigger tests 12/12; existing function-search-path 2/2.
- Category null is accepted; own category/supplier accepted; foreign/missing references
  and property updates rejected; null supplier rejected; unknown table fails closed.
- Exact pinned path in pms_test: `pms_test, public, pg_temp`.

Evidence is recorded with unchanged per-run code fingerprints in tests/runs/journal.jsonl
and corresponding sanitized logs in tests/runs/logs.

## Populated RLS matrix

Run 96a2: two independent Organization -> Business -> Location -> Property chains,
one synthetic row per side in every BAR table. Each cell is the exact count of rows
[A, B], selected by their fixture IDs. Existing rls-isolation: 6/6 PASS.

| Table | app A | app B | app unset | app empty | service |
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

50 populated role/table checks PASS. FORCE RLS is enabled on all 10 tables;
wetop_service has BYPASSRLS and is not superuser; wetop_app has neither bypass nor superuser.
The unset scenario leaves the custom setting unset or at its empty reset value.
Fixture SELECTs prove identity as well as counts, not just catalog presence.

## Write boundary and security impact

Direct SQL as wetop_app + organization A:

| Scenario | Actual result |
|---|---|
| INSERT Product into Property B | DENY: RLS |
| INSERT Supplier into Property B | DENY: RLS |
| INSERT Receipt into Property B | DENY: supplier invoker guard cannot see B |
| INSERT Sale into Property B | DENY: RLS |
| UPDATE receipt line A.product to B | ALLOWED, one row updated |
| UPDATE stock lot A.product to B | ALLOWED, one row updated |
| UPDATE stock lot A.receipt_line to unused line B | ALLOWED, one row updated |
| UPDATE stock movement A.product to B | ALLOWED, one row updated |
| UPDATE stock movement A.lot to B | ALLOWED, one row updated |
| UPDATE sale line A.product to B | ALLOWED, one row updated |
| INSERT line for receipt A with product B | ALLOWED, one row inserted |
| UPDATE supplier payment A.receipt to B | DENY: RLS |
| UPDATE supplier payment A.cash to already-linked cash B | DENY: uniqueness, ownership NOT proven |

Run 96a2: populated test file 16 PASS / 8 FAIL. Seven failures confirm unauthorized
cross-property writes; one cash-reference test is inconclusive because the fixture's B
cash operation is already used. It must use a fresh unused cash operation before a fix.
No assertion was weakened or skipped to make this run green.

RLS gates a row by its property or parent receipt/sale. It does not currently validate
all referenced rows. Ordinary foreign keys prove existence, not ownership; referential
integrity checks can resolve rows hidden from a tenant. FORCE RLS does not close this gap.

Service/API review, without claiming a live HTTP reproduction:

- BarService.createReceipt validates shapes and UUIDs only (bar.service.ts:156-174).
- PrismaBarRepository.createReceipt accepts caller product IDs directly in nested lines
  without property lookup (bar.repository.ts:299-321). This path does not protect receipt/product ownership.
- postReceipt trusts saved lines and creates lots/movements from those product IDs
  (bar.repository.ts:323-337), so it can propagate corrupt ownership.
- Normal retail/folio sale and stock write-off paths first query products and lots by
  property; supplier payments create a cash operation in the receipt's selected property.
  Those API paths reduce exposure but do not replace DB protection from direct SQL.

## Minimal DB fix proposal, not implemented

Add forward DB guards without changing entities, pricing, FIFO, quantities or status semantics:

1. Receipt lines: receipt.property == product.property on INSERT and relation UPDATE.
2. Stock lots: property == product.property == receipt_line.receipt.property, and
   lot.product == receipt_line.product.
3. Stock movements: property == product.property, and for non-null lot,
   lot.property == property and lot.product == product.
4. Sale lines: sale.property == product.property.
5. Supplier payments: receipt.property == cash_operation.property. Reproduce with an unused
   cash row first. Existing receipt RLS denial remains required.
6. Cover parent property changes that could invalidate existing children; choose an
   explicit reject policy for attached parents rather than silently permitting inconsistent chains.

Before implementation, record the existing ownership invariants and proposed validation in
DATA_MODEL.md and obtain approval. Every guard needs RED -> GREEN INSERT/UPDATE tests under
app and service roles, schema-specific pinned search_path, history-preserving migration/down,
and repeat populated visibility. No security-definer bypass is proposed.

## Rollback semantics

Operational application rollback: retain migration 55 and the repaired guard; function signature
and triggers are backward compatible. No BAR data or model changed.

Schema/function down: down.sql restores the exact pre-55 body while retaining the pinned path.
It reintroduces the known insert defect. It is for disposable local snapshot rehearsal only,
NOT a safe or recommended production rollback. A production function regression should use an
approved forward correction retaining valid dispatch. Production was not migrated.

## Other completed checks

- Root/API/web typecheck: PASS (09d9).
- Repository lint: PASS (154f).
- Existing domain/API BAR unit tests: 15/15 PASS (2ec3).
- Existing BAR web actions: 8/8 PASS (8769), existing BAR total 23/23.
- git diff --check: PASS.

## Remaining merge gates

Ownership acceptance is RED, so merge is prohibited. Full unit/integration, check-migrations,
schema drift and all down rehearsals remain pending after the required ownership decision.
This report is an impact STOP, not completion evidence. No deployment is authorized by this task.
