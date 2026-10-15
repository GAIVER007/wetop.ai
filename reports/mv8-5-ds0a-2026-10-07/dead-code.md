# DS0a: опись мёртвого кода (только опись, 07.10.2026)

База: ветка `claude/blissful-newton-6pa4ky` от `main` `012c06d8`. По решению владельца в DS0a удаляется только
`today/today-widgets.tsx`; всё остальное ниже записано, ничего не удалено. Удаление по описи делает DS0b.

## 1. Модули `.tsx` без импортов (сторож `orphan-module`)

Команда: сторож `tests/unit/design-slop-rules.ts` (`findOrphans`): учитываются `import … from`, `export … from`,
`import('…')`, относительные пути и `@/` по всему `apps/web/src`, включая печать и `/design-system`; файлы маршрутов
Next не считаются.

| Файл | Решение DS0a | Доказательство |
|---|---|---|
| `apps/web/src/app/today/today-widgets.tsx` | **удалён** (решение владельца №8) | ниже, §2 |
| `apps/web/src/app/login/role-access.tsx` | **не удалён**, спорный кандидат, STOP по нему | `grep -rn 'role-access\|RoleAccess' apps/web/src` находит только сам файл; в снимке сторожа как долг |
| `apps/web/src/components/section-cards.tsx` | **не удалён**, спорный кандидат, STOP по нему | `grep -rn 'section-cards\|SectionCards' apps/web/src` находит только сам файл; в снимке сторожа как долг |

## 2. `today/today-widgets.tsx`: доказательство 0 импортов

1. `grep -rn "today-widgets\|TodayWidgets" apps packages tests scripts` (`.ts`, `.tsx`, `.css`, `.js`, `.mjs`, без
   `node_modules` и `.next`): одно вхождение, объявление `export function TodayWidgets` в самом файле.
2. Стили модуля `.tw-*`: `grep -rn '\.tw-' apps/web/src --include=*.css` даёт 0 (удалены раньше).
3. Сторож `orphan-module`: с возвращённым файлом красный, `apps/web/src/app/today/today-widgets.tsx: 0 → 1`
   (`tests/runs/logs/2026-10-07T08-14-04Z-unit-1081.log`); после удаления зелёный
   (`tests/runs/logs/2026-10-07T08-14-12Z-unit-950a.log`).
4. После удаления: typecheck и lint чистые, полный unit и сборка `apps/web` (числа в README).

## 3. Токены без ссылок

Токен из `tokens.css`, имени которого нет ни в одном `.css`, `.ts`, `.tsx` `apps/web/src` и который не используется
внутри `tokens.css` через `var()`. Токены `--board-unit-col-*` могут собираться по имени зума: проверить вручную в DS0b.

Токенов в tokens.css: 128; без ссылок в apps/web/src и внутри tokens.css: 24

`--accent-1` `--accent-2` `--board-day-min` `--board-unit-col-month` `--board-unit-col-narrow` `--board-unit-col-phone` `--board-unit-col-week` `--control-h-xs` `--duration-slow` `--glass-blur` `--glass-edge` `--glow-1` `--glow-2` `--glow-3` `--icon-size` `--icon-size-sm` `--layer-bottom-nav` `--layer-glass-glow` `--layer-glass-stars` `--layer-skip-link` `--purple` `--purple-soft` `--shadow-glass` `--star`

## 4. Классы CSS без вхождений

Команда: `npx tsx scripts/design/dead-css.ts`. Класс без вхождения целым словом в `.ts` и `.tsx` `apps/web/src`.
«возможно динамический»: в исходниках есть шаблон `` `префикс-${…}` ``, из которого имя могло собраться; такие
проверяются вручную перед удалением. Классы из §17 аудита есть в описи: `.room-card*` (7), `.occupancy-ring*` (2),
`.hotel-clock`, `.search-dialog`, `.period-bar`, `.kpi--*` (6).

Классов без вхождений: 196

| Файл | Класс | Пометка |
|---|---|---|
| `apps/web/src/app/ai-agents/ai-agents.css` | `.agent-setup` | нет вхождений |
| `apps/web/src/app/ai-agents/ai-agents.css` | `.agent-setup__item` | нет вхождений |
| `apps/web/src/app/ai-agents/ai-agents.css` | `.agent-setup__item--done` | нет вхождений |
| `apps/web/src/app/ai-agents/ai-agents.css` | `.agent-setup__label` | нет вхождений |
| `apps/web/src/app/ai-agents/ai-agents.css` | `.fact` | нет вхождений |
| `apps/web/src/app/beauty/beauty.css` | `.beauty-daylist` | нет вхождений |
| `apps/web/src/app/beauty/beauty.css` | `.beauty-daylist-row` | нет вхождений |
| `apps/web/src/app/beauty/beauty.css` | `.beauty-list` | нет вхождений |
| `apps/web/src/app/beauty/beauty.css` | `.beauty-text` | нет вхождений |
| `apps/web/src/app/beauty/beauty.css` | `.beauty-tile--done` | возможно динамический |
| `apps/web/src/app/beauty/beauty.css` | `.beauty-tile--no_show` | возможно динамический |
| `apps/web/src/app/chessboard/board.css` | `.board__date` | нет вхождений |
| `apps/web/src/app/chessboard/board.css` | `.board-day-metrics` | нет вхождений |
| `apps/web/src/app/chessboard/board.css` | `.board-day-panel__row--occupancy` | возможно динамический |
| `apps/web/src/app/chessboard/board.css` | `.board-hk--clean` | возможно динамический |
| `apps/web/src/app/chessboard/board.css` | `.board-stay-channel` | нет вхождений |
| `apps/web/src/app/chessboard/board.css` | `.board-unassigned--empty` | нет вхождений |
| `apps/web/src/app/connections/integrations.css` | `.integration-card__missing` | нет вхождений |
| `apps/web/src/app/connections/integrations.css` | `.integration-detail` | нет вхождений |
| `apps/web/src/app/connections/integrations.css` | `.integration-subtitle` | нет вхождений |
| `apps/web/src/app/control.css` | `.control-list` | нет вхождений |
| `apps/web/src/app/control.css` | `.control-monitor` | нет вхождений |
| `apps/web/src/app/design-system/kit.css` | `.kit-themes--filter-contrast` | возможно динамический |
| `apps/web/src/app/design-system/kit.css` | `.kit-themes--filter-dark` | возможно динамический |
| `apps/web/src/app/design-system/kit.css` | `.kit-themes--filter-light` | возможно динамический |
| `apps/web/src/app/directory.css` | `.booking-dates` | нет вхождений |
| `apps/web/src/app/directory.css` | `.dir-debt` | нет вхождений |
| `apps/web/src/app/directory.css` | `.dir-guest-cell` | нет вхождений |
| `apps/web/src/app/directory.css` | `.dir-table--statistics` | нет вхождений |
| `apps/web/src/app/finance/finance.css` | `.finance-ops__filters` | нет вхождений |
| `apps/web/src/app/food/food.css` | `.food-unassigned-panel` | нет вхождений |
| `apps/web/src/app/glass.css` | `.attention-summary` | возможно динамический |
| `apps/web/src/app/glass.css` | `.btn--danger` | возможно динамический |
| `apps/web/src/app/glass.css` | `.btn--info` | возможно динамический |
| `apps/web/src/app/glass.css` | `.btn--inverse` | возможно динамический |
| `apps/web/src/app/glass.css` | `.btn--success` | возможно динамический |
| `apps/web/src/app/glass.css` | `.btn--warning` | возможно динамический |
| `apps/web/src/app/glass.css` | `.facts--card` | нет вхождений |
| `apps/web/src/app/glass.css` | `.inventory-categories` | нет вхождений |
| `apps/web/src/app/glass.css` | `.room-card` | нет вхождений |
| `apps/web/src/app/glass.css` | `.rooms-link` | нет вхождений |
| `apps/web/src/app/globals.css` | `.alert--success` | возможно динамический |
| `apps/web/src/app/globals.css` | `.alert--warning` | возможно динамический |
| `apps/web/src/app/globals.css` | `.amount-chip--due` | возможно динамический |
| `apps/web/src/app/globals.css` | `.amount-chip--paid` | возможно динамический |
| `apps/web/src/app/globals.css` | `.amount-chip--refund` | возможно динамический |
| `apps/web/src/app/globals.css` | `.badge--danger` | возможно динамический |
| `apps/web/src/app/globals.css` | `.badge--info` | возможно динамический |
| `apps/web/src/app/globals.css` | `.badge--ok` | возможно динамический |
| `apps/web/src/app/globals.css` | `.block--bottom` | нет вхождений |
| `apps/web/src/app/globals.css` | `.board__occ` | нет вхождений |
| `apps/web/src/app/globals.css` | `.btn--danger` | возможно динамический |
| `apps/web/src/app/globals.css` | `.btn--info` | возможно динамический |
| `apps/web/src/app/globals.css` | `.btn--success` | возможно динамический |
| `apps/web/src/app/globals.css` | `.btn--warning` | возможно динамический |
| `apps/web/src/app/globals.css` | `.cols-2` | нет вхождений |
| `apps/web/src/app/globals.css` | `.facts--card` | нет вхождений |
| `apps/web/src/app/globals.css` | `.field__label` | нет вхождений |
| `apps/web/src/app/globals.css` | `.grid-auto--sm` | возможно динамический |
| `apps/web/src/app/globals.css` | `.is-stop` | нет вхождений |
| `apps/web/src/app/globals.css` | `.ml-sm` | нет вхождений |
| `apps/web/src/app/globals.css` | `.notice--muted` | возможно динамический |
| `apps/web/src/app/globals.css` | `.page--full` | возможно динамический |
| `apps/web/src/app/globals.css` | `.page--medium` | возможно динамический |
| `apps/web/src/app/globals.css` | `.page--narrow` | возможно динамический |
| `apps/web/src/app/globals.css` | `.page--wide` | возможно динамический |
| `apps/web/src/app/globals.css` | `.pending-list` | нет вхождений |
| `apps/web/src/app/globals.css` | `.pending-list__row` | нет вхождений |
| `apps/web/src/app/globals.css` | `.price-cell` | нет вхождений |
| `apps/web/src/app/globals.css` | `.skeleton-text` | возможно динамический |
| `apps/web/src/app/globals.css` | `.stat__extra` | нет вхождений |
| `apps/web/src/app/globals.css` | `.stat--alarm` | возможно динамический |
| `apps/web/src/app/globals.css` | `.stat--big` | возможно динамический |
| `apps/web/src/app/globals.css` | `.stat--compact` | возможно динамический |
| `apps/web/src/app/globals.css` | `.stat--warn` | возможно динамический |
| `apps/web/src/app/globals.css` | `.tbl--sm` | возможно динамический |
| `apps/web/src/app/globals.css` | `.toast--info` | возможно динамический |
| `apps/web/src/app/globals.css` | `.toast--warning` | возможно динамический |
| `apps/web/src/app/hotel-settings/settings.css` | `.connection-grid` | нет вхождений |
| `apps/web/src/app/hotel-settings/settings.css` | `.settings-connections` | нет вхождений |
| `apps/web/src/app/inventory/fund.css` | `.fund-category-actions` | нет вхождений |
| `apps/web/src/app/inventory/fund.css` | `.fund-facts` | нет вхождений |
| `apps/web/src/app/inventory/fund.css` | `.fund-preview-rates` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.login-brand` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.login-consent` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.login-features` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.login-forgot` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.login-page--entry` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.login-theme` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.password-control` | нет вхождений |
| `apps/web/src/app/login/login.css` | `.phone-control` | нет вхождений |
| `apps/web/src/app/login/role-access.css` | `.team-access` | нет вхождений |
| `apps/web/src/app/management/analytics/analytics.css` | `.kpi--average` | возможно динамический |
| `apps/web/src/app/management/analytics/analytics.css` | `.kpi--revenue` | возможно динамический |
| `apps/web/src/app/management/analytics/analytics.css` | `.pa-rank__diff--down` | возможно динамический |
| `apps/web/src/app/management/analytics/analytics.css` | `.pa-rank__diff--flat` | возможно динамический |
| `apps/web/src/app/management/analytics/analytics.css` | `.pa-rank__diff--up` | возможно динамический |
| `apps/web/src/app/management/hotel.css` | `.connection-grid` | нет вхождений |
| `apps/web/src/app/management/hotel.css` | `.content-text` | нет вхождений |
| `apps/web/src/app/management/hotel.css` | `.facility-list` | нет вхождений |
| `apps/web/src/app/management/hotel.css` | `.photo-card` | нет вхождений |
| `apps/web/src/app/market/market.css` | `.market-insight--ok` | возможно динамический |
| `apps/web/src/app/market/market.css` | `.market-insight--warn` | возможно динамический |
| `apps/web/src/app/platform/support/support.css` | `.support-transcript__msg--operator` | возможно динамический |
| `apps/web/src/app/platform/support/support.css` | `.support-transcript__msg--user` | возможно динамический |
| `apps/web/src/app/premium.css` | `.alert--ok` | возможно динамический |
| `apps/web/src/app/premium.css` | `.assistant-results` | нет вхождений |
| `apps/web/src/app/premium.css` | `.badge--danger` | возможно динамический |
| `apps/web/src/app/premium.css` | `.badge--info` | возможно динамический |
| `apps/web/src/app/premium.css` | `.badge--ok` | возможно динамический |
| `apps/web/src/app/premium.css` | `.board__occ` | нет вхождений |
| `apps/web/src/app/premium.css` | `.board-filters-row` | нет вхождений |
| `apps/web/src/app/premium.css` | `.board-occ-total` | нет вхождений |
| `apps/web/src/app/premium.css` | `.board-state-filters` | нет вхождений |
| `apps/web/src/app/premium.css` | `.board-unassigned-title` | нет вхождений |
| `apps/web/src/app/premium.css` | `.btn--danger` | возможно динамический |
| `apps/web/src/app/premium.css` | `.btn--info` | возможно динамический |
| `apps/web/src/app/premium.css` | `.btn--success` | возможно динамический |
| `apps/web/src/app/premium.css` | `.btn--warning` | возможно динамический |
| `apps/web/src/app/premium.css` | `.directory-guest` | нет вхождений |
| `apps/web/src/app/premium.css` | `.facts--card` | нет вхождений |
| `apps/web/src/app/premium.css` | `.has-active-child` | нет вхождений |
| `apps/web/src/app/premium.css` | `.hotel-clock` | нет вхождений |
| `apps/web/src/app/premium.css` | `.login-forgot` | нет вхождений |
| `apps/web/src/app/premium.css` | `.login-property` | нет вхождений |
| `apps/web/src/app/premium.css` | `.login-theme` | нет вхождений |
| `apps/web/src/app/premium.css` | `.occupancy-ring` | нет вхождений |
| `apps/web/src/app/premium.css` | `.page--medium` | возможно динамический |
| `apps/web/src/app/premium.css` | `.page--narrow` | возможно динамический |
| `apps/web/src/app/premium.css` | `.password-control` | нет вхождений |
| `apps/web/src/app/premium.css` | `.property-separator` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-card` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-card-footer` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-card-name` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-card-top` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-cards` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-cards--list` | нет вхождений |
| `apps/web/src/app/premium.css` | `.room-directory-head` | нет вхождений |
| `apps/web/src/app/premium.css` | `.stat--alarm` | возможно динамический |
| `apps/web/src/app/reservations/reservations.css` | `.field__label` | нет вхождений |
| `apps/web/src/app/reservations/reservations.css` | `.reservations-chip--zero` | нет вхождений |
| `apps/web/src/app/reservations/reservations.css` | `.reservations-count` | нет вхождений |
| `apps/web/src/app/reservations/reservations.css` | `.reservations-statuses` | нет вхождений |
| `apps/web/src/app/staff/staff.css` | `.staff-page` | нет вхождений |
| `apps/web/src/app/staff/staff.css` | `.team-list-heading` | нет вхождений |
| `apps/web/src/app/staff/staff.css` | `.team-role-help` | нет вхождений |
| `apps/web/src/app/status/status.css` | `.status-page__overall--danger` | возможно динамический |
| `apps/web/src/app/status/status.css` | `.status-page__overall--ok` | возможно динамический |
| `apps/web/src/app/status/status.css` | `.status-page__overall--warn` | возможно динамический |
| `apps/web/src/app/status/status.css` | `.status-page__state--danger` | возможно динамический |
| `apps/web/src/app/status/status.css` | `.status-page__state--ok` | возможно динамический |
| `apps/web/src/app/status/status.css` | `.status-page__state--warn` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.bars-meta` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.dash-grid--tables` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.day-bar-row` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi__icon` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.kpi--adr` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi--paid` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi--revenue` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi--revpar` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi-delta--down` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi-delta--flat` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.kpi-delta--up` | возможно динамический |
| `apps/web/src/app/today/dashboard.css` | `.occupancy-ring--mini` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.period-bar` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.period-caption` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.period-custom` | нет вхождений |
| `apps/web/src/app/today/dashboard.css` | `.today-links` | нет вхождений |
| `apps/web/src/app/today/desk.css` | `.attention-icon` | возможно динамический |
| `apps/web/src/app/today/desk.css` | `.attention-item--critical` | возможно динамический |
| `apps/web/src/app/today/desk.css` | `.attention-item--debt` | возможно динамический |
| `apps/web/src/app/today/desk.css` | `.attention-item--overdue` | возможно динамический |
| `apps/web/src/app/today/desk.css` | `.attention-item--warning` | возможно динамический |
| `apps/web/src/app/today/owner-dashboard.css` | `.owner-placeholder--finance` | возможно динамический |
| `apps/web/src/app/today/owner-dashboard.css` | `.owner-placeholder--load` | возможно динамический |
| `apps/web/src/app/today/owner-dashboard.css` | `.owner-placeholder--outlook` | возможно динамический |
| `apps/web/src/app/today/owner-dashboard.css` | `.owner-placeholder--today` | возможно динамический |
| `apps/web/src/app/today/owner-dashboard.css` | `.pmsw-b` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.board__occ` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.board-occ-total` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.board-unassigned-list` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.board-unassigned-title` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.brand-dot` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.dialog-heading` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.facts--card` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.form-footer` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.menu-close` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.page--full` | возможно динамический |
| `apps/web/src/app/workspace.css` | `.page--medium` | возможно динамический |
| `apps/web/src/app/workspace.css` | `.page--narrow` | возможно динамический |
| `apps/web/src/app/workspace.css` | `.search-dialog` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.tbl--sm` | возможно динамический |
| `apps/web/src/app/workspace.css` | `.workspace-breadcrumb` | нет вхождений |
| `apps/web/src/app/workspace.css` | `.workspace-create` | нет вхождений |
| `apps/web/src/components/shell/assistant-widget.css` | `.pmsw-b` | нет вхождений |
| `apps/web/src/components/shell/assistant-widget.css` | `.pmsw-p` | нет вхождений |
