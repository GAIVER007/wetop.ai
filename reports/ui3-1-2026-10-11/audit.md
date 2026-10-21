> Историческая основа планирования на базе 955b43f70. После команды владельца начат только UI3.1 в отдельной копии актуального main. Текущие файлы, доказательства и ограничения: [протокол реализации](implementation.md).

# MASTER UI/UX AUDIT MATRIX: предварительная инвентаризация

Дата: 11.10.2026. Уточнённая спецификация: [UI3.0/UI3.1](ui3-0-ui3-1-spec.md). Ветка `recovery/owner-design-v2-20261010`, HEAD `955b43f70`.
Это статический реестр, не завершённый визуальный аудит. OK/MINOR/MAJOR/CRITICAL присваиваются только после осмотра реального интерфейса. Динамические сегменты обозначают шаблоны URL; intercept/slot не считаются самостоятельными страницами. Редиректы требуют отдельной проверки. CSS указан только по прямым импортам, общие стили и стили дочерних компонентов дополнить при проходе каждого раздела.

| Раздел | Маршрут | Состояние | Основные проблемы | Референс | Решение | Приоритет |
|---|---|---|---|---|---|---|
| Оболочка | Все защищённые страницы | Визуально не проверено | top-menu.tsx реализует горизонтальные вкладки; последнее уточнение владельца требует скрытое меню под одной кнопкой | Изображение 1 | UI3.1: скрытая навигация, сохранение реестра доступа | P0 |
| Шахматка | /chessboard | Визуально не проверено | page.tsx использует отдельные BoardMenu для периода и длины, сегменты День/Неделя/Месяц; вместо единого окна из образца | Изображения 1 и 2 | UI3.3: единая композиция периода и сетки | P0 |
| Остальные разделы | Реестр ниже | Не проверено | Требуется браузерный проход, отсутствие дефектов не доказано | Другие макеты не предоставлены в этой задаче | Текущая дизайн-система и общие компоненты | P1/P2 |

## Реестр файлов маршрутов

| Маршрут | Компонент | Layout | Используемые стили | UI-проблемы | Сложность | Приоритет |
|---|---|---|---|---|---|---|
| web: /[id]/preview (intercept/slot) | `apps/web/src/app/@drawer/(.)guests/[id]/preview/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /[number] (intercept/slot) | `apps/web/src/app/@drawer/(.)reservations/[number]/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /new (intercept/slot) | `apps/web/src/app/@drawer/(.)reservations/new/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /[...catchAll] (intercept/slot) | `apps/web/src/app/@drawer/[...catchAll]/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /ai-agents/[id] | `apps/web/src/app/ai-agents/[id]/page.tsx` | `apps/web/src/app/layout.tsx` | ../ai-agents.css | Не проверено в браузере | После осмотра | P2 |
| web: /ai-agents/new | `apps/web/src/app/ai-agents/new/page.tsx` | `apps/web/src/app/layout.tsx` | ../ai-agents.css | Не проверено в браузере | После осмотра | P2 |
| web: /ai-agents | `apps/web/src/app/ai-agents/page.tsx` | `apps/web/src/app/layout.tsx` | ./ai-agents.css | Не проверено в браузере | После осмотра | P2 |
| web: /ai-seller/[[...section]] | `apps/web/src/app/ai-seller/[[...section]]/page.tsx` | `apps/web/src/app/layout.tsx` | ../ai-seller.css | Не проверено в браузере | После осмотра | P2 |
| web: /ai-seller/agents/[id] | `apps/web/src/app/ai-seller/agents/[id]/page.tsx` | `apps/web/src/app/layout.tsx` | ../agents.css, ../../../create/wizard.css | Не проверено в браузере | После осмотра | P2 |
| web: /ai-seller/agents/new | `apps/web/src/app/ai-seller/agents/new/page.tsx` | `apps/web/src/app/layout.tsx` | ../../agents/agents.css, ../../../create/wizard.css | Не проверено в браузере | После осмотра | P2 |
| web: /ai-seller/agents | `apps/web/src/app/ai-seller/agents/page.tsx` | `apps/web/src/app/layout.tsx` | ./agents.css | Не проверено в браузере | После осмотра | P2 |
| web: /appointments | `apps/web/src/app/appointments/page.tsx` | `apps/web/src/app/layout.tsx` | ../beauty/beauty.css | Не проверено в браузере | После осмотра | P2 |
| web: /bar/operations | `apps/web/src/app/bar/operations/page.tsx` | `apps/web/src/app/layout.tsx` | ../bar.css | Не проверено в браузере | После осмотра | P2 |
| web: /bar | `apps/web/src/app/bar/page.tsx` | `apps/web/src/app/layout.tsx` | ./bar.css | Не проверено в браузере | После осмотра | P2 |
| web: /bar/products | `apps/web/src/app/bar/products/page.tsx` | `apps/web/src/app/layout.tsx` | ../bar.css | Не проверено в браузере | После осмотра | P2 |
| web: /bar/receipts/new | `apps/web/src/app/bar/receipts/new/page.tsx` | `apps/web/src/app/layout.tsx` | ../../bar.css | Не проверено в браузере | После осмотра | P2 |
| web: /bar/receipts | `apps/web/src/app/bar/receipts/page.tsx` | `apps/web/src/app/layout.tsx` | ../bar.css | Не проверено в браузере | После осмотра | P2 |
| web: /bar/suppliers | `apps/web/src/app/bar/suppliers/page.tsx` | `apps/web/src/app/layout.tsx` | ../bar.css | Не проверено в браузере | После осмотра | P2 |
| web: /beauty/masters | `apps/web/src/app/beauty/masters/page.tsx` | `apps/web/src/app/layout.tsx` | ../beauty.css | Не проверено в браузере | После осмотра | P2 |
| web: /beauty | `apps/web/src/app/beauty/page.tsx` | `apps/web/src/app/layout.tsx` | ./beauty.css | Не проверено в браузере | После осмотра | P2 |
| web: /beauty/schedule | `apps/web/src/app/beauty/schedule/page.tsx` | `apps/web/src/app/layout.tsx` | ../beauty.css | Не проверено в браузере | После осмотра | P2 |
| web: /beauty/services | `apps/web/src/app/beauty/services/page.tsx` | `apps/web/src/app/layout.tsx` | ../beauty.css | Не проверено в браузере | После осмотра | P2 |
| web: /branches | `apps/web/src/app/branches/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /calendar | `apps/web/src/app/calendar/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /channel-manager | `apps/web/src/app/channel-manager/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /channels/[[...section]] | `apps/web/src/app/channels/[[...section]]/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css, ../channels.css | Не проверено в браузере | После осмотра | P2 |
| web: /channels/events/[revisionId] | `apps/web/src/app/channels/events/[revisionId]/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /channels | `apps/web/src/app/channels/page.tsx` | `apps/web/src/app/layout.tsx` | ../directory.css | Не проверено в браузере | После осмотра | P2 |
| web: /chessboard | `apps/web/src/app/chessboard/page.tsx` | `apps/web/src/app/layout.tsx` | ./board.css | Не проверено в браузере | После осмотра | P0 |
| web: /connections/channex | `apps/web/src/app/connections/channex/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /connections | `apps/web/src/app/connections/page.tsx` | `apps/web/src/app/layout.tsx` | ./integrations.css | Не проверено в браузере | После осмотра | P2 |
| web: /create | `apps/web/src/app/create/page.tsx` | `apps/web/src/app/layout.tsx` | ./wizard.css | Не проверено в браузере | После осмотра | P2 |
| web: /customers | `apps/web/src/app/customers/page.tsx` | `apps/web/src/app/layout.tsx` | ../beauty/beauty.css | Не проверено в браузере | После осмотра | P2 |
| web: /design-system | `apps/web/src/app/design-system/page.tsx` | `apps/web/src/app/layout.tsx` | ./kit.css | Не проверено в браузере | После осмотра | P2 |
| web: /dining-areas | `apps/web/src/app/dining-areas/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /employees | `apps/web/src/app/employees/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /finance | `apps/web/src/app/finance/page.tsx` | `apps/web/src/app/layout.tsx` | ../directory.css, ./finance.css, ./owner-dashboard.css, ./attention.css, ./overview.css | Не проверено в браузере | После осмотра | P2 |
| web: /floor-plan | `apps/web/src/app/floor-plan/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /guests/[id] | `apps/web/src/app/guests/[id]/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css, ../guests.css | Не проверено в браузере | После осмотра | P1 |
| web: /guests/[id]/preview | `apps/web/src/app/guests/[id]/preview/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P1 |
| web: /guests/birthdays | `apps/web/src/app/guests/birthdays/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P1 |
| web: /guests | `apps/web/src/app/guests/page.tsx` | `apps/web/src/app/layout.tsx` | ./guests-bookings.css | Не проверено в браузере | После осмотра | P1 |
| web: /help | `apps/web/src/app/help/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /hotel-settings/[[...section]] | `apps/web/src/app/hotel-settings/[[...section]]/page.tsx` | `apps/web/src/app/layout.tsx` | ../settings.css | Не проверено в браузере | После осмотра | P2 |
| web: /incidents | `apps/web/src/app/incidents/page.tsx` | `apps/web/src/app/layout.tsx` | ./incidents.css | Не проверено в браузере | После осмотра | P2 |
| web: /inventory/[code] (intercept/slot) | `apps/web/src/app/inventory/@drawer/(..)units/[code]/page.tsx` | `apps/web/src/app/layout.tsx`<br>`apps/web/src/app/inventory/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P1 |
| web: /inventory (intercept/slot) | `apps/web/src/app/inventory/@drawer/page.tsx` | `apps/web/src/app/layout.tsx`<br>`apps/web/src/app/inventory/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /inventory | `apps/web/src/app/inventory/page.tsx` | `apps/web/src/app/layout.tsx`<br>`apps/web/src/app/inventory/layout.tsx` | ./fund.css, ./inventory.css | Не проверено в браузере | После осмотра | P1 |
| web: /invite/[token] | `apps/web/src/app/invite/[token]/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /journal | `apps/web/src/app/journal/page.tsx` | `apps/web/src/app/layout.tsx` | ./journal.css, ../directory.css | Не проверено в браузере | После осмотра | P2 |
| web: /login/check-email | `apps/web/src/app/login/check-email/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /login | `apps/web/src/app/login/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /login/reset | `apps/web/src/app/login/reset/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /login/set-password | `apps/web/src/app/login/set-password/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /login/verify | `apps/web/src/app/login/verify/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /management/[[...section]] | `apps/web/src/app/management/[[...section]]/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /management/analytics/channels | `apps/web/src/app/management/analytics/channels/page.tsx` | `apps/web/src/app/layout.tsx` | ../analytics.css | Не проверено в браузере | После осмотра | P2 |
| web: /management/analytics/occupancy | `apps/web/src/app/management/analytics/occupancy/page.tsx` | `apps/web/src/app/layout.tsx` | ../analytics.css | Не проверено в браузере | После осмотра | P2 |
| web: /management/analytics | `apps/web/src/app/management/analytics/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /management/analytics/units | `apps/web/src/app/management/analytics/units/page.tsx` | `apps/web/src/app/layout.tsx` | ../analytics.css | Не проверено в браузере | После осмотра | P2 |
| web: /market | `apps/web/src/app/market/page.tsx` | `apps/web/src/app/layout.tsx` | ../directory.css, ./market.css | Не проверено в браузере | После осмотра | P2 |
| web: /marketing/ads | `apps/web/src/app/marketing/ads/page.tsx` | `apps/web/src/app/layout.tsx` | ../marketing.css | Не проверено в браузере | После осмотра | P2 |
| web: /marketing/content | `apps/web/src/app/marketing/content/page.tsx` | `apps/web/src/app/layout.tsx` | ../marketing.css | Не проверено в браузере | После осмотра | P2 |
| web: /marketing | `apps/web/src/app/marketing/page.tsx` | `apps/web/src/app/layout.tsx` | ./marketing.css | Не проверено в браузере | После осмотра | P2 |
| web: /marketing/site/assets | `apps/web/src/app/marketing/site/assets/page.tsx` | `apps/web/src/app/layout.tsx` | ../../marketing.css | Не проверено в браузере | После осмотра | P2 |
| web: /marketing/site/editor | `apps/web/src/app/marketing/site/editor/page.tsx` | `apps/web/src/app/layout.tsx` | ../../marketing.css | Не проверено в браузере | После осмотра | P2 |
| web: /marketing/site | `apps/web/src/app/marketing/site/page.tsx` | `apps/web/src/app/layout.tsx` | ../marketing.css | Не проверено в браузере | После осмотра | P2 |
| web: /onboarding | `apps/web/src/app/onboarding/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: / | `apps/web/src/app/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /platform | `apps/web/src/app/platform/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /platform/support/[[...section]] | `apps/web/src/app/platform/support/[[...section]]/page.tsx` | `apps/web/src/app/layout.tsx` | ../../../ai-seller/ai-seller.css, ../support.css | Не проверено в браузере | После осмотра | P2 |
| web: /profile/access | `apps/web/src/app/profile/access/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /profile | `apps/web/src/app/profile/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /rates/[[...rest]] | `apps/web/src/app/rates/[[...rest]]/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /register/complete | `apps/web/src/app/register/complete/page.tsx` | `apps/web/src/app/layout.tsx` | ../../login/login.css, ./complete.css | Не проверено в браузере | После осмотра | P2 |
| web: /register | `apps/web/src/app/register/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /register/setup | `apps/web/src/app/register/setup/page.tsx` | `apps/web/src/app/layout.tsx` | ../../onboarding/onboarding.css, ./setup.css | Не проверено в браузере | После осмотра | P2 |
| web: /reports/finance | `apps/web/src/app/reports/finance/page.tsx` | `apps/web/src/app/layout.tsx` | ../../management/analytics/analytics.css, ../../directory.css, ../reports.css | Не проверено в браузере | После осмотра | P2 |
| web: /reports/form-910 | `apps/web/src/app/reports/form-910/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css, ../reports.css | Не проверено в браузере | После осмотра | P2 |
| web: /reports/occupancy | `apps/web/src/app/reports/occupancy/page.tsx` | `apps/web/src/app/layout.tsx` | ../../management/analytics/analytics.css, ../../directory.css, ../reports.css | Не проверено в браузере | После осмотра | P2 |
| web: /reports/overview | `apps/web/src/app/reports/overview/page.tsx` | `apps/web/src/app/layout.tsx` | ../../management/analytics/analytics.css, ../../directory.css, ../reports.css | Не проверено в браузере | После осмотра | P2 |
| web: /reports | `apps/web/src/app/reports/page.tsx` | `apps/web/src/app/layout.tsx` | ../directory.css, ./reports.css | Не проверено в браузере | После осмотра | P2 |
| web: /reports/print | `apps/web/src/app/reports/print/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /reports/units | `apps/web/src/app/reports/units/page.tsx` | `apps/web/src/app/layout.tsx` | ../../management/analytics/analytics.css, ../../directory.css, ../reports.css | Не проверено в браузере | После осмотра | P2 |
| web: /reservations/[number] | `apps/web/src/app/reservations/[number]/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css | Не проверено в браузере | После осмотра | P1 |
| web: /reservations/[number]/print/contract | `apps/web/src/app/reservations/[number]/print/contract/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P1 |
| web: /reservations/[number]/print/invoice | `apps/web/src/app/reservations/[number]/print/invoice/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P1 |
| web: /reservations/[number]/print | `apps/web/src/app/reservations/[number]/print/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P1 |
| web: /reservations/new | `apps/web/src/app/reservations/new/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css, ./booking-compact.css | Не проверено в браузере | После осмотра | P1 |
| web: /reservations | `apps/web/src/app/reservations/page.tsx` | `apps/web/src/app/layout.tsx` | ../directory.css, ./reservations.css | Не проверено в браузере | После осмотра | P1 |
| web: /rooms/[[...section]] | `apps/web/src/app/rooms/[[...section]]/page.tsx` | `apps/web/src/app/layout.tsx` | ../../inventory/inventory.css, ../../inventory/fund.css | Не проверено в браузере | После осмотра | P1 |
| web: /services | `apps/web/src/app/services/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /staff | `apps/web/src/app/staff/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /status | `apps/web/src/app/status/page.tsx` | `apps/web/src/app/layout.tsx` | ./status.css | Не проверено в браузере | После осмотра | P2 |
| web: /table-reservations | `apps/web/src/app/table-reservations/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /tasks | `apps/web/src/app/tasks/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /team | `apps/web/src/app/team/page.tsx` | `apps/web/src/app/layout.tsx` | ./team.css | Не проверено в браузере | После осмотра | P2 |
| web: /team/roles | `apps/web/src/app/team/roles/page.tsx` | `apps/web/src/app/layout.tsx` | ../team.css | Не проверено в браузере | После осмотра | P2 |
| web: /today | `apps/web/src/app/today/page.tsx` | `apps/web/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| web: /units/[code] | `apps/web/src/app/units/[code]/page.tsx` | `apps/web/src/app/layout.tsx` | ../../inventory/inventory.css | Не проверено в браузере | После осмотра | P2 |
| web: /website/analytics | `apps/web/src/app/website/analytics/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css, ../website.css | Не проверено в браузере | После осмотра | P2 |
| web: /website/booking | `apps/web/src/app/website/booking/page.tsx` | `apps/web/src/app/layout.tsx` | ../website.css | Не проверено в браузере | После осмотра | P2 |
| web: /website | `apps/web/src/app/website/page.tsx` | `apps/web/src/app/layout.tsx` | ./website.css | Не проверено в браузере | После осмотра | P2 |
| web: /website/settings | `apps/web/src/app/website/settings/page.tsx` | `apps/web/src/app/layout.tsx` | ../../directory.css, ../website.css | Не проверено в браузере | После осмотра | P2 |
| site: /blog/[[...slug]] | `apps/site/src/app/blog/[[...slug]]/page.tsx` | `apps/site/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| site: /calculator | `apps/site/src/app/calculator/page.tsx` | `apps/site/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| site: /for/[segment] | `apps/site/src/app/for/[segment]/page.tsx` | `apps/site/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| site: / | `apps/site/src/app/page.tsx` | `apps/site/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| site: /privacy | `apps/site/src/app/privacy/page.tsx` | `apps/site/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
| site: /terms | `apps/site/src/app/terms/page.tsx` | `apps/site/src/app/layout.tsx` | Нет прямого CSS-импорта; проверить зависимости | Не проверено в браузере | После осмотра | P2 |
