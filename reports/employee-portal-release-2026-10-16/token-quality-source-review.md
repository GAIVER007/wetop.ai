# Independent source quality review: compact portal spacing tokens

## Verdict: APPROVED

Required issues: none for this narrow CSS correction. This verdict is based on independent reading of actual source and the Git diff, not solely the prior quality or SPEC reports. It replaces the incomplete source-review coverage of token-quality-review.md. It is not whole-release approval or production authorization.

## Scope and method

Repository inspected read-only: `/srv/hermes/workspace/wetop-portal-release-61af7b90`.

Independently inspected:
- The actual `portal.css` diff and complete stylesheet, including the surrounding cascade and responsive rules.
- `design/tokens.json` canonical spacing definitions and `apps/web/src/app/tokens.css` generated spacing declarations.
- `scripts/design/build-tokens.test.ts`, specifically the undefined-variable guard and spacing-scale assertions.
- `tests/employee-portal-ui/portal.spec.mjs`, specifically compact layout, split-day persistence, and finance assertions.
- Supplied execution evidence `token-green.log` and `token-browser.log`.

Read the prior SPEC report as secondary context, not as a substitute for source inspection. No source edits, test execution, mutation testing, database access, Git mutations, or inspection of environment/authentication/secret state occurred. The only file written is this external report.

## Source findings

### Correctness and design-token compliance

A read-only programmatic comparison of HEAD source with current source returned `Exact substitution only: True`: the complete CSS delta is eight `var(--space-3)` occurrences replaced by `var(--space-2)` across seven rules. Zero `var(--space-3)` references remain in this stylesheet. The finance-notice rule accounts for two replacements.

Affected current lines in `apps/web/src/components/employee-portal/portal.css`:
- 75: heading block padding.
- 96: schedule add-button inline padding.
- 104: finance KPI gap.
- 109: finance-notice padding and block margin.
- 116: disclosure block padding.
- 130: mobile portal-section padding.
- 137: mobile finance-card padding.

The canonical semantic spacing token `dimension.space.2` references `dimension.primitive.space.2`, whose dimension is explicitly 8 px. Generated web CSS defines `--space-2: 8px` at lines 89 and 287. Canonical `dimension.space.3` does not exist; its exclusion is documented at `design/tokens.json:2622`. No new design token, hardcoded substitute, or fallback was introduced.

An undefined custom property does not establish a previously rendered 12 px value. This is a valid-token repair, not evidence of pixel-identical output or a measured 12-to-8 px visual reduction.

### Cascade, readability, and architecture

The correction preserves selectors, cascade placement, breakpoints, grid definitions, text sizing, focus styling, and visibility rules. The desktop add button still has minimum width and height of 44 px (line 95); its mobile override retains 44 px width and zero padding (line 134). Disclosure minimum height remains 44 px (line 116). The more-specific service-picker summary padding at line 100 is not displaced by the changed generic summary rule. Mobile section and KPI-card overrides retain their existing scope.

The delta reuses the established spacing vocabulary, introduces no abstraction or duplication, and does not grow the stylesheet. No security-sensitive behavior, dependency, data flow, or runtime computation is added. No business or schema logic changes are part of this CSS delta. Unrelated working-tree changes observed in `apps/web/next-env.d.ts` and `packages/database/src/rls.ts` are excluded from this verdict.

### Regression protection is substantive and unchanged

`build-tokens.test.ts:58-121` enumerates tracked web CSS/TSX, collects custom-property uses, and requires the missing-variable list to equal `[]`. There is no exemption for `--space-3`. Lines 141-149 enforce the existing approved spacing scale and token naming. A diff against HEAD for this test, canonical tokens, generated web tokens, and `portal.spec.mjs` returned no changes. No tests or token definitions were weakened to accommodate the fix.

The inspected compact browser assertions are behavioral rather than screenshot-only:
- `portal.spec.mjs:102-111` checks persisted edited hours and preservation of existing dated exceptions.
- Lines 114-142 check schedule save-button geometry, visibility of all seven day groups, and no horizontal overflow at 1440x900 and 1366x768 in light and dark themes; other compact panels must also fit desktop height.
- Lines 145-152 check add-action proximity and persisted split-day intervals.
- Lines 163-171 check actual server finance amounts, unavailable-earnings handling, and period selection.

## Execution evidence and limits

- `token-green.log:11-20` records 15 passing token tests, including the inspected guard suite. This is supplied execution evidence; this reviewer did not rerun it.
- `token-browser.log:15-42` records 22 passing browser tests, including the compact cases above. The log also contains a middleware deprecation warning, not a test failure or a regression introduced by this CSS delta.
- No post-fix mobile axe claim is made. The inspected capture helper covers 390 px only when `PORTAL_CAPTURE=1`; the provided browser log does not establish that flag, and the inspected portal suite has no axe assertion.
- No screenshots were independently inspected. Source review and supplied desktop geometry results do not prove comprehensive mobile accessibility or pixel identity.
- Final parent checks, full-unit/build/type/lint verification, and any broader release gates remain separate. Mutation testing was intentionally not performed because source changes and test execution are forbidden in this review.

**APPROVED: no required source-quality issues found in the narrow spacing-token correction.**
