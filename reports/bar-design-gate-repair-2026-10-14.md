# Bar UI gate repair, 14.10.2026

Only tests/ui/design-polish.spec.ts changes. Product design, API and financial rules remain unchanged.

CI run38688346866, job116270213755 reproduced four failures: geometry included borders in the expected content width, and form entry expected an obsolete link instead of the current board-header button.

The test now derives content width from clientWidth minus computed padding, checks full-width body within one CSS pixel, retains hint separation, and adds label/value overflow checks. It opens the existing product button and retains field visibility, cancellation and document-overflow assertions. No timeout or CI threshold changed.

Validation:
- UI four scenarios passed: 2026-10-15T06-34-40Z-e2e-4f78 (1333/390, light/dark).
- Root/API/web types passed: 2026-10-15T06-35-48Z-typecheck-d55b.
- Lint passed: 2026-10-15T06-36-17Z-lint-6990.
- Review: existing user actions and assertions retained; content geometry corrects border accounting; no new dependencies or product behavior.

Exact-SHA release gate and production deployment still pending.
