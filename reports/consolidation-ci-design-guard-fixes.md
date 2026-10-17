# Consolidation CI design guard fixes

Base and unchanged HEAD: `7557ec64d77271cbdfbf081eae562ddc5a23fcd4`. Sole-writer uncommitted follow-up; parent must commit new SHA and run full CI.

## Early evidence

Reproduced bounded RED with `NODE_OPTIONS=--max-old-space-size=512 npx --no-install vitest run tests/unit/design-slop.test.ts tests/unit/employee-portal-web.test.ts --project unit --maxWorkers 1`: **2 failed files, 4 failed / 21 passed cases**. Log `/tmp/design-guard-red.log`. pnpm unavailable, used installed npx without installation.

Read frontend-ui-engineering/code-review-and-quality, DESIGN.md §4.1, checker and both suites. Approved minimal plan: split dot labels into structure, annotate only data-derived geometry, canonical mobile breakpoint, useful category label under subordinate catalog; preserve all business bytes. Graph callers/blast for JournalBoard, AppointmentForm, ServicesBoard returned not_built/not_found; manually traced pages, editor and rendering tests.

## Final verification

Command: `NODE_OPTIONS=--max-old-space-size=512 npx --no-install vitest run tests/unit/design-slop.test.ts tests/unit/employee-portal-web.test.ts tests/unit/tz12-presentation-port.test.ts --project unit --maxWorkers 1`.

**3 files passed, 31 tests passed, 0 failed**, 905ms. Original suites 25 cases; presentation compatibility 6. All four originally failing cases green. Log `/tmp/design-guard-green.log`.

Targeted ESLint on three changed TSX files and changed TS test: **exit 0**, no findings. `git diff --check`: clean. No baseline inflation, test skips, guard changes or business logic changes.

## Exact changes

- `apps/web/src/app/beauty/appointment-form.tsx`: selected date and time/timezone split into block spans inside existing polite live region; all values retained.
- `apps/web/src/app/beauty/journal.tsx`: filter count becomes real newline (preserved by scoped summary CSS); active filters become individual block spans. Exactly two documented same-line `slop-allow: inline-style` reasoned exceptions: appointment top/height from actual minutes, grid column count from selected masters. No new inline styles or fixed-style conversion.
- `apps/web/src/app/beauty/beauty.css`: scoped block-line utility and summary newline preservation. Former 360px layout becomes canonical max-width 600px: mobile date controls move Today to second row, and editor date/time become one column, retaining 44px controls. This is mobile layout, not a new special boundary.
- `apps/web/src/app/beauty/services/board.tsx`: catalog price and duration on separate lines, actual category/fallback has visible `Категория:` label beneath. Effective branch information stays before subordinate catalog. Employee portal test unchanged; no dummy comments or weakened assertions.
- `tests/unit/tz12-presentation-port.test.ts`: old exact dot-summary literal directly required forbidden formatting; replaced with stronger checks for polite live region plus both specific date/time block spans including timezone. Legends/footer/editor checks retained.

## Preservation: eight true with correct original baseline

Ran existing `/srv/hermes/workspace/workspace-cleanup-control/ci-investigation/release-followup/verify-ui-preservation.py` unchanged. It reports six true and two false against current HEAD because editor/Hours normalization assumes a pre-port HEAD; 7557 already contains those presentation changes. Direct current-HEAD byte comparisons confirm both appointment-editor.tsx and food/settings-board.tsx are entirely unchanged by this follow-up.

Re-executed identical script in memory changing only `git show HEAD:` to actual pre-port `9906987e1:` (no script file or assertion edited): **all eight true**. Existing script wrote evidence `/srv/hermes/workspace/workspace-cleanup-control/ci-investigation/release-followup/consolidation-ui-preservation.json`.

ServiceForm, form state/action/dirty prefix, duplicate-submit guard, occupancy, actions, editor navigation and Hours controls retain original protected bytes. This is a verification baseline correction, not a business-byte exception.

## SHA-256 of final changed source/test files

- `apps/web/src/app/beauty/appointment-form.tsx`: `4e383045066a0c1668eab0014c0bec3008a4a0ef314fe4ada97168e45d3fb7f1`
- `apps/web/src/app/beauty/beauty.css`: `c37561754626b449a752531d084cc0fa26beb7f220648e08979a4ebf60bdffa9`
- `apps/web/src/app/beauty/journal.tsx`: `9e914a57d5aaadfa28922292eae8d002558721c04e400655e65d377ee8e9e355`
- `apps/web/src/app/beauty/services/board.tsx`: `dd4a1c49f21cf4a246d0789664b002899b82bbd6ccc07dc0f4ae78e3c4367e34`
- `tests/unit/tz12-presentation-port.test.ts`: `e5783759aac8c4eb16bf456b7b5cfa6629aa385662bc154c92e90fbfaf151ebb`

Parent independently reviewed the five-file production/test diff and reran the complete bounded affected matrix: **130 tests /17 files PASS**, targeted four TS/TSX ESLint files PASS, diff-check PASS. Canonical output is in `workspace-cleanup-control/ci-investigation/release-followup/consolidation-parent-design-final-unit.log` (inside the approved workspace); the leaf temporary debug logs are not used as final evidence. Parent independently reran all eight preservation comparisons against the actual pre-port commit `9906987e1360e1f42e668daad73333d0c091e1d7`: **8 TRUE**, no assertion or script file changed.

Full exact new-head CI, browser/runtime rendering, publish and deployed checks remain **pending**. No full local typecheck/build/browser/DB/full-unit/GitHub/staging/commit/push was performed by the leaf. The preceding remote run did pass full lint and all root/API/web typechecks before these narrow presentation changes; that is not a substitute for a fresh full candidate gate.
