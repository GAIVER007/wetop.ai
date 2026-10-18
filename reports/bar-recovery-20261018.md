# BAR: retail recovery and branch-local journal timestamps

## Product scope
- Recover the original retail intent key and exact fields after reload for the same organization/business/location/user/property/currency; session freshness is checked separately before commands.
- Persist before sending; no automatic command on mount. Prevent same-tick duplicate sends. Unknown results and storage faults retain the original operation and block an unsafe new sale.
- Complete only a positively confirmed intent through explicit new-sale action; scoped completion bookkeeping prevents rediscovery of the completed legacy key. It is client storage, not authoritative backend reconciliation.
- Show original recovery fields when current stock/method options are unavailable; do not bypass enabled-method or financial rules.
- Use existing workspaceTimezone and propertyClock for sale/movement timestamps. Received calendar dates and API pagination are unchanged.
- Reuse existing API command shape and permissions. No schema, migration, finance/repository/service changes, no external production operations.

## Current product-tree checks
Base: 228ecdf7fa8ca5e94fd048cdd4e7ca2435a8dd77.

- Native Vitest unit project across the complete BAR folder: **61 passed / 6 files**, zero failed/skipped. The narrower four-file first pass was 54 passed.
- Web semantic typecheck: `tsc -p apps/web/tsconfig.json --noEmit --incremental false`: exit0.
- ESLint on all changed/new TypeScript files: exit0.
- Strict helper types with exactOptionalPropertyTypes and noUncheckedIndexedAccess: exit0.
- Static added-line scan and git diff whitespace checks: pass.

The first root-wide typecheck exceeded its deliberately bounded 768MB Node heap and did not complete. This is NOT a root/API/full-app PASS. No repeated local heavy run was started; the full exact-head GitHub gate remains mandatory. API/DB/browser end-to-end and builds remain unverified for this product candidate until that gate completes.

## Earlier artifact evidence, not current-head full acceptance
The underlying isolated recovery artifact had 67 harness/VM tests and 12 actual mounted React component scenarios with a synthetic action; timezone artifact had 18 actual-renderer synthetic cases. RED and mutation evidence are retained privately in the integration control directory. These are historical component evidence, not server/API/DB or deployed-site proof for the final commit. Product-native tests above ran on the actual current files after integration/type/copy adjustments.

## Remaining gates
Independent diff review; exact-head full GitHub release-checks; real auth/API/isolated DB replay coverage; resulting-main gate; scoped migration/cutover checks for the accumulated release; deployed image/build SHA and authenticated site acceptance. Draft PR/commit/CI launch are not publication.

The authoritative read-only reconciliation endpoint is not implemented. Explicit exact-key retry is a mutation and can execute a sale if the original did not execute; the UI must not represent it as a read-only check. No inference from last-100 lists and no instruction to clear storage.
