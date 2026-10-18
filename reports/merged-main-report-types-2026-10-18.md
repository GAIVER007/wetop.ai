# Merged main release blocker: quick report optional props

Owner asked to continue after merging PR662. Main merge e4b56fb51d1c8a734bdc5f5dc0cb2593e044bf48 includes PR664 and fails strict web TypeScript in quick-report-reference.tsx at lines38/144/155. Candidate555654610's16-job green gate predates that unrelated main change. Do not deploy a failed main or move release manually.

## Minimal repair

Two existing optional `values` prop declarations explicitly admit `undefined`, which their existing callers legitimately pass and their existing bodies already handle as missing data. No executable statements, financial behavior, design, strings, dependencies, permissions or schemas change. The full typechecker is the regression oracle: reproducible three-error RED, then complete GREEN. gbrain callers/blast requested for Money/ReportRow: index not built/not found. Local callers are confined to this component, inspected in full.

## Executed evidence

- RED: `2026-10-18T09-16-48Z-typecheck-81b5`, three TS2375 errors on untouched main.
- GREEN: `2026-10-18T09-18-39Z-typecheck-7a76`, root/API/web all pass.
- Unit: `2026-10-18T09-19-41Z-unit-722b`,55/55 across quick report plus owner/finance/restaurant continuity.
- Changed-file ESLint passes, `git diff --check` passes.
- Earlier full5766/7skip belongs to earlier finance source, not this updated main. Exact candidate CI still required. No full live acceptance or deployment claim.

## Release and preservation

Same existing authorized worktree, fast-forward to actual main with no discarded history. No foreign working files or processes changed. Root all-UID snapshot complete, no refs on this tree before update. Published original period fix retained.

Updated main also includes the separate customer-phone migration20261018000131 from PR661. This report does not approve or execute it. If production is missing it, deployment remains gated on owner-approved pinned backup/migration procedure. Do not bypass this gate to ship the type-only repair.
