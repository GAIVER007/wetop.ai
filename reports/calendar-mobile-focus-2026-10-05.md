# Calendar free-panel focus repair

Owner approved plan and isolated parallel execution. Only FreeMenuPopover changes; no shared dev DB, foreign working files, processes or index used. No schema, migrations or booking rules changed.

Escape and explicit close restore the connected anchor cell with preventScroll. A cell without tabindex gets -1, so it does not enter sequential Tab navigation. Outside click and movement closures retain their prior behavior.

RED: all eight Escape/button cases failed toBeFocused at360/390/430/1440, outside-click case passed. Log2026-10-05T14-19-58Z-e2e-bdad.log. Intermediate d4a3: focus assertions passed but desktop test incorrectly selected mobile-only hidden period field; corrected test preserves desktop one-night action.

GREEN:29/29 focus/mobile/range scenarios, log2026-10-05T14-25-37Z-e2e-1c28.log. Booking-card checks8/8, log2026-10-05T14-27-08Z-e2e-4f39.log. Types and lint GREEN:2026-10-05T14-27-41Z-typecheck-9056.log,2026-10-05T14-27-56Z-lint-7b9d.log. Synthetic data only.

Production release still requires full release-checks on exact candidate SHA and actual deployed/public verification. No deployment claim yet.
