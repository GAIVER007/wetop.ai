# MV8.5 DS0b: CSS foundation

Status: implementation and regression in progress. This is not a deployment or final acceptance report.
Base: main `50f04c5ce104bc366d4854e5bf831b81ddfe665f`, after PR #267 and full green CI 37631054628.
Branch: `codex/mv85-ds0b-css-foundation`.
Current integration base: main `b6db018699fa806060d3e74f8d257ec57a9ff8c2` (MV9 vertical analytics merged during verification). Its new vertical.css follows the same sections layer contract.
Draft PR: https://github.com/GAIVER007/wetop.ai/pull/284
Full CI candidate: `d1461ddc`, run https://github.com/GAIVER007/wetop.ai/actions/runs/37646528370 (failed: six UI failures; repairs and a new full run pending).
Previous run 37644060999 passed fast/unit/types/lint/site, bot, Beauty, Food and Branches, then was cancelled by this task after visual review found narrow ghost arrows. Its partial green jobs do not replace final-candidate CI.

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

Ghost arrow regression:
- Visual comparison found the obsolete ghost padding overriding the consolidated base button (26 px arrow width).
- Added a real-browser width assertion for previous/next day links at both viewports. RED: 2026-10-07T15-41-25Z-e2e-ffc5, expected >=44, received 26.
- Removed obsolete ghost padding so shared 16 px horizontal padding wins again. Large panels also use the shared 16 px gap instead of the older 12 px modifier.
- Final CSS/token guard GREEN: 44/44, 2026-10-07T15-44-33Z-unit-a915. The preceding update-baseline run changed its watched file and is not counted as evidence.
- Final debt totals: off-scale spacing 315 -> 249; literal spacing 1138 -> 953. Other reductions are recorded in debt-totals.json.

- Browser GREEN after arrow correction: Beauty visual 4/4 at canonical 90-second timeout, 2026-10-07T15-45-30Z-e2e-4430. All 24 final Beauty images collected, including the 16 core matrix views.

## Visual matrix

Before/after: hospitality Today, calendar, reservations, finance; Beauty calendar, appointments, customers, masters; Food Today, floor plan, reservations, dining areas. Each has light/dark and 1440/390 widths.
Hospitality desktop height 900, Beauty/Food desktop height 1000; mobile height 844. Heights match within every before/after pair.
The baseline predates upstream MV9: the added Beauty/Food Analytics navigation item comes from main b6db0186 and is not a DS0b CSS change. Extra vertical service/customer/drawer images are retained. The calendar clock is live, so pixel differences there are expected.

Beauty pixel comparison: 24 pairs, all 12 mobile pairs identical at the repository pixel threshold; desktop differences 0.072-0.146%, primarily upstream Analytics navigation and standardized badge spacing/radius. See beauty-diff.txt. Arrow geometry now matches the baseline. Visually inspected calendar desktop light, appointments desktop dark and mobile calendar dark.

Food final capture: 1/1 screenshot/keyboard/axe scenario, 24 images, 2026-10-07T15-48-42Z-e2e-1155. CLI capture timeout 240 seconds, assertion timeout unchanged; elapsed test 1.6 minutes. Canonical full Food regression is tracked separately in CI.

Food pixel comparison: desktop 0.138-2.073%, matching-size mobile 0.036-4.372%. Floor-plan and drawer full-page height decreased from 989 to 975 px. Visible changes: shared mobile panel padding is now 16 px instead of the former 24 px on these panels; common gap is 16 px; badges use 8 px gap and 4 px radius. These are the documented primitive normalization choices, not Food layout redesign. Analytics navigation is upstream. Inspected mobile floor-plan and dining-area before/after; content remains readable and controls remain available. See food-diff.txt.

Hospitality final capture: 4/4, 2026-10-07T15-50-57Z-e2e-b075, 16 images, axe and no overflow at 1440/390 in light/dark. Today and mobile finance are identical or differ only in dynamic header text. Chessboard differences are 0.050-0.116%; reservations are 2.235-4.871%. The reservations screen now applies its own guest/booking-number typography over common table defaults; badge spacing and radius are standardized. Data, amounts, row order and page dimensions are unchanged. Inspected reservations desktop before/after and mobile dark; differences are visible in the comparison, not declared pixel-neutral. See hospitality-diff.txt.

The complete matrix is 64 matching filenames in before/after. screenshots.json pins source SHAs, pixel dimensions and SHA-256 for every image. The comparison viewer was opened in the in-app browser, both images loaded, and switching to a Food mobile pair was verified.

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

## Full-CI regression repairs

Run 37646528370 completed with UI shard totals 330/331, 333/337 and 324/325. Six failures are retained as RED evidence:
- Analytics mobile bottom padding: route-level shorthand in sections replaced the shell's 90 px navigation allowance. The fixed bottom bar intercepted the Details summary, causing both the padding and responsive-category tests to fail. Analytics now sets only top/inline spacing, preserving shell bottom compensation.
- Chessboard free-period popover: unlike StayPreview, it still wrote inline top/left. These overrode the mobile bottom-sheet inset and covered the search input. Both popovers now supply the same measured custom properties; mobile CSS owns placement.
- Analytics global API failure: upstream MV9 authorization fails before loading a report. The test now checks the global closed state on both analytics routes and independently checks a dashboard-only failure. GREEN: 2026-10-07T16-16-35Z-e2e-b3f4, 1/1, CLI 180-second cold-start budget. Assertions remain unchanged or stronger.
- Component reference images: pending baseline review/update through the canonical GitHub ui-snapshots workflow. Reviewed panels, stats, table, badges, fields, buttons, tabs and token samples. Expected differences include normalized panel gap/stat size/badge geometry and subpixel shifts in following sections. No screenshot tolerance has been changed.

The 64 core/extra route images at d1461ddc remain valid for their captured states: the repairs change analytics (outside this matrix) and the open free-period menu (not shown in the chessboard overview). Regression tests cover these additional states.

Targeted mobile repeat: 18/19 passed, 2026-10-07T16-23-18Z-e2e-f90c. Chessboard focus tests and analytics category interaction now pass at canonical limits. The route sweep exposed the same shorthand issue in hotel settings; its route spacing now also preserves the shell bottom padding.

Canonical Linux references: ui-snapshots run 37651993122 passed, commit 8be62da1 cherry-picked as 55083b97. All 27 changed references came from the GitHub runner. The date-field reference previously marked October 4 as today; the screenshot test now pins October 7, 2026 at noon UTC, so the marker no longer drifts each day. Upstream header additions are visible in the static dialog showcase because the existing screenshot includes its sticky header. Assertions and maxDiffPixelRatio=0.002 remain intact.

Final CSS/token guards after mobile repairs: 44/44, 2026-10-07T16-30-12Z-unit-7e79. Debt is now 249 off-scale and 953 literal-spacing occurrences.

Mobile bottom allowance GREEN across all 12 checked routes: 2026-10-07T16-30-28Z-e2e-6cb4, canonical limits, 1/1. The previous 18 passing mobile/focus/category checks remain unchanged; final full CI must validate the combined candidate.
