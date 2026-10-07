# MV8.5 DS0b: CSS foundation

Status: implementation and regression in progress. This is not a deployment or final acceptance report.
Base: main `50f04c5ce104bc366d4854e5bf831b81ddfe665f`, after PR #267 and full green CI 37631054628.
Branch: `codex/mv85-ds0b-css-foundation`.

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

Two test readers were adapted to real PostCSS/filesystem traversal. Their former flat-string and git-index scans could not handle @layer or a removed/untracked stylesheet correctly. No rule thresholds were raised.

## Visual matrix

Before/after: hospitality Today, calendar, reservations, finance; Beauty calendar, appointments, customers, masters; Food Today, floor plan, reservations, dining areas. Each has light/dark and 1440/390 widths.
Hospitality desktop height 900, Beauty/Food desktop height 1000; mobile height 844. Heights match within every before/after pair.
Extra vertical service/customer/drawer images are retained. The calendar clock is live, so pixel differences there are expected.

## Isolation and deployment

Beauty and Food use isolated local PostgreSQL on 55482, database pmslocal, synthetic fixtures. Shared dev and production databases are not used by these runs.
SSH confirmed: root@187.77.145.152 port 5555. Production remains at e3fadd02bb8dbbae2d20028118819d576c064e30; healthy web/API containers alone are not UI proof.
Production migrations 062/063 are absent. No release push, deploy or migration performed. Migration approval with backup, validation and rollback is required separately.

## Acceptance boundary

DS1 has not started. Final full regression, before/after review and owner acceptance are required before DS1.
