# Что загружается в Claude Design (шаг 5 плана дизайн-системы)

Проект в Claude Design: **«WETOP — стойка»** (тип design-system). Главный источник — репозиторий; правка через
Remix в Claude Design переносится в `DESIGN.md` и `tokens.json` в тот же день (DESIGN.md §17).
**Список утверждён владельцем 14.09.2026.** Пакет собирается командой `npm run design:bundle` в
`design/claude-design-bundle/` (в git не идёт, есть `MANIFEST.md`); после утверждения — `DesignSync` из Claude Code,
запасной путь — загрузка теми же файлами через настройки организации в Claude Design.

## Загружается

| Путь в проекте Claude Design | Откуда | Зачем |
|---|---|---|
| `DESIGN.md` | `DESIGN.md` | правила, статусы, форматы, «почему» |
| `design/tokens.json` | `design/tokens.json` | токены DTCG 2025.10 (примитивы, семантика, темы) |
| `design/tokens.css` | `apps/web/src/app/tokens.css` | те же токены переменными CSS |
| `design/contrast.md` | `design/contrast.md` | таблица контраста |
| `components/*.tsx` | `apps/web/src/components/*.tsx` (12 файлов: ui, icon, page, overlay, route-drawer, record-tabs, data-freshness, action-menu, confirm-dialog, toast, tooltip, amount-badge) | код компонентов по именам |
| `components/shell/*.tsx` | `apps/web/src/components/shell/*.tsx` | меню, шапка, поиск |
| `components/css/*.css` | `apps/web/src/app/globals.css`, `premium.css`, `workspace.css`, `components.css` | классы компонентов |
| `design-system/page.tsx`, `design-system/showcase.tsx` | `apps/web/src/app/design-system/` | страница 31 компонента в восьми состояниях |
| `reference/kit/*.png` | `design/reference/kit/` (2 файла) | эталонные снимки страницы компонентов, светлая и тёмная |
| `reference/current/*.png` | `design/reference/current/` (26 файлов) | экраны как есть, на вымышленных данных |
| `reference/fonts/*` | `design/reference/fonts/` | отчёт и снимки проверки шрифтов |
| `brand/*` | `design/brand/` | знак WETOP и логотип Luxx Aparts — когда положит владелец |
| `prompts/*.md` | `design/prompts/` | промпты макетов (вход для шага 6) |

Всего около 60 файлов, данных гостей нет (ADR-010: имена вымышленные, скриншоты сняты на синтетическом API).

## Не загружается

- `design/reference/exely/` — скриншоты Exely: что загружено, попадёт в каждый макет (Д7).
- Весь репозиторий, `.git`, `node_modules`, `.env`, отчёты и данные объекта, `project-input/`.
- `design/docs/dtcg-2025.10/` — спецификация не нужна макетам.

## После загрузки — владелец

1. Пробный макет по `design/prompts/01-desk-layout.md`: проверить цвета статусов, шрифт, радиусы и имена
   компонентов.
2. Если всё верно — включить Published.
