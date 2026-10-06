# Calendar free-panel focus repair

Owner approved plan and isolated parallel execution. Only FreeMenuPopover changes; no shared dev DB, foreign working files, processes or index used. No schema, migrations or booking rules changed.

Escape and explicit close restore the connected anchor cell with preventScroll. A cell without tabindex gets -1, so it does not enter sequential Tab navigation. Outside click and movement closures retain their prior behavior.

RED: all eight Escape/button cases failed toBeFocused at360/390/430/1440, outside-click case passed. Log2026-10-05T14-19-58Z-e2e-bdad.log. Intermediate d4a3: focus assertions passed but desktop test incorrectly selected mobile-only hidden period field; corrected test preserves desktop one-night action.

GREEN:29/29 focus/mobile/range scenarios, log2026-10-05T14-25-37Z-e2e-1c28.log. Booking-card checks8/8, log2026-10-05T14-27-08Z-e2e-4f39.log. Types and lint GREEN:2026-10-05T14-27-41Z-typecheck-9056.log,2026-10-05T14-27-56Z-lint-7b9d.log. Synthetic data only.

Production verification completed below.

Full release-checks #97 GREEN on exact SHA 6d9b470564fa8d52db66bca8cf4b74217750e391: all seven jobs success. https://github.com/GAIVER007/wetop.ai/actions/runs/37325666583
UI:318+320+314=952 passed. Unit3365 passed/7 skipped; integration716 passed/12 skipped; onboarding4 passed; e2e25 passed; site53 passed. Source integrated into main via fe6cfc38, candidate ancestry verified against current main. Release fast-forwarded from7e273890 to6d9b4705 after GREEN.

Production:deploy completed2026-10-05T15:13:17Z in150s. Server HEAD and /var/lib/wetop-deploy/deployed equal6d9b470564fa8d52db66bca8cf4b74217750e391; previous7e273890. API/web bothhealthy,image sha256:5bd9f541bfc0107da4c5daf4ec4e5b52eaba78118f40831908b33ab1f4052c09. Next BUILD_ID4PPSnp_PBO9pFjPyWUFeO; health statusok/databaseup; /auth/fallback,/today,/chessboard,/reservations HTTP200.

Public browser390x844:overflow0; free panel initialfocusinside. Escape and closebutton both remove panel and restore activeTD insidegrid with tabindex=-1. Scroll coordinates unchanged:left0/top0/window363.5. No guest/reservation/block writes. Viewport reset after verification. Screenshots exclude guest information.
