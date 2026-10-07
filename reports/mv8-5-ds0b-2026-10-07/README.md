# MV8.5 DS0b: CSS foundation

Status: implementation and regression in progress. This is not a deployment or final acceptance report.
Base: main `50f04c5ce104bc366d4854e5bf831b81ddfe665f`, after PR #267 and full green CI 37631054628.
Branch: `codex/mv85-ds0b-css-foundation`.
Current integration base: main `b6db018699fa806060d3e74f8d257ec57a9ff8c2` (MV9 vertical analytics merged during verification). Its new vertical.css follows the same sections layer contract.
Draft PR: https://github.com/GAIVER007/wetop.ai/pull/284
Full CI candidate: `93ff7574`, run https://github.com/GAIVER007/wetop.ai/actions/runs/37644060999 (pending overall; fast/unit/types/lint/site, bot, Beauty, Food and Branches green).

## Scope

- Runtime CSS uses reset, tokens, base, components, sections, utilities.
- Every stylesheet declares the same layer order: Next.js can emit component CSS before root layout CSS.
- Seven base primitives and their states have one component owner.
- Historic glass.css removed; flat surfaces retained in component definitions.
- 86 static dead selector candidates removed, rechecked against current runtime sources. See dead-css-removed.txt.
- 11 unused decorative token exports removed from the token source and regenerated. Semantic scales, layer tokens and dynamic board widths retained.
- Route imports follow actual consumers. Shared day bars, navigation tabs, contextual help and layout rules remain shared. See route-style-consumers.txt.
- JS supplies custom properties for measured geometry; CSS owns mobile positioning and widths.
- No API, model, business rule, status enum, finance calculation or vertical gate changes. apps/site is outside this PR.

## Evidence collected

Baseline on the unmodified runtime:
- Hospitality 4/4, 16 images, axe and overflow: 2026-10-07T14-20-20Z-e2e-2bf0.
- Beauty 4/4, screenshots and drawers, real local API: 2026-10-07T14-21-41Z-e2e-7ee8.
- Food 1/1, 20 route images, real local API: 2026-10-07T14-24-28Z-e2e-48e1.
- Food first startup collided on port 55824, no tests executed; subsequent run passed.

Primitive guard: RED 7/7 on duplicate definitions (2026-10-07T14-26-18Z-unit-853d), GREEN 7/7 after consolidation (2026-10-07T14-27-37Z-unit-250c).
First primitive increment: hospitality 4/4 (2026-10-07T14-38-52Z-e2e-8906).
Layered CSS checks: 60/60 (2026-10-07T14-47-07Z-unit-a2c2), before the browser detected layer declaration order.
Browser RED: 2026-10-07T14-47-36Z-e2e-d0a3. CSSOM confirmed component layers preceding the root order declaration; base link color incorrectly overrode shell links. Fixed by declaring the contract at every CSS entry.

Additional verification:
- Browser GREEN after entry order correction: hospitality 4/4, 2026-10-07T14-52-12Z-e2e-f477. Final screenshots will be refreshed after stat value consolidation.
- Post-merge CSS/token guards: 44/44, 2026-10-07T15-22-46Z-unit-5b6f.
- Root/API/web typechecks and lint passed sequentially before the main merge.
- Full local unit: 3798 passed, 29 failed, 4 skipped. Failures include host-load timeouts and macOS Bash locale errors; this is not a green full run. Log: 2026-10-07T14-58-25Z-unit-7b95.
- Targeted shell/guard repeat with LC_ALL=C and one worker: 39/39, 2026-10-07T15-06-00Z-unit-bb38. No timeout or assertion thresholds changed.
- Full local UI was interrupted after the first long-running accessibility test. It is not accepted as full regression. Log: 2026-10-07T14-59-27Z-e2e-3608.
- Full local Beauty failed its first mutation expectation; subsequent tests could not reset an organization removed by the suite's afterAll cleanup. Log: 2026-10-07T15-15-22Z-e2e-e618.
- Isolated Beauty first-test repeat reached appointment movement, then hit the unchanged 90-second test timeout. PostgreSQL confirms cleanup DELETE locations conflicted with the still-running appointment UPDATE after timeout, not a standalone business transaction failure. Log: 2026-10-07T15-27-51Z-e2e-1d04. Network trace showed cleanup starting 15:30:27.885 UTC; DB deadlock was logged 15:30:29.038 UTC. The subsequent full Beauty CI job passed with the unchanged canonical limits.

Two test readers were adapted to real PostCSS/filesystem traversal. Their former flat-string and git-index scans could not handle @layer or a removed/untracked stylesheet correctly. No rule thresholds were raised.

## Visual matrix

Before/after: hospitality Today, calendar, reservations, finance; Beauty calendar, appointments, customers, masters; Food Today, floor plan, reservations, dining areas. Each has light/dark and 1440/390 widths.
Hospitality desktop height 900, Beauty/Food desktop height 1000; mobile height 844. Heights match within every before/after pair.
Extra vertical service/customer/drawer images are retained. The calendar clock is live, so pixel differences there are expected.

## Isolation and deployment

Beauty and Food use isolated local PostgreSQL on 55482, database pmslocal, synthetic fixtures. Shared dev and production databases are not used by these runs.
SSH confirmed: root@187.77.145.152 port 5555. Production remains at e3fadd02bb8dbbae2d20028118819d576c064e30; healthy web/API containers alone are not UI proof.
Read-only ledger check at 15:34 UTC confirmed 060/061 applied and 062/063 absent. No release push, deploy or migration performed. Migration approval with backup, validation and rollback is required separately.

## Review

Review covered shared primitive ownership, the CSS layer entry contract, source token generation, route-style consumer imports, geometry custom properties, and dead-selector references. Test readers now parse nested CSS without skipping selectors. No assertions were removed and no repository timeout was raised.

The local visual-only capture repeat uses a CLI timeout of 240 seconds because the host was running at load averages above 20. This is explicitly a screenshot collection budget, not proof of canonical regression performance. Full vertical CI jobs use the original 90-second config and passed. The failed ordinary local capture is retained as 2026-10-07T15-31-43Z-e2e-48e6.

## Deployment gate

Pending migrations are existing main changes, not part of DS0b:
- 062 generation_run_core: new generation task table, enum types, ownership/provenance constraints and RLS; nullable generation_run_id on marketing_site_versions.
- 063 generation_run_grants: application role SELECT/INSERT, service role SELECT/INSERT/UPDATE, no DELETE.

Before an approved production application: pin the green candidate, save current image/SHA, take and validate a fresh backup per docs/ops/backups.md, apply only the reviewed migration set, check ledger/constraints/RLS/grants, deploy per docs/deploy.md and verify authenticated routes plus image/SHA. Rollback scripts exist beside both migrations; 062 rollback is only valid before generation is used, because it restores the MANUAL-only constraint. Do not drop generated data to force rollback. A new migration appearing in main requires renewed review of the exact pending set.

No production mutation or release-branch update has been made by this task.

## Acceptance boundary

DS1 has not started. Final full regression, before/after review and owner acceptance are required before DS1.
