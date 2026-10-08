# Donor file comparison

Fixed base: 5073ac2a1e591b60b8f46f6609778b84ceacad5c. Working assembly at962cc6f30 plus uncommitted BAR integration. Content equality is evidence of inclusion, not proof of whole PR acceptance.

| Source | File | Current comparison |
|---|---|---|
| PR263 | `apps/web/src/app/chessboard/board-grid.tsx` | modified Unified integration, review required |
| PR263 | `apps/web/src/app/chessboard/board.css` | modified Unified integration, review required |
| PR263 | `apps/web/src/app/chessboard/calendar-workspace.tsx` | matches donor |
| PR263 | `apps/web/src/app/chessboard/page.tsx` | modified Unified integration, review required |
| PR263 | `apps/web/src/app/chessboard/stay-preview.tsx` | matches donor |
| PR263 | `apps/web/src/app/reservations/[number]/actions-panel.tsx` | modified Unified integration, review required |
| PR263 | `tests/ui/calendar-workspace.spec.ts` | matches donor |
| PR263 | `tests/ui/chessboard-card.spec.ts` | modified Unified integration, review required |
| PR263 | `tests/ui/chessboard-filters.spec.ts` | unchanged fixed base, donor excluded |
| PR263 | `tests/ui/chessboard-mobile.spec.ts` | matches donor |
| PR263 | `tests/ui/reservation-fixed-occupancy.spec.ts` | modified Unified integration, review required |
| PR263 | `tests/ui/workspace.spec.ts` | unchanged fixed base, donor excluded |
| PR264 | `apps/web/src/app/chessboard/board-clock.tsx` | matches donor |
| PR264 | `apps/web/src/app/chessboard/board-grid.tsx` | modified Unified integration, review required |
| PR264 | `apps/web/src/app/chessboard/board.css` | modified Unified integration, review required |
| PR264 | `apps/web/src/app/chessboard/calendar-workspace.tsx` | matches donor |
| PR264 | `apps/web/src/app/chessboard/page.tsx` | modified Unified integration, review required |
| PR264 | `apps/web/src/app/chessboard/stay-preview.tsx` | matches donor |
| PR264 | `apps/web/src/app/reservations/[number]/actions-panel.tsx` | modified Unified integration, review required |
| PR264 | `tests/ui/calendar-workspace.spec.ts` | matches donor |
| PR264 | `tests/ui/chessboard-calendar.spec.ts` | matches donor |
| PR264 | `tests/ui/chessboard-card.spec.ts` | modified Unified integration, review required |
| PR264 | `tests/ui/chessboard-filters.spec.ts` | unchanged fixed base, donor excluded |
| PR264 | `tests/ui/chessboard-mobile.spec.ts` | modified Unified integration, review required |
| PR264 | `tests/ui/chessboard-statistics.spec.ts` | matches donor |
| PR264 | `tests/ui/guests-birthdays.spec.ts` | matches donor |
| PR264 | `tests/ui/reservation-fixed-occupancy.spec.ts` | modified Unified integration, review required |
| PR264 | `tests/ui/workspace.spec.ts` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/app/globals.css` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/app/page.tsx` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/app/tokens.css` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/components/auth-dialog.tsx` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/components/brand.tsx` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/components/landing/audience.tsx` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/components/landing/hero.tsx` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/components/site-header.tsx` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/i18n/ru.ts` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `apps/site/src/i18n/types.ts` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `tests/site/auth-dialog.spec.ts` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `tests/site/homepage-blocks.spec.ts` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `tests/site/landing.spec.ts` | unchanged fixed base, donor excluded |
| PUBLIC2 PR281 | `tests/site/public-intro.spec.ts` | unchanged fixed base, donor excluded |

Calendar files differ from original donors because Unified restores the guest form and fixes mobile assignment overflow, footer spacing and date-relative test expectations. PUBLIC2 unique changes are not newly approved by this task; differences must be reviewed before freezing the final candidate.
