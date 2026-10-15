# UI4: маршруты и визуальные референсы

Источник: `WETOP_UIUX_references_package.zip`, предоставлен владельцем 12.10.2026. Все 22 изображения находятся рядом с этим файлом; 13.10.2026 владелец добавил два: шахматку и финансы. `README_FIRST.md` является пояснением к концептам, не спецификацией данных или функций. Перед изменением конкретного экрана нужен browser screenshot текущего состояния и сверка с действующими `DESIGN.md`, токенами и доменным контрактом.

| Маршрут | Референс | Существующие компоненты и экран | Требуемое изменение |
|---|---|---|---|
| `/chessboard` | **с 13.10.2026 `01_hospitality/chessboard_owner_2026-10-13.webp`** (заменил `chessboard_main.png`, тот остаётся историей); `chessboard_compact_alternative.png` для popover; `chessboard_reference_old.png` только исторический | `chessboard/page.tsx`, `board-grid.tsx`, `board.css`, `CalendarWorkspace`, shell | UI3.1: скрытое меню и удаление постоянной правой сводки. UI3.3: один контрол периода, плотная сетка и фильтры; сохранить бронь, даты и статусы. |
| `/inventory`, `/units/[code]` | `01_hospitality/inventory.png` | inventory catalog, `Table`, `Panel`, route drawer | Сравнить шапку, фильтры, группировку и детали; действия только из существующего API. |
| `/guests`, `/reservations`, `/reservations/[number]` | `01_hospitality/guests_and_reservations.png` | guest directory, reservation list, booking drawer, `Table`, `Badge` | Плотные списки и карточка гостя; не объединять существующие маршруты без отдельного решения. |
| `/management`, `/branches` | `02_business/organizations.png`; `organizations_variant.png` как альтернативная композиция | management screen, branch list, `Panel`, `Table`, branch switcher | Сверить иерархию Organization/Business/Location, карточки и филиалы; не переносить макетные суммы. |
| `/create`, `/onboarding` | `02_business/create_organization.png` | existing creation/onboarding forms, `Field`, `Panel`, `Overlay` | Проверить реальный сценарий создания и доступные поля до визуальной доработки формы. |
| `/hotel-settings` | `02_business/property_settings.png` | `hotel-settings/[[...section]]`, settings form, loading boundary | Уплотнить группы и поля после проверки перехода, загрузки и сохранения. |
| `/team`, `/employees`, `/team/roles` | `02_business/employees_access.png` | team screens, role controls, `Table`, `Field`, drawer | Единая таблица и форма приглашения при сохранении серверного RBAC. |
| `/finance`, `/today` | **с 13.10.2026 `03_finance_analytics/finance_owner_2026-10-13.webp`** (содержимое; левая колонка на нём не переносится, см. ниже); `owner_dashboard.png` история | finance owner blocks, today desk, chart components | Сверить операционный и финансовый обзор с фактическими источниками. Не смешивать выручку, поступления и прибыль. |
| `/reports`, `/reports/overview`, `/reports/finance`, `/reports/occupancy` | `03_finance_analytics/reports.png` | report hub, existing chart and table components | Уплотнить период, KPI и отчёты; оставить реальные реестры и экспорт. |
| `/management/analytics`, `/market` | `03_finance_analytics/analytics.png` для композиции; отдельные конкурентные референсы ниже | analytics screens, market charts | Использовать только соответствующие реальные метрики; в `analytics.png` показан конкурентный экран с условными цифрами. |
| `/bar`, `/bar/products`, `/bar/operations` | `03_finance_analytics/bar_stock.png` | bar pages, inventory table, forms | Сверить каталог, операции и детали; складские и финансовые проводки не менять. |
| `/sales` | `04_sales_marketing/sales_overview.png` | sales hub, existing KPI and recommendation cards | Композиция модулей по существующим данным; не обещать автоматический сбор или действия без API. |
| `/market` | `04_sales_marketing/competitors_combined.png`; `competitors_desktop_mobile.png` | market screen, competitor table, charts, filters | Сверить desktop/mobile; показывать происхождение данных и не выдавать публичные сигналы за фактическую загрузку. |
| `/marketing`, `/marketing/site`, `/marketing/ads`, `/marketing/content` | `04_sales_marketing/marketing_module_grid.png` | marketing hub and existing subroutes, `Panel`, `Button` | Модульная сетка и состояния подключения; недоступные возможности обозначить честно. |
| `/chessboard`, `/calendar`, `/floor-plan` | `05_verticals/three_calendar_concepts.png` | shared shell; hotel board, beauty calendar, food floor plan | Одинаковая оболочка, разные доменные календари. Restaurant: план зала и расписание резервов по существующей модели. |
| `apps/site` `/` | `06_public_site/desktop_full_page.png`, `desktop_variant.png`, `mobile_full_page.png` | public homepage, site tokens and sections | Отдельно сверить desktop/mobile и доступность. Тексты и доступность модулей брать из действующего продукта, не из генерации картинки. |

## Приоритет более поздних решений

- На всех рабочих экранах навигация скрыта под одной кнопкой. Постоянные левая колонка и нижняя mobile-панель на концептах не переносятся.
- На шахматке нет постоянной правой сводки «Сегодня» и пустого резерва под неё.
- Для шахматки один popover диапазона с пресетами и календарём; количество колонок следует действительной модели дат.
- Все макетные имена, проценты, суммы, статусы, логотипы каналов и предлагаемые операции считаются демонстрацией. Реальные данные и действия берутся только из поддерживаемого продукта.
- Более поздние решения владельца и действующий `DESIGN.md` имеют приоритет над альтернативными композициями и старыми концептами.
