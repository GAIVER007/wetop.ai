# Remaining merged-main gate failures, 2026-10-18

## Why this follow-up changed

Owner merged PR662. Main gate39114494638 failed at types from PR664. The initial two-type repair in PR665 passed local root/API/web,55focused checks but its full candidate39114942580 reached unit failures already present in combined main. Meanwhile author merged PR666:5fac3be738da175a0f85dc7ea05047f8d1e4dd32, independently fixing the same type issue.

Current branch merges that main. Two conflict hunks in Money and ReportRow were classified superseded: preserve main's required `values: Record<string,string> | undefined` and all explicit undefined callers. The resolved entire file is byte-identical to5fac3be738, checked programmatically. Original repair/RED evidence remains in published history. No competing type choice is pushed over the author's implementation. No new tree or foreign edits.

## Reproduced remaining failures

`2026-10-18T09-27-18Z-unit-3e6e`:45tests,41pass/4fail.

- route-access matrix: actual existing `POST /beauty/customers` is `desk` but EXPECTED lacks it. Source BeautyController and createCustomer/`mayBeautyWrite(...,'desk')` inspected. No production access decorator/service changed.
- quick-report CSS introduces undefined `--space-3`/`--text-base`.
- Tooltip shadow uses deprecated `--shadow`, not canonical floating shadow.
- Tooltip layer uses literal1 instead of project's named layer token.

## Minimal repair

- Add exactly the existing protected customer route with desk to the exhaustive expected matrix. Do not weaken exact equality or ignore unknown routes.
- Replace all report references to undefined space3 with the existing16px space4 scale token, text-base with existing15px text-md. No new design token definitions or invented12px scale value.
- Tooltip uses existing layer-overlay and shadow-floating as documented in DESIGN.md and other existing tooltip styles. No new sections, colors, layout redesign or monetary code.
- Do not modify tests/unit/design-slop.baseline.json, allowlists, design guard logic or build-tokens tests.

## Verification

- `2026-10-18T09-28-29Z-unit-ca16`:45/45 GREEN, same four files as RED, including exact route matrix, global no-new-design-debt guard, all token reference validation and report financial semantics.
- `2026-10-18T09-28-36Z-typecheck-9c55`:root/API/web GREEN, preserving exact main type solution.
- `2026-10-18T09-29-50Z-unit-a50c`: full merged-source unit **5831passed,7skipped,0failed**,639files, no path/name filter, maxWorkers2; source unchanged during execution.
- `2026-10-18T09-30-38Z-lint-50fd`: full ESLint PASS.
- Exact updated candidate GitHub gate and visual UI gate still required. No current live screenshot/update claimed.

## Remaining release gates

PR665 stays DRAFT until updated exact-SHA release-checks. Owner controls merge under AGENTS18. Resulting-main gate, automatic release and production source/health/read-only period acceptance remain separate. Main includes separate customer-phone migration20261018000131; this task does not authorize or execute it, or bypass a refused deploy. Previously production healthy, releasefb0e786e, no image source SHA label. Never equate clone marker or source subset check with full image proof.
