# MV8.5 DS0a: сторожа, шкала, договор о слоях, гейт вертикалей (план, 07.10.2026)

База: `origin/main` `33f3014a87d19334277df2ce74d2a7605b1c7dc4` (PR #261 влит). Источник: `plans/mv8-5-full-ui-ux-redesign-2026-10-07.md` §3 DS0a и §4, аудит `reports/ui-ux-audit-2026-10-07/README.md`.
Статус: **план на утверждение владельца. Кода нет.** По AGENTS.md §1 код пишется только после «да».

## 0. Что делает DS0a и чего не делает

Делает: ловит новый долг дизайна, записывает утверждённую шкалу и договор о слоях CSS, включает наборы салона, ресторана и филиалов в `release-checks`, описывает мёртвый код с доказательствами, удаляет `today/today-widgets.tsx`.

Не делает: не меняет стили экранов, разметку, навигацию, «Сегодня», API, схему, миграции, правила брони и поведение домена. Реестры статусов, кнопка без градиента, удаление темы `contrast`, сведение каскада, удаление `glass.css` и мёртвого CSS остаются DS0b, DS1 и DS8.

## 1. Факты на `33f3014a`

| Что | Число | Откуда |
|---|---|---|
| CSS-файлов в `apps/web/src` | 49 | `find` |
| Разных значений ширины в `@media` | 33 (всего 186 запросов) | `grep @media` |
| Из них уже на утверждённых точках | `max-width: 600px` 77+1, `min-width: 601px` 6, `max-width: 960px` 6, `min-width: 961px` 2, `max-width: 1279px` 7 | там же |
| `font-size` литералом в px | 85 в CSS, 39 `fontSize:` в TSX | `grep` |
| Отступы литералом px на шкале (4…64) | 826 | `grep` |
| `style={{` в TSX | 109 в 19 файлах | `grep` |
| `!important` | 25 | `grep` |
| `@layer` | 0 | `grep` |
| `matchMedia` с шириной в TSX | 2 (`chessboard/board-grid.tsx:444`, `board-position.ts:44`, оба 600) | `grep` |
| Импортов `today/today-widgets.tsx` | 0 (единственное вхождение `TodayWidgets` в самом файле); его классов `.tw-*` нет ни в одном CSS | `grep` по `apps`, `packages`, `tests`, `scripts` |
| Токены шкалы | `--space-1…16` (4…64), `--text-xs…4xl` (13…30), `--radius-xs/sm/control/default/lg/full`, `--weight-*`, `--focus-ring-w`, `--focus-ring-offset` уже есть | `tokens.css` |

Существующий сторож `tests/unit/design-slop.test.ts` уже работает храповиком: правило считает нарушения по файлам, снимок `design-slop.baseline.json` хранит «как сейчас», рост и уменьшение без обновления снимка дают красный. Новые правила встают в него же, второй механизм не нужен.

## 2. Новые сторожа

Все правила в `tests/unit/design-slop.test.ts` (массив `RULES`, тот же храповик и то же исключение `slop-allow`, те же пропуски `print/` и `design-system/`).

| Правило | Что ловит | Что разрешено | Остаток в снимке |
|---|---|---|---|
| `font-literal` | `font-size:` литералом (px, rem, em, число) в CSS и `fontSize:` в TSX | только `var(--text-*)`, `inherit` | около 124 |
| `space-literal-not-var` | отступ (`padding`, `margin`, `gap` и стороны) литералом px, даже на шкале | `0`, `var(--space-*)`, `auto`, `calc()` с токенами | около 826 |
| `inline-style` | `style={{` в TSX | строка с `slop-allow` и причиной (геометрия шахматки, проценты полос) | 109 |
| `breakpoint-literal` | ширина в `@media` (CSS) и в `matchMedia` (TSX) вне списка; любое `var()` внутри `@media`; единицы `rem` и `em` в ширине | ровно шесть литералов: `max-width: 600px`, `min-width: 601px`, `max-width: 960px`, `min-width: 961px`, `max-width: 1279px`, `min-width: 1280px` (вопрос 1) | около 75 |
| `layer-name` | `@layer` с именем вне договора | `reset, tokens, base, components, sections, utilities` | 0 |
| `orphan-module` | `.tsx` в `apps/web/src`, который никто не импортирует и который не файл маршрута Next (`page`, `layout`, `loading`, `error`, `not-found`, `template`, `default`, `route`) | нет | 0 после удаления `today-widgets.tsx` |

`font-under-12`, `space-off-scale`, `radius-literal` и остальные прежние правила не меняются.

**RED → GREEN для каждого правила.** Функции правил экспортируются из `design-slop.test.ts`, новый файл `tests/unit/design-guards.test.ts` проверяет каждое на подложенных образцах: нарушение даёт больше нуля, разрешённое значение даёт ноль.
1. RED: образцы написаны, правила ещё нет, тест красный (журнал `test:record`).
2. GREEN: правило добавлено, образцы зелёные.
3. RED храповика: проверка «снимок покрывает все правила» красная, пока снимок не обновлён.
4. GREEN: `DESIGN_SLOP_UPDATE=1`, снимок с новыми правилами закоммичен; остатки показаны в отчёте.

Для `orphan-module` RED на живом коде: сторож красный, пока лежит `today-widgets.tsx`, и зелёный после удаления.

## 3. Утверждённая шкала

- `DESIGN.md` §3 отступы, §5 радиусы, §6 шрифт: записать шкалу как закрытый список токенов (значения уже в `design/tokens.json`, не меняются).
- `DESIGN.md` §4: точки перелома 600 / 960 / 1280, шесть разрешённых литералов, запрет `var()` в `@media` с объяснением (CSS его там не понимает).
- Тест `tests/unit/design-scale.test.ts`: шкала в `tokens.json` совпадает с закрытым списком (space 4, 8, 16, 24, 32, 40, 48, 64; text 13, 14, 15, 17, 19, 22, 26, 30), список точек сторожа совпадает с `DESIGN.md` §4. RED: подменённое значение в копии данных даёт красный.

Токены не добавляются и не удаляются: веса и фокус уже есть. Мёртвые токены только в описи.

## 4. Договор о слоях CSS

`DESIGN.md` §20.6 «Слои каскада»: порядок `@layer reset, tokens, base, components, sections, utilities`, что лежит в каждом слое, кто пишет (примитив из `components/` только в `components`, экранный файл раздела только в `sections`), правило «экранный CSS импортирует свой маршрут, а не `layout.tsx`», запрет `!important` кроме `utilities`. Только документ и сторож `layer-name`; перевод файлов на слои делает DS0b.

## 5. CI: наборы вертикалей в `release-checks`

`.github/workflows/release-checks.yml`, новая задача `ui-vertical`:
- матрица `suite: [beauty-ui, food-ui, branches-ui]`, `fail-fast: false`, `needs: fast`, `timeout-minutes: 30`, идёт параллельно с `db` и `ui-shard`;
- служба `postgres:16` как у `db` (подставные API трёх наборов читают схему `pms_test` локальной базы);
- шаги: checkout, node, `npm ci`, `generate`, база `pms_dev` с `btree_gist`, `npm run test:schema` (схема и миграции), `npx playwright install --with-deps chromium`, `npx playwright test --config tests/${{ matrix.suite }}/playwright.config.ts`, артефакты при сбое.

`tests/unit/ci-runner.test.ts`: список обязательных задач дополнить `ui-vertical`, проверить матрицу из трёх наборов, `needs: fast` и службу базы. RED на нынешнем workflow, GREEN после правки.

Проверка на кандидате: прогон `release-checks` на ветке среза (`workflow_dispatch`); в отчёте время каждой новой задачи и прибавка минут. Тесты в самих наборах не меняются.

## 6. Мёртвый код: опись и доказательства

- `scripts/design/dead-css.ts`: собирает классы из CSS `apps/web/src` и ищет имя класса в `.tsx` и `.ts`; на выходе кандидаты с пометкой «есть похожий динамический класс» (шаблоны вида `` `tone-${x}` ``). Небольшой unit-тест на разбор селекторов (RED → GREEN).
- Отчёт `reports/mv8-5-ds0a-2026-10-07/dead-code.md`: мёртвые селекторы (в том числе из §17 аудита: `.room-card*`, `.occupancy-ring`, `.hotel-clock`, `.search-dialog`, `.period-bar`, `.kpi--*`), мёртвые токены, сироты TSX, у каждого доказательство (команда и вывод). Ничего из описи в DS0a не удаляется.
- `today/today-widgets.tsx` удаляется (решение №8). Доказательство в отчёте: поиск импортов по `apps`, `packages`, `tests`, `scripts` даёт 0; `.tw-*` в CSS 0; сторож `orphan-module` красный до и зелёный после; typecheck, lint, сборка `apps/web` и полный unit зелёные после удаления. Строка «Виджеты дня Главной» в `DESIGN.md` §8 помечается «снято 07.10».

## 7. Файлы

| Файл | Правка |
|---|---|
| `tests/unit/design-slop.test.ts` | шесть правил, экспорт функций правил |
| `tests/unit/design-slop.baseline.json` | снимок с новыми правилами |
| `tests/unit/design-guards.test.ts` | новый: образцы для каждого правила |
| `tests/unit/design-scale.test.ts` | новый: шкала и точки перелома |
| `tests/unit/ci-runner.test.ts` | задача `ui-vertical` |
| `.github/workflows/release-checks.yml` | задача `ui-vertical` |
| `scripts/design/dead-css.ts` и его тест | новый: опись мёртвого CSS |
| `apps/web/src/app/today/today-widgets.tsx` | удалить |
| `DESIGN.md` | §3, §4, §5, §6 шкала; §8 строка виджетов; §20.6 слои |
| `reports/mv8-5-ds0a-2026-10-07/README.md`, `dead-code.md` | отчёт среза |
| `CLAUDE.md` §2, `tests/runs/*` | запись дня и журнал прогонов |

Не трогаются: любой другой файл `apps/**`, `packages/**`, CSS, `design/tokens.json`, схема, миграции, `DATA_MODEL.md`.

## 8. Тесты

- RED → GREEN: `design-guards` (каждое правило), храповик снимка, `design-scale`, `ci-runner`, разбор `dead-css`, `orphan-module` на живом `today-widgets.tsx`.
- Полный unit, typecheck, lint, `npm run build -w apps/web` (удаление модуля).
- Полный `tests/ui` не нужен: стили и разметка не меняются; доказательство нейтральности: `git diff --stat` без CSS и TSX, кроме удалённого файла. Наборы `beauty-ui`, `food-ui`, `branches-ui` гоняются локально один раз и на кандидате в `release-checks`.

## 9. Приёмка

1. Шесть новых правил есть, у каждого лог RED и лог GREEN в `tests/runs`.
2. Снимок `design-slop` содержит новые правила; ни одно прежнее число не выросло.
3. `release-checks` на кандидате: задачи `ui-vertical` (3) зелёные, время и минуты в отчёте.
4. `today-widgets.tsx` удалён; доказательство в отчёте; typecheck, lint, сборка, unit зелёные.
5. Опись мёртвого кода лежит в отчёте.
6. Ни одного изменённого CSS-файла и TSX-файла, кроме удалённого.
7. `DESIGN.md` описывает шкалу, точки перелома и слои; длинных тире нет.

## 10. Риски

- **Время гейта и минуты.** Три новые задачи по 10–15 минут параллельно: стена почти не растёт, минут на прогон примерно +30–45 к нынешним 95 при бюджете 2000 в месяц. Замер на кандидате.
- **Ложные срабатывания `orphan-module` и `dead-css`.** Динамический импорт и динамические классы. Сторож учитывает `import()` и файлы маршрутов; опись CSS помечает похожие динамические имена и ничего не удаляет.
- **Большие снимки** (`space-literal-not-var` около 826). Это долг, а не ошибка: храповик только не даёт ему расти, снимают его DS0b и экранные срезы.
- **Наборы вертикалей на чистой базе CI.** Подставные API берут схему `pms_test`; если `test:schema` на пустой базе потребует данных, задача падает до тестов. Проверяется первым прогоном на кандидате, правка только в workflow.

## 11. Что остаётся DS0b

Перевод файлов на `@layer` по договору; снятие дублей `.btn`, `.panel`, `.stat`, `.tbl`, `.page__title`, `.seg`, `.badge`; удаление `glass.css`; импорт экранного CSS из своих маршрутов; удаление мёртвого CSS и токенов по описи; сверка `DESIGN.md` §4, §8, §20 с кодом; `!important` до 5; уменьшение снимков; полная визуальная регрессия (12 экранов × 2 темы × 2 ширины до и после).

## 12. Вопросы владельцу

1. Пары точек перелома: `max-width: 600px` / `min-width: 601px`, `max-width: 960px` / `min-width: 961px`, `max-width: 1279px` / `min-width: 1280px`. Так?
2. `inline-style`: динамическая геометрия (позиции плашек шахматки, ширина полос) остаётся в `style` с пометкой `slop-allow` и причиной. Согласны?
3. Прибавка примерно 30–45 минут раннера на прогон `release-checks` приемлема?
