# Narrow independent spacing-token SPEC review

## Verdict: PASS

No required SPEC implementation issues found in the spacing-token correction. The change restores compliance with the existing design scale and preserves the compact portal contract within the inspected source and available regression evidence. This is not full release approval or production authorization.

## Scope and method

- Read-only repository inspection: `/srv/hermes/workspace/wetop-portal-release-61af7b90`.
- Reviewed the working-tree diff against HEAD for `apps/web/src/components/employee-portal/portal.css`, canonical token definitions, `DESIGN.md`, the existing token guard, browser assertions, and supplied execution logs.
- The only file written by this reviewer is this external report. No source, tests, Git state, DB, environment, authentication material, or production systems were modified or accessed. No tests were rerun and no mutation test was performed because the task is expressly read-only.
- Other observed working-tree changes, including the separately reviewed RLS registry correction and generated next-env file, are outside this narrow verdict.

## Findings

### 1. Exact, valid-token-only correction

A programmatic comparison confirms that the current CSS is exactly HEAD with every `var(--space-3)` replaced by `var(--space-2)`, with no other content changes. There are **eight token occurrences across seven changed CSS rules**, rather than seven declarations: the finance notice rule contains both padding and margin-block replacements. Zero `var(--space-3)` occurrences remain in this stylesheet.

The affected rules cover heading padding, schedule add-button inline padding, finance KPI gap, finance notice padding/margins, disclosure padding, mobile section padding, and mobile KPI-card padding. Grid structure, responsive breakpoints, text, controls, minimum target sizes, visibility rules, selectors, and application behavior are unchanged.

`DESIGN.md:118-119` permits 4, 8, 16, 24, 32, 40, 48, and 64 px and calls for 8/16 px inside components. `design/tokens.json` explicitly excludes the old 12 px space-3 token. The existing generated `apps/web/src/app/tokens.css` defines `--space-2: 8px`. Reusing that token is compliant; adding a 12 px token or hardcoded workaround would not be. No canonical token, generated token, or regression-test diff exists against HEAD in the inspected paths.

An undefined custom property did not actually guarantee 12 px before this fix. Consequently this should be described as restoring valid compact spacing, not as a pixel-identical change or a proven 12-to-8 px reduction in previously rendered output.

### 2. Existing guard retained, with real RED and GREEN evidence

`scripts/design/build-tokens.test.ts:58-121` enumerates tracked CSS/TSX with `git ls-files`, collects variable uses, and requires the missing-variable set to be empty. Its spacing-scale assertion at lines 141-149 remains intact. There is no space-3 exception or weakened assertion.

The recorded full-unit run `tests/runs/logs/2026-10-16T20-29-46Z-unit-a1a8.log:720-721` contains a real failure in this guard: expected `['--space-3']` to equal `[]`. The file enumeration explains why an untracked stylesheet could previously escape this guard; that does not justify weakening it.

`/srv/hermes/workspace/wetop-portal-release-evidence-61af/token-green.log:11-20` records **15 passing token tests**, not 24. The correction addresses the actual failure without changing test coverage.

### 3. Compact acceptance remains covered and green

`token-browser.log:15-42` records **22 passing browser tests** after the correction. Relevant cases include persisted hours, preservation of dated exceptions, one-screen schedule, adjacent split-day action, services, and real finance display.

The one-screen assertion in `tests/employee-portal-ui/portal.spec.mjs:114-142` is substantive: at 1440x900 and 1366x768 in light and dark themes, the save button must fit the viewport, all seven day groups must be visible, and horizontal overflow must be absent. Other portal panels must also fit the tested desktop heights. The CSS correction retains these assertions unchanged and the supplied browser log records their pass.

## Evidence limits and disposition

- The supplied 22-test log does **not independently establish a post-fix mobile axe run**. The inspected test files listed in that log contain no named axe case, and the 390 px gallery helper is conditional on `PORTAL_CAPTURE=1`; the log does not establish that flag. Do not label this particular log as proof of mobile axe. This is an evidence-description limitation, not a required source correction for this narrow valid-token fix. Any broader mobile/accessibility approval must cite its actual separate evidence.
- This reviewer did not inspect screenshots or claim pixel-identical visual output. Compact desktop behavior is supported by the unchanged real geometry assertions and their recorded pass.
- Final whole-unit, build, types, lint, and any broader mobile/accessibility gates remain the parent's separate responsibility. GitHub and production owner actions remain unchanged and are not cleared by this review.

**PASS. Required issues for this narrow CSS correction: none.**
