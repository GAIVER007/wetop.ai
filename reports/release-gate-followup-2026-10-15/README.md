# Release gate UI follow-up, 15.10.2026

Only two Beauty UI specs change. Product code, permissions, schema, migrations and deployment configuration are unchanged.

## Problem and change

A created service keeps its pending creation pointer until Location configuration is saved. After reload the existing card resumes automatically. The old scenario clicked the underlying Edit button while that card intercepted pointer events. It now checks the saved service name and integer minor-unit price in the resumed card, then completes the same Location configuration.

Both specs use the existing streaming-aware UI fixture. This preserves strict selectors while waiting for hidden Next stream segments and pending navigation to settle. Type-only imports remain from Playwright.

## Verification

- Beauty RED:25 PASS,2 FAIL,17 existing opt-in SKIP, no code drift. Failures: pending service card and duplicate hidden finance stream node.
- Targeted GREEN:2/2.
- Full Beauty GREEN:27 PASS,0 FAIL,17 existing opt-in SKIP. No retries or added skips.
- Full integration on merged PR538:1279 PASS,0 FAIL,14 SKIP. Own PostgreSQL55971, no shared or production database.
- Branch scope restoration:5/5. Workspace API failure scenario:1/1.
- Unit default concurrency:4846 PASS,6 FAIL,4 SKIP. Failures were4 shell timeouts and2 local HTTP disconnects.
- Those4 unit files with one worker:125 PASS,1 existing SKIP.
- Full unit with2 workers:4852 PASS,0 FAIL,4 existing SKIP. No timeout changes, exclusions or new skips.
- Root/API/web typecheck PASS after restoring existing installed qrcode-generator dependency in the isolated copy. Lint PASS.
- Roles menu RED1/1 then GREEN12/12; the equivalent change was already merged in PR545 and is not included here.
- Integration candidate was superseded by merged PR538 and is not included here. The real-data fix is already in PR544.

All recorded runs above have codeChangedDuringRun=false. Their original source commits and fingerprints are recorded individually in MANIFEST.json. Later main changes through48e05c915 concern documentation, real-data and roles test expectations, not application code. Full exact-SHA release-checks remains the deployment authority after merge.

## Review

Independent read-only review approved both Beauty specs: saved fields remain asserted, strict selectors are retained, no product or security surface changes. No Required or Critical findings.

Mutation check: changing the saved expected price to1200001 caused the intended assertion failure. The file was restored automatically. Final targeted run86a5 on48e05c915 passed2/2 with no drift.

## Boundaries

This is release-test repair evidence, not final E1a visual acceptance or production deployment proof. No production migration, manual release movement or permission change was performed.
