# Additional populated BAR RLS verification, 2026-10-05

Current main: a795eee04b2ce9980f99aff92621d4882dd09f89. BAR-FIX #244 merged b07a1822; MV5 #242 merged a795eee0 after documented full green regression. No merges were repeated or reverted.

The later supplied specification additionally requires populated rows in all ten BAR tables under wetop_app (own, foreign, absent app.org_id) and wetop_service. Existing RLS invariant coverage did not seed those BAR rows. There is no dedicated BAR integration file on current main; BAR controller/domain unit tests passed within the full unit suite, but they do not prove database trigger execution.

## Reproduction

Run `node reports/bar-rls-probe-2026-10-05/probe.cjs` only against the isolated localhost PostgreSQL on port 55753, schema pms_test. The script uses synthetic data in a transaction, always rolled back. It is a diagnostic artifact, not an application change.

On unchanged main, inserting bar_categories succeeds. Inserting bar_products fails:

```text
record "new" has no field "supplier_id"
ROLLBACK complete
```

The shared bar_property_guard() body contains an expression referencing NEW.supplier_id for bar_receipts, but is also invoked for bar_products, whose row has no supplier_id field. Combining TG_TABLE_NAME and the field access in one AND expression does not prevent the observed record-field resolution failure. The inverse category_id reference for receipt rows also needs verification during a separate repair.

## Impact and boundary

The populated-row visibility matrix cannot proceed: seeding fails before role checks. Therefore the 40 planned role/table assertions are NOT PASS. This is a separate pre-existing trigger-body defect in migration 51, beyond the authorized search_path/registry-only repair. Original full green results remain valid for their actual coverage, but are not evidence of working BAR product writes.

No source migration, function body, policy, BAR business logic, production or release was changed. No synthetic rows persisted. Proposed separate repair: a new forward migration that branches by TG_TABLE_NAME before evaluating table-specific fields, preserving ownership rules; matching rollback and database tests for both product and receipt triggers, then all populated RLS role checks. This proposal was not implemented. MV6 remains unstarted.
