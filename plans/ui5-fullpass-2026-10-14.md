# UI5: полная UI/UX-доработка WETOP (поручение владельца 14.10.2026)

Поручение: аудит всего продукта и реальное приведение интерфейса к единому профессиональному виду;
бизнес-логику, модель, права не трогать; фейковых функций не рисовать (BLOCKED BY BACKEND);
оболочка UI3.1 (☰) и решения Q-DES-1…5, ADR-179/180 сохраняются. Контракт — DESIGN.md §0/§21.

## Старт

- START SHA: `925085f4e` (main, #505; включает весь пакет UI4 из #498/#504).
- `release`: `13d3210d4` (#500); гейт на #505 идёт, автоперемотка по ADR-152.
- Маршрутов страниц: 117 (`apps/web/src/app/**/page.tsx`).

## Метод аудита (факты, не впечатления)

1. **Инструментальный обход** всех маршрутов на стенде (`tests/ui/ui5-audit.spec.ts`,
   включается только `UI5_AUDIT=1`, в гейте не бежит): на 1440/768/390 в обеих темах
   снимаются: перелив вбок, минимальный размер текста, цели касания < 44 px (телефон),
   наличие h1, ошибки консоли, нарушения axe; итог — `reports/ui5-audit-2026-10-14/registry.json`
   и таблица `registry.md` (маршрут × найденное).
2. **Карта горячих точек кода** — храповик `design-slop.baseline.json`: 1387 учтённых отступлений,
   топ: `premium.css` 304, `components.css` 210, `workspace.css` 148, `directory.css` 98,
   `channels.css` 74, `owner-dashboard.css` 72, `analytics.css` 66, `board.css` 59, `finance.css` 57.
3. Снимки BEFORE на эталонных ширинах — тем же обходом.

## Семейства и порядок (P0 → P1 → P2 → P3)

| Семейство | Маршруты (главные) | Приоритет |
|---|---|---|
| A. SHELL | оболочка, меню, шапка, поиск | P0/P1 (жива, UI3.1) |
| B. DASHBOARDS | /today | P1 |
| C. HOSPITALITY | /chessboard, /guests, /reservations*, /inventory, /units, /rooms, /tasks | P1 |
| D. BEAUTY | /beauty*, /appointments, /employees, /services, /customers | P1 |
| E. FOOD | /kitchen, /orders, /menu, /dining-areas, /floor-plan, /table-reservations, /stock, /drinks, /restaurant-* | P1 |
| F. FINANCE | /finance, /bar*, /cashbox, /payroll | P1 |
| G. ANALYTICS | /management/analytics* | P2 |
| H. REPORTS | /reports* | P2 |
| I. CRM/SALES | /sales, /market, /channels*, /channel-manager, /ai-agents*, /ai-seller* | P2 |
| J. MARKETING | /marketing*, /website* | P2 |
| K. PEOPLE | /team*, /staff, /employees/shifts, /profile* | P2 |
| L. ORGANIZATION | /branches, /platform* | P2 |
| M. SETTINGS | /hotel-settings*, /connections*, /journal, /incidents, /restaurant-settings | P2 |
| N. SUPPORT | /help, /status | P2 |
| O. AUTH/ONBOARDING | /login*, /register*, /invite, /create, /onboarding | P1 (вход) |
| P. PUBLIC SITE | apps/site | P2 |
| Q. SYSTEM STATES | empty/loading/error/403/404 по всем | P0 там, где ломают экран |

Каждое семейство: AUDIT → IMPLEMENT → TEST → VISUAL QA (§21: before/after/side-by-side/overlay) → FIX → COMMIT.

## Жёсткие рамки

- Общие компоненты улучшаются на месте (никаких Button2); перед правкой — все потребители, после — прогон их спеков.
- Календари по вертикалям разные: гостиница — ресурсы×даты (готово, UI4.2), салон — мастера×время (день готов, неделя
  не строится без решения), ресторан — зал→столы→состояние (есть), план зала ждёт Q-REST-8 → BLOCKED BY BACKEND.
- Данные не выдумываются; отсутствующий backend помечается в отчёте.
- Коммиты логические, по семействам; вливание через PR и гейт (ADR-152).
