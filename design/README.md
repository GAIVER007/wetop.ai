# design/ — сырьё дизайн-системы стойки WETOP

Папка заведена шагом 1 плана [`plans/design-system-2026-09-14.md`](../plans/design-system-2026-09-14.md)
(ADR-048). Правила интерфейса живут в [`DESIGN.md`](../DESIGN.md), токены — в [`tokens.json`](tokens.json).
Здесь — то, из чего они собраны и чем проверяются.

| Папка | Что лежит | В git | В Claude Design |
|---|---|---|---|
| `reference/exely/` | 7 скриншотов Exely с закрашенными фамилиями гостей — только для промптов макетов (шаг 6). Кладёт владелец из `project-input/exely-screens/`, предварительно закрасив или обрезав фамилии. Незакрашенные кадры агент не открывает | **нет** (`.gitignore`) | **нет** |
| `reference/current/` | Наши экраны на синтетическом API, 1440×1000, светлая и тёмная тема. Снимает `tests/ui/design-reference.spec.ts`; на снимках только псевдонимы | да | да |
| `reference/kit/` | Снимки секций страницы `/design-system` — эталон Playwright `toHaveScreenshot` (`tests/ui/design-system.spec.ts`). Имя включает платформу (`…-linux.png`, `…-darwin.png`): шрифты разные, у каждой машины свой эталон; на новой машине первый прогон — с `--update-snapshots` | да | да |
| `brand/` | Знак WETOP (`wetop-mark.svg`, копия `apps/web/src/app/icon.svg`); логотип Luxx Aparts и цвета бренда кладёт владелец | да | да |
| `docs/` | Спецификация W3C DTCG 2025.10 — см. `docs/README.md`: агенту доступ в сеть закрыт, файл кладёт владелец | да | нет |
| `prompts/` | Промпты макетов под наши имена, виды и данные (шаг 6) | да | нет |

## Как снять скриншоты заново

```sh
UI_BROWSER_CHANNEL=chromium npm run test:record -- e2e --config tests/ui/playwright.config.ts --workers=1 design-reference --note "снимки для дизайн-системы"
```

Без `UI_BROWSER_CHANNEL` конфигурация берёт установленный Google Chrome. Снимки делаются на синтетическом
API (`scripts/preview/fixture-api.ts`) после `POST /__test/design-seed`: он добавляет крайние случаи —
брони `TENTATIVE`, `CANCELLED`, `NO_SHOW`; шесть каналов, стойку и сайт; проживание без ячейки; блокировки с
причиной; три статуса уборки; длинные имена латиницей, кириллицей и с казахскими буквами; следующий месяц,
в котором заняты все 88 ячеек из 88; входящую ревизию Channex с ошибкой. Обычные UI-тесты этот набор не видят.

## Страница компонентов

`/design-system` открывается только при разработке (`next dev`; в production-сборке — 404) и показывает
токены, иконки и компоненты в восьми состояниях в обеих темах. Проверка:

```sh
UI_BROWSER_CHANNEL=chromium npm run test:record -- e2e --config tests/ui/playwright.config.ts --workers=1 design-system
```

Первый прогон на новой машине: добавить `--update-snapshots`, эталоны лягут в `reference/kit/`.
Изменил токен или компонент — `npm run design:diff -- <копия reference/current>` покажет, какие экраны
поменялись и где (`DESIGN.md` §18).

## Чего здесь нет и не будет

- Данных гостей объекта: скриншоты только с синтетического API (ADR-010, ADR-018).
- Скриншотов Exely в git и в Claude Design: что загружено в Claude Design, попадает в каждый макет.
- Ключей и `.env`.
