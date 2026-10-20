# Narrow mobile finance SPEC review

Verdict: PASS

Required issues: None within the reviewed scope.

## Scope and method

Independent read-only review of the current source diff for the finance month-form wrap fix and its persistent browser regression. Repository: `/srv/hermes/workspace/wetop-portal-release-61af7b90`. No source, git state, database, environment, authentication state, or production resources were modified or inspected beyond the scoped source and read-only git diff operations. No tests were run by this reviewer. This report is the only file written.

## Findings

- `apps/web/src/components/employee-portal/portal.css:102` adds `flex-wrap: wrap` to the existing `.portal-finance-period` flex container. This directly addresses the month field and submit button competing for one line on narrow screens, while preserving alignment, gap, markup order, and native form semantics. The surrounding `.portal-finance-top` already wraps. There is no overflow-hiding workaround or removal of a control.
- `apps/web/src/components/employee-portal/cabinet.tsx:72-79` confirms the class belongs to the existing GET month form containing the labelled month input and the submit button. The fix does not change month selection, finance values, schema, server calculation, or business rules.
- `tests/employee-portal-ui/portal.spec.mjs:163-175` extends the existing personal-finance scenario for both `BEAUTY` and `FOOD_SERVICE`. After submitting September 2026, it retains assertions for the returned month and selected pay tab, then checks document scroll width at 320px and 390px and confirms both controls remain visible.
- The diff preserves the existing server-amount, unavailable-earnings, paid-value, and absence-of-pay-editing assertions. Existing theme screenshots are retained. Read-only counting confirms 10 top-level test scenarios in both HEAD and the working file.
- `narrow-finance-red.log:20-36` records the same new document-width assertion failing at 320px with an actual width of 341px. This is concrete pre-fix regression evidence, not merely an inferred ability to catch the defect.

## Boundaries of approval

The full working-tree CSS diff also contains earlier spacing-token substitutions. Those are explicitly outside this incremental review and are not attributed to the wrap fix. Previously reviewed RLS/token changes and unrelated generated/documentation changes are not reapproved here.

The persistent addition covers staffA in two verticals after month navigation. It does not itself establish the full role, theme, keyboard, or accessibility acceptance matrix. Visibility assertions alone are not a general clipping or keyboard audit; combined with document-width measurement and the observed RED failure, they are adequate for this narrowly specified overflow regression. Broader acceptance remains the parent's separate responsibility.

No fresh GREEN, final6 gate completion, integration outcome, deployment readiness, or remote candidate is asserted by this source-only review. The reported GitHub workflow-scope push blocker remains outside this change and unresolved by this review. PASS means the narrow implementation and persistent regression satisfy the supplied SPEC, not permission to deploy.
