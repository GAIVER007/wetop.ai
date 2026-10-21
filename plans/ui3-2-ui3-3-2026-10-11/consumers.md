# Карта прямых потребителей компонентов

Срез e523f35, 11.10.2026. Статическая опись относительных импортов .tsx/.ts в apps/web/src. Включает тесты и каталог компонентов; это не runtime coverage. CSS-классы, re-export и косвенные потребители требуют отдельной проверки перед PR.

## ui: 221 файлов

- `apps/web/src/app/ai-agents/[id]/instruction-editor.tsx`
- `apps/web/src/app/ai-agents/[id]/page.tsx`
- `apps/web/src/app/ai-agents/new/form.tsx`
- `apps/web/src/app/ai-agents/new/page.tsx`
- `apps/web/src/app/ai-agents/page.tsx`
- `apps/web/src/app/ai-seller/[[...section]]/channels.tsx`
- `apps/web/src/app/ai-seller/[[...section]]/overview.tsx`
- `apps/web/src/app/ai-seller/[[...section]]/page.tsx`
- `apps/web/src/app/ai-seller/[[...section]]/scenarios.tsx`
- `apps/web/src/app/ai-seller/forms.tsx`
- `apps/web/src/app/appointments/list.tsx`
- `apps/web/src/app/bar/folio-sale-form.tsx`
- `apps/web/src/app/bar/inventory-count-form.tsx`
- `apps/web/src/app/bar/operations/page.tsx`
- `apps/web/src/app/bar/page.tsx`
- `apps/web/src/app/bar/product-price-form.tsx`
- `apps/web/src/app/bar/products/catalog-forms.tsx`
- `apps/web/src/app/bar/products/page.tsx`
- `apps/web/src/app/bar/receipts/new/new-receipt.tsx`
- `apps/web/src/app/bar/receipts/new/page.tsx`
- `apps/web/src/app/bar/receipts/page.tsx`
- `apps/web/src/app/bar/sale-form.tsx`
- `apps/web/src/app/bar/stock-board.tsx`
- `apps/web/src/app/bar/supplier-payment-form.tsx`
- `apps/web/src/app/bar/suppliers/page.tsx`
- `apps/web/src/app/bar/suppliers/supplier-form.tsx`
- `apps/web/src/app/bar/write-off-form.tsx`
- `apps/web/src/app/beauty/appointment-card.tsx`
- `apps/web/src/app/beauty/appointment-form.tsx`
- `apps/web/src/app/beauty/journal.tsx`
- `apps/web/src/app/beauty/masters/board.tsx`
- `apps/web/src/app/beauty/schedule/board.tsx`
- `apps/web/src/app/beauty/services/board.tsx`
- `apps/web/src/app/branches/overview.tsx`
- `apps/web/src/app/branches/workspace.tsx`
- `apps/web/src/app/channels/[[...section]]/loading.tsx`
- `apps/web/src/app/channels/[[...section]]/page.tsx`
- `apps/web/src/app/channels/buttons.tsx`
- `apps/web/src/app/channels/channel-connect.tsx`
- `apps/web/src/app/channels/channel-list-format.ts`
- `apps/web/src/app/channels/channel-list.tsx`
- `apps/web/src/app/channels/connection-setup.tsx`
- `apps/web/src/app/channels/events/[revisionId]/page.tsx`
- `apps/web/src/app/channels/events-table.tsx`
- `apps/web/src/app/channels/outbox-table.tsx`
- `apps/web/src/app/channels/report.tsx`
- `apps/web/src/app/chessboard/board-filters-popover.tsx`
- `apps/web/src/app/chessboard/board-grid.tsx`
- `apps/web/src/app/chessboard/page.tsx`
- `apps/web/src/app/chessboard/preview-finance.tsx`
- `apps/web/src/app/chessboard/stay-preview.tsx`
- `apps/web/src/app/chessboard/unassigned-drawer.tsx`
- `apps/web/src/app/connections/channex/loading.tsx`
- `apps/web/src/app/connections/connection-parts.tsx`
- `apps/web/src/app/connections/loading.tsx`
- `apps/web/src/app/connections/page.tsx`
- `apps/web/src/app/customers/page.tsx`
- `apps/web/src/app/design-system/demos.tsx`
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/finance/cash.tsx`
- `apps/web/src/app/finance/day-attention.tsx`
- `apps/web/src/app/finance/overview.tsx`
- `apps/web/src/app/finance/page.tsx`
- `apps/web/src/app/food/catalog-board.tsx`
- `apps/web/src/app/food/catalog-form.tsx`
- `apps/web/src/app/food/customers.tsx`
- `apps/web/src/app/food/day-toolbar.tsx`
- `apps/web/src/app/food/employees-board.tsx`
- `apps/web/src/app/food/kitchen-board.tsx`
- `apps/web/src/app/food/menu-board.tsx`
- `apps/web/src/app/food/order-drawer.tsx`
- `apps/web/src/app/food/orders-board.tsx`
- `apps/web/src/app/food/payroll-board.tsx`
- `apps/web/src/app/food/reservation-drawer.tsx`
- `apps/web/src/app/food/reservation-form.tsx`
- `apps/web/src/app/food/workspace-board.tsx`
- `apps/web/src/app/guests/[id]/guest-forms.tsx`
- `apps/web/src/app/guests/[id]/page.tsx`
- `apps/web/src/app/guests/birthdays/page.tsx`
- `apps/web/src/app/guests/filter-select.tsx`
- `apps/web/src/app/guests/guest-panel.tsx`
- `apps/web/src/app/guests/guests-table.tsx`
- `apps/web/src/app/guests/loading.tsx`
- `apps/web/src/app/guests/page-size.tsx`
- `apps/web/src/app/guests/page.tsx`
- `apps/web/src/app/hotel-settings/[[...section]]/page.tsx`
- `apps/web/src/app/hotel-settings/catalogs.tsx`
- `apps/web/src/app/hotel-settings/loading.tsx`
- `apps/web/src/app/hotel-settings/media-blocks.tsx`
- `apps/web/src/app/hotel-settings/object-preview.tsx`
- `apps/web/src/app/hotel-settings/object-summaries.tsx`
- `apps/web/src/app/hotel-settings/settings-form.tsx`
- `apps/web/src/app/hotel-settings/settings-save.tsx`
- `apps/web/src/app/incidents/buttons.tsx`
- `apps/web/src/app/incidents/incident-list.tsx`
- `apps/web/src/app/incidents/loading.tsx`
- `apps/web/src/app/incidents/page.tsx`
- `apps/web/src/app/inventory/category-catalog.tsx`
- `apps/web/src/app/inventory/category-preview.tsx`
- `apps/web/src/app/inventory/fund-editor.tsx`
- `apps/web/src/app/inventory/inventory-catalog.tsx`
- `apps/web/src/app/inventory/loading.tsx`
- `apps/web/src/app/inventory/photo-gallery.tsx`
- `apps/web/src/app/inventory/summary-tiles.tsx`
- `apps/web/src/app/inventory/unit-panel.tsx`
- `apps/web/src/app/inventory/unit-state.tsx`
- `apps/web/src/app/invite/[token]/loading.tsx`
- `apps/web/src/app/journal/loading.tsx`
- `apps/web/src/app/journal/page.tsx`
- `apps/web/src/app/management/analytics/channels/channels.tsx`
- `apps/web/src/app/management/analytics/channels/page.tsx`
- `apps/web/src/app/management/analytics/hospitality-page.tsx`
- `apps/web/src/app/management/analytics/occupancy/occupancy.tsx`
- `apps/web/src/app/management/analytics/occupancy/page.tsx`
- `apps/web/src/app/management/analytics/overview.tsx`
- `apps/web/src/app/management/analytics/tiles.tsx`
- `apps/web/src/app/management/analytics/toolbar.tsx`
- `apps/web/src/app/management/analytics/units/page.tsx`
- `apps/web/src/app/management/analytics/units/units.tsx`
- `apps/web/src/app/management/analytics/vertical/screen.tsx`
- `apps/web/src/app/market/calendar.tsx`
- `apps/web/src/app/market/competitors-table.tsx`
- `apps/web/src/app/market/drawers.tsx`
- `apps/web/src/app/market/market-charts.tsx`
- `apps/web/src/app/market/page.tsx`
- `apps/web/src/app/marketing/ads/page.tsx`
- `apps/web/src/app/marketing/content/page.tsx`
- `apps/web/src/app/marketing/page.tsx`
- `apps/web/src/app/marketing/parts.tsx`
- `apps/web/src/app/marketing/site/assets/board.tsx`
- `apps/web/src/app/marketing/site/board.tsx`
- `apps/web/src/app/marketing/site/editor/ai-chat.tsx`
- `apps/web/src/app/marketing/site/editor/create-site.tsx`
- `apps/web/src/app/marketing/site/editor/editor.tsx`
- `apps/web/src/app/marketing/site/editor/fields.tsx`
- `apps/web/src/app/marketing/site/editor/forms.tsx`
- `apps/web/src/app/marketing/site/editor/knowledge.tsx`
- `apps/web/src/app/marketing/site/editor/overlays.tsx`
- `apps/web/src/app/marketing/site/editor/page.tsx`
- `apps/web/src/app/marketing/site/editor/preview.tsx`
- `apps/web/src/app/marketing/site/editor/structure.tsx`
- `apps/web/src/app/marketing/site/page.tsx`
- `apps/web/src/app/onboarding/onboarding-form.tsx`
- `apps/web/src/app/onboarding/page.tsx`
- `apps/web/src/app/platform/clients-table.tsx`
- `apps/web/src/app/platform/data-connection.tsx`
- `apps/web/src/app/platform/forms.tsx`
- `apps/web/src/app/platform/overview.tsx`
- `apps/web/src/app/platform/own-organization.tsx`
- `apps/web/src/app/platform/page.tsx`
- `apps/web/src/app/platform/site-builder.tsx`
- `apps/web/src/app/platform/support/[[...section]]/page.tsx`
- `apps/web/src/app/platform/support/actions-view.tsx`
- `apps/web/src/app/platform/support/dialog-actions.tsx`
- `apps/web/src/app/platform/support/forms.tsx`
- `apps/web/src/app/platform/support/kb-forms.tsx`
- `apps/web/src/app/platform/support/kb-view.tsx`
- `apps/web/src/app/profile/profile-view.tsx`
- `apps/web/src/app/register/setup/shell.tsx`
- `apps/web/src/app/reports/finance/cashflow.tsx`
- `apps/web/src/app/reports/finance/page.tsx`
- `apps/web/src/app/reports/form-910/page.tsx`
- `apps/web/src/app/reports/occupancy/page.tsx`
- `apps/web/src/app/reports/overview/page.tsx`
- `apps/web/src/app/reports/page.tsx`
- `apps/web/src/app/reports/units/page.tsx`
- `apps/web/src/app/reservations/[number]/actions-panel.tsx`
- `apps/web/src/app/reservations/[number]/finance-panel.tsx`
- `apps/web/src/app/reservations/[number]/group-payment.tsx`
- `apps/web/src/app/reservations/[number]/page.tsx`
- `apps/web/src/app/reservations/[number]/payment-requests.tsx`
- `apps/web/src/app/reservations/dates-toggle.tsx`
- `apps/web/src/app/reservations/filters-toggle.tsx`
- `apps/web/src/app/reservations/loading.tsx`
- `apps/web/src/app/reservations/new/form.tsx`
- `apps/web/src/app/reservations/new/page.tsx`
- `apps/web/src/app/reservations/page.tsx`
- `apps/web/src/app/rooms/availability-finder.tsx`
- `apps/web/src/app/rooms/loading.tsx`
- `apps/web/src/app/sales/page.tsx`
- `apps/web/src/app/tasks/page.tsx`
- `apps/web/src/app/tasks/task-board.tsx`
- `apps/web/src/app/team/page.tsx`
- `apps/web/src/app/team/roles/page.tsx`
- `apps/web/src/app/team/scope-editor.tsx`
- `apps/web/src/app/team/team-board.tsx`
- `apps/web/src/app/today/food-today.tsx`
- `apps/web/src/app/today/vertical-day.tsx`
- `apps/web/src/app/units/[code]/page.tsx`
- `apps/web/src/app/units/[code]/unit-actions.tsx`
- `apps/web/src/app/units/[code]/unit-facts.tsx`
- `apps/web/src/app/website/analytics/loading.tsx`
- `apps/web/src/app/website/analytics/page.tsx`
- `apps/web/src/app/website/booking/page.tsx`
- `apps/web/src/app/website/forms.tsx`
- `apps/web/src/app/website/page.tsx`
- `apps/web/src/app/website/parts.tsx`
- `apps/web/src/app/website/settings/page.tsx`
- `apps/web/src/components/access-gate.tsx`
- `apps/web/src/components/action-menu.tsx`
- `apps/web/src/components/amount-chip.tsx`
- `apps/web/src/components/confirm-dialog.tsx`
- `apps/web/src/components/data-freshness.tsx`
- `apps/web/src/components/date-bar.tsx`
- `apps/web/src/components/date-field.tsx`
- `apps/web/src/components/day-bars.tsx`
- `apps/web/src/components/error-state.tsx`
- `apps/web/src/components/kpi-tile.tsx`
- `apps/web/src/components/page.tsx`
- `apps/web/src/components/period-picker.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`
- `apps/web/src/components/refresh-button.tsx`
- `apps/web/src/components/section-cards.tsx`
- `apps/web/src/components/shell/side-nav.tsx`
- `apps/web/src/components/shell/sidebar.tsx`
- `apps/web/src/components/toast.tsx`
- `apps/web/src/components/tooltip.tsx`
- `apps/web/src/components/use-confirm.tsx`
- `apps/web/src/lib/ai-seller.ts`
- `apps/web/src/lib/platform.ts`
- `apps/web/src/lib/support-actions.ts`

## icon: 108 файлов

- `apps/web/src/app/ai-seller/[[...section]]/overview.tsx`
- `apps/web/src/app/ai-seller/[[...section]]/page.tsx`
- `apps/web/src/app/bar/folio-sale-form.tsx`
- `apps/web/src/app/bar/operations/page.tsx`
- `apps/web/src/app/bar/page.tsx`
- `apps/web/src/app/bar/products/page.tsx`
- `apps/web/src/app/bar/receipts/new/page.tsx`
- `apps/web/src/app/bar/receipts/page.tsx`
- `apps/web/src/app/bar/sale-form.tsx`
- `apps/web/src/app/bar/stock-board.tsx`
- `apps/web/src/app/bar/suppliers/page.tsx`
- `apps/web/src/app/channels/[[...section]]/page.tsx`
- `apps/web/src/app/channels/events/[revisionId]/page.tsx`
- `apps/web/src/app/channels/events-table.tsx`
- `apps/web/src/app/channels/report.tsx`
- `apps/web/src/app/chessboard/board-filters-popover.tsx`
- `apps/web/src/app/chessboard/board-grid.tsx`
- `apps/web/src/app/chessboard/board-zoom.tsx`
- `apps/web/src/app/chessboard/free-menu.tsx`
- `apps/web/src/app/chessboard/page.tsx`
- `apps/web/src/app/chessboard/stay-preview.tsx`
- `apps/web/src/app/chessboard/unassigned-drawer.tsx`
- `apps/web/src/app/connections/page.tsx`
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/finance/cash.tsx`
- `apps/web/src/app/finance/day-attention.tsx`
- `apps/web/src/app/finance/overview.tsx`
- `apps/web/src/app/finance/owner-controls.tsx`
- `apps/web/src/app/finance/owner-dashboard.tsx`
- `apps/web/src/app/finance/page.tsx`
- `apps/web/src/app/finance/workspace.tsx`
- `apps/web/src/app/food/menu-board.tsx`
- `apps/web/src/app/guests/[id]/page.tsx`
- `apps/web/src/app/guests/guest-panel.tsx`
- `apps/web/src/app/guests/guests-search.tsx`
- `apps/web/src/app/guests/guests-table.tsx`
- `apps/web/src/app/guests/page.tsx`
- `apps/web/src/app/hotel-settings/[[...section]]/page.tsx`
- `apps/web/src/app/hotel-settings/card-model.ts`
- `apps/web/src/app/hotel-settings/catalogs.tsx`
- `apps/web/src/app/hotel-settings/media-blocks.tsx`
- `apps/web/src/app/hotel-settings/object-preview.tsx`
- `apps/web/src/app/hotel-settings/object-summaries.tsx`
- `apps/web/src/app/hotel-settings/settings-form.tsx`
- `apps/web/src/app/incidents/incident-list.tsx`
- `apps/web/src/app/inventory/category-catalog.tsx`
- `apps/web/src/app/inventory/docked-panel.tsx`
- `apps/web/src/app/inventory/inventory-catalog.tsx`
- `apps/web/src/app/inventory/page.tsx`
- `apps/web/src/app/inventory/photo-gallery.tsx`
- `apps/web/src/app/inventory/summary-tiles.tsx`
- `apps/web/src/app/inventory/unit-panel.tsx`
- `apps/web/src/app/inventory/unit-state.tsx`
- `apps/web/src/app/invite/[token]/accept-form.tsx`
- `apps/web/src/app/journal/page.tsx`
- `apps/web/src/app/login/check-email/check-email-panel.tsx`
- `apps/web/src/app/login/reset/reset-form.tsx`
- `apps/web/src/app/login/set-password/set-password-form.tsx`
- `apps/web/src/app/login/verify/verify-panel.tsx`
- `apps/web/src/app/management/analytics/toolbar.tsx`
- `apps/web/src/app/market/drawers.tsx`
- `apps/web/src/app/market/page.tsx`
- `apps/web/src/app/marketing/ads/page.tsx`
- `apps/web/src/app/marketing/content/page.tsx`
- `apps/web/src/app/marketing/page.tsx`
- `apps/web/src/app/marketing/parts.tsx`
- `apps/web/src/app/onboarding/onboarding-form.tsx`
- `apps/web/src/app/onboarding/page.tsx`
- `apps/web/src/app/platform/clients-table.tsx`
- `apps/web/src/app/platform/overview.tsx`
- `apps/web/src/app/platform/page.tsx`
- `apps/web/src/app/platform/support/[[...section]]/page.tsx`
- `apps/web/src/app/platform/support/kb-view.tsx`
- `apps/web/src/app/profile/access/access-panel.tsx`
- `apps/web/src/app/profile/profile-view.tsx`
- `apps/web/src/app/reports/page.tsx`
- `apps/web/src/app/reservations/[number]/page.tsx`
- `apps/web/src/app/reservations/dates-toggle.tsx`
- `apps/web/src/app/reservations/filters-toggle.tsx`
- `apps/web/src/app/reservations/page.tsx`
- `apps/web/src/app/sales/page.tsx`
- `apps/web/src/app/tasks/task-board.tsx`
- `apps/web/src/app/team/team-board.tsx`
- `apps/web/src/app/units/[code]/unit-actions.tsx`
- `apps/web/src/app/website/booking/page.tsx`
- `apps/web/src/app/website/forms.tsx`
- `apps/web/src/app/website/page.tsx`
- `apps/web/src/components/access-gate.tsx`
- `apps/web/src/components/action-menu.tsx`
- `apps/web/src/components/control-navigation.tsx`
- `apps/web/src/components/date-bar.tsx`
- `apps/web/src/components/date-field.tsx`
- `apps/web/src/components/day-bars.tsx`
- `apps/web/src/components/error-state.tsx`
- `apps/web/src/components/icon-field.tsx`
- `apps/web/src/components/kpi-tile.tsx`
- `apps/web/src/components/overlay.tsx`
- `apps/web/src/components/section-cards.tsx`
- `apps/web/src/components/shell/account-menu.tsx`
- `apps/web/src/components/shell/branch-switcher.tsx`
- `apps/web/src/components/shell/property-block.tsx`
- `apps/web/src/components/shell/search.tsx`
- `apps/web/src/components/shell/side-nav.tsx`
- `apps/web/src/components/shell/sidebar.tsx`
- `apps/web/src/components/toast.tsx`
- `apps/web/src/components/top-nav.tsx`
- `apps/web/src/components/ui.tsx`
- `apps/web/src/lib/navigation.ts`

## date-field: 19 файлов

- `apps/web/src/app/channels/report.tsx`
- `apps/web/src/app/chessboard/page.tsx`
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/finance/page.tsx`
- `apps/web/src/app/guests/[id]/guest-forms.tsx`
- `apps/web/src/app/guests/page.tsx`
- `apps/web/src/app/management/analytics/channels/channels.tsx`
- `apps/web/src/app/management/analytics/toolbar.tsx`
- `apps/web/src/app/market/page.tsx`
- `apps/web/src/app/platform/forms.tsx`
- `apps/web/src/app/platform/site-builder.tsx`
- `apps/web/src/app/reports/page.tsx`
- `apps/web/src/app/reservations/[number]/actions-panel.tsx`
- `apps/web/src/app/reservations/[number]/finance-panel.tsx`
- `apps/web/src/app/reservations/new/form.tsx`
- `apps/web/src/app/rooms/availability-finder.tsx`
- `apps/web/src/app/units/[code]/unit-actions.tsx`
- `apps/web/src/app/website/analytics/page.tsx`
- `apps/web/src/components/period-picker.tsx`

## period-picker: 4 файлов

- `apps/web/src/app/chessboard/page.tsx`
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/reservations/page.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`

## overlay: 30 файлов

- `apps/web/src/app/appointments/list.tsx`
- `apps/web/src/app/beauty/journal.tsx`
- `apps/web/src/app/beauty/masters/board.tsx`
- `apps/web/src/app/beauty/schedule/board.tsx`
- `apps/web/src/app/beauty/services/board.tsx`
- `apps/web/src/app/channels/channel-connect.tsx`
- `apps/web/src/app/chessboard/unassigned-drawer.tsx`
- `apps/web/src/app/finance/cash.tsx`
- `apps/web/src/app/finance/owner-controls.tsx`
- `apps/web/src/app/food/catalog-form.tsx`
- `apps/web/src/app/food/employees-board.tsx`
- `apps/web/src/app/food/menu-board.tsx`
- `apps/web/src/app/food/order-drawer.tsx`
- `apps/web/src/app/food/payroll-board.tsx`
- `apps/web/src/app/food/reservation-drawer.tsx`
- `apps/web/src/app/hotel-settings/catalogs.tsx`
- `apps/web/src/app/hotel-settings/object-preview.tsx`
- `apps/web/src/app/inventory/category-preview.tsx`
- `apps/web/src/app/inventory/fund-editor.tsx`
- `apps/web/src/app/inventory/photo-gallery.tsx`
- `apps/web/src/app/market/drawers.tsx`
- `apps/web/src/app/marketing/site/editor/overlays.tsx`
- `apps/web/src/app/reservations/[number]/finance-panel.tsx`
- `apps/web/src/app/tasks/task-board.tsx`
- `apps/web/src/app/team/team-board.tsx`
- `apps/web/src/app/website/forms.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`
- `apps/web/src/components/route-drawer.tsx`
- `apps/web/src/components/shell/search.tsx`
- `apps/web/src/components/top-nav.tsx`

## confirm-dialog: 3 файлов

- `apps/web/src/app/design-system/demos.tsx`
- `apps/web/src/app/reservations/[number]/actions-panel.tsx`
- `apps/web/src/components/use-confirm.tsx`

## use-confirm: 23 файлов

- `apps/web/src/app/bar/stock-board.tsx`
- `apps/web/src/app/beauty/appointment-card.tsx`
- `apps/web/src/app/beauty/schedule/board.tsx`
- `apps/web/src/app/channels/channel-connect.tsx`
- `apps/web/src/app/chessboard/board-grid.tsx`
- `apps/web/src/app/chessboard/stay-preview.tsx`
- `apps/web/src/app/chessboard/unassigned-drawer.tsx`
- `apps/web/src/app/finance/cash.tsx`
- `apps/web/src/app/guests/[id]/guest-forms.tsx`
- `apps/web/src/app/inventory/category-catalog.tsx`
- `apps/web/src/app/market/drawers.tsx`
- `apps/web/src/app/marketing/site/assets/board.tsx`
- `apps/web/src/app/marketing/site/board.tsx`
- `apps/web/src/app/marketing/site/editor/editor.tsx`
- `apps/web/src/app/platform/forms.tsx`
- `apps/web/src/app/platform/support/dialog-actions.tsx`
- `apps/web/src/app/platform/support/kb-forms.tsx`
- `apps/web/src/app/reservations/[number]/actions-panel.tsx`
- `apps/web/src/app/reservations/[number]/finance-panel.tsx`
- `apps/web/src/app/reservations/[number]/payment-requests.tsx`
- `apps/web/src/app/team/team-board.tsx`
- `apps/web/src/app/units/[code]/unit-actions.tsx`
- `apps/web/src/app/website/forms.tsx`

## route-drawer: 5 файлов

- `apps/web/src/app/@drawer/(.)reservations/[number]/page.tsx`
- `apps/web/src/app/@drawer/(.)reservations/new/page.tsx`
- `apps/web/src/app/@drawer/error.tsx`
- `apps/web/src/app/inventory/@drawer/error.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`

## kpi-tile: 2 файлов

- `apps/web/src/app/ai-seller/[[...section]]/overview.tsx`
- `apps/web/src/app/sales/page.tsx`

## tabs: 26 файлов

- `apps/web/src/app/bar/operations/page.tsx`
- `apps/web/src/app/bar/products/page.tsx`
- `apps/web/src/app/bar/receipts/new/page.tsx`
- `apps/web/src/app/bar/receipts/page.tsx`
- `apps/web/src/app/bar/stock-board.tsx`
- `apps/web/src/app/bar/suppliers/page.tsx`
- `apps/web/src/app/bar/tabs.tsx`
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/food/customers.tsx`
- `apps/web/src/app/food/payroll-board.tsx`
- `apps/web/src/app/guests/[id]/page.tsx`
- `apps/web/src/app/guests/guest-panel.tsx`
- `apps/web/src/app/hotel-settings/[[...section]]/page.tsx`
- `apps/web/src/app/inventory/unit-panel.tsx`
- `apps/web/src/app/management/analytics/channels/page.tsx`
- `apps/web/src/app/management/analytics/hospitality-page.tsx`
- `apps/web/src/app/management/analytics/occupancy/page.tsx`
- `apps/web/src/app/management/analytics/units/page.tsx`
- `apps/web/src/app/market/drawers.tsx`
- `apps/web/src/app/marketing/ads/page.tsx`
- `apps/web/src/app/marketing/content/page.tsx`
- `apps/web/src/app/profile/profile-view.tsx`
- `apps/web/src/app/reports/reports-tabs.tsx`
- `apps/web/src/app/reservations/[number]/page.tsx`
- `apps/web/src/components/primitives.test.ts`
- `apps/web/src/components/segmented.tsx`

## toolbar: 12 файлов

- `apps/web/src/app/chessboard/page.tsx`
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/guests/page.tsx`
- `apps/web/src/app/management/analytics/hospitality-page.tsx`
- `apps/web/src/app/management/analytics/occupancy/page.tsx`
- `apps/web/src/app/management/analytics/units/page.tsx`
- `apps/web/src/app/reports/finance/page.tsx`
- `apps/web/src/app/reports/occupancy/page.tsx`
- `apps/web/src/app/reports/overview/page.tsx`
- `apps/web/src/app/reports/units/page.tsx`
- `apps/web/src/app/reservations/page.tsx`
- `apps/web/src/components/primitives.test.ts`

## form-grid: 3 файлов

- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/food/reservation-form.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`

## switch: 2 файлов

- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/hotel-settings/settings-form.tsx`

## line-chart: 2 файлов

- `apps/web/src/app/management/analytics/overview.tsx`
- `apps/web/src/app/today/food-today.tsx`

## day-bars: 2 файлов

- `apps/web/src/app/management/analytics/overview.tsx`
- `apps/web/src/app/platform/overview.tsx`

## donut-share: 2 файлов

- `apps/web/src/app/management/analytics/overview.tsx`
- `apps/web/src/app/platform/overview.tsx`

## share-bar: 5 файлов

- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/finance/overview.tsx`
- `apps/web/src/app/reports/finance/cashflow.tsx`
- `apps/web/src/app/website/analytics/page.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`

## action-menu: 11 файлов

- `apps/web/src/app/bar/page.tsx`
- `apps/web/src/app/bar/stock-board.tsx`
- `apps/web/src/app/channels/channel-connect.tsx`
- `apps/web/src/app/chessboard/board-grid.tsx`
- `apps/web/src/app/chessboard/housekeeping-menu.tsx`
- `apps/web/src/app/design-system/demos.tsx`
- `apps/web/src/app/guests/guests-table.tsx`
- `apps/web/src/app/inventory/add-menu.tsx`
- `apps/web/src/app/inventory/category-catalog.tsx`
- `apps/web/src/app/inventory/inventory-catalog.tsx`
- `apps/web/src/app/marketing/page.tsx`

## error-state: 8 файлов

- `apps/web/src/app/@drawer/error.tsx`
- `apps/web/src/app/design-system/demos.tsx`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/guests/error.tsx`
- `apps/web/src/app/inventory/@drawer/error.tsx`
- `apps/web/src/app/reservations/error.tsx`
- `apps/web/src/components/load-error.tsx`
- `apps/web/src/components/primitives-ds1c.test.ts`

## load-error: 43 файлов

- `apps/web/src/app/ai-agents/[id]/page.tsx`
- `apps/web/src/app/ai-agents/new/page.tsx`
- `apps/web/src/app/ai-agents/page.tsx`
- `apps/web/src/app/ai-seller/[[...section]]/page.tsx`
- `apps/web/src/app/appointments/page.tsx`
- `apps/web/src/app/beauty/masters/page.tsx`
- `apps/web/src/app/beauty/page.tsx`
- `apps/web/src/app/beauty/schedule/page.tsx`
- `apps/web/src/app/beauty/services/page.tsx`
- `apps/web/src/app/branches/workspace.tsx`
- `apps/web/src/app/channels/[[...section]]/page.tsx`
- `apps/web/src/app/channels/channel-list.tsx`
- `apps/web/src/app/channels/report.tsx`
- `apps/web/src/app/customers/page.tsx`
- `apps/web/src/app/finance/page.tsx`
- `apps/web/src/app/food/customers.tsx`
- `apps/web/src/app/food/employees-screen.tsx`
- `apps/web/src/app/food/screen.tsx`
- `apps/web/src/app/guests/page.tsx`
- `apps/web/src/app/hotel-settings/[[...section]]/page.tsx`
- `apps/web/src/app/incidents/page.tsx`
- `apps/web/src/app/invite/[token]/page.tsx`
- `apps/web/src/app/journal/page.tsx`
- `apps/web/src/app/kitchen/page.tsx`
- `apps/web/src/app/management/analytics/channels/channels.tsx`
- `apps/web/src/app/management/analytics/occupancy/occupancy.tsx`
- `apps/web/src/app/management/analytics/overview.tsx`
- `apps/web/src/app/management/analytics/units/units.tsx`
- `apps/web/src/app/market/page.tsx`
- `apps/web/src/app/marketing/site/assets/page.tsx`
- `apps/web/src/app/marketing/site/editor/page.tsx`
- `apps/web/src/app/marketing/site/page.tsx`
- `apps/web/src/app/menu/page.tsx`
- `apps/web/src/app/orders/page.tsx`
- `apps/web/src/app/payroll/page.tsx`
- `apps/web/src/app/platform/page.tsx`
- `apps/web/src/app/platform/support/[[...section]]/page.tsx`
- `apps/web/src/app/platform/support/kb-view.tsx`
- `apps/web/src/app/reports/finance/cashflow.tsx`
- `apps/web/src/app/reservations/page.tsx`
- `apps/web/src/app/today/beauty-today.tsx`
- `apps/web/src/app/today/food-today.tsx`
- `apps/web/src/app/website/analytics/page.tsx`

## Источники CSS-риска

Порядок слоёв globals.css: reset < tokens < base < components < sections < utilities. Основной владелец примитивов: apps/web/src/app/components.css. premium.css/workspace.css и CSS разделов могут перекрывать контракт. Комментарий ui.tsx о стилях только в globals.css устарел.

- `apps/web/src/app/ai-seller/agents/agents.css`
- `apps/web/src/app/ai-seller/ai-seller.css`
- `apps/web/src/app/bar/bar.css`
- `apps/web/src/app/branches/branches.css`
- `apps/web/src/app/channels/channels.css`
- `apps/web/src/app/chessboard/board.css`
- `apps/web/src/app/components.css`
- `apps/web/src/app/connections/integrations.css`
- `apps/web/src/app/directory.css`
- `apps/web/src/app/finance/finance.css`
- `apps/web/src/app/food/restaurant.css`
- `apps/web/src/app/guests/guests-bookings.css`
- `apps/web/src/app/guests/guests.css`
- `apps/web/src/app/hotel-settings/settings.css`
- `apps/web/src/app/incidents/incidents.css`
- `apps/web/src/app/inventory/fund.css`
- `apps/web/src/app/inventory/inventory.css`
- `apps/web/src/app/journal/journal.css`
- `apps/web/src/app/management/analytics/analytics.css`
- `apps/web/src/app/market/market.css`
- `apps/web/src/app/marketing/marketing.css`
- `apps/web/src/app/onboarding/onboarding.css`
- `apps/web/src/app/platform/organizations.css`
- `apps/web/src/app/premium.css`
- `apps/web/src/app/reports/reports.css`
- `apps/web/src/app/reservations/new/booking-compact.css`
- `apps/web/src/app/reservations/reservations.css`
- `apps/web/src/app/sales/sales.css`
- `apps/web/src/app/workspace.css`
- `apps/web/src/components/shell/sidebar.css`
