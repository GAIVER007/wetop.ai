# Как строить экраны на WETOP

WETOP — интерфейс гостиничной стойки: смена работает за ним всю ночь. Тексты русские, деньги в тенге
(«12 500 ₸»), даты по Алматы. Правила целиком — `guidelines/DESIGN.md`; ниже то, без чего макет
получится не из этой системы.

## Оболочка и тема

Провайдер для оформления **не нужен**: токены объявлены в `:root` внутри `styles.css`, компоненты
читают их сами. Достаточно подключить `styles.css` и `_ds_bundle.js`, компоненты — в `window.Wetop.*`.

Тёмная тема — атрибут на корне документа, а не проп: `document.documentElement.dataset.theme = 'dark'`
(значения `light`, `dark`, `contrast`). Компонент `ThemeProvider` нужен только если в макете есть сам
переключатель темы. `ToastProvider` — только если макет показывает уведомления через хук `useToast`;
для статичной картинки достаточно `ToastRegion` с массивом `items`.

## Идиома оформления: смысловые классы + переменные

Своих классов у компонентов нет — это **не** утилитарная система (ни Tailwind, ни пропы-темы). Каждый
компонент ставит один смысловой класс и модификаторы `--`, а вся вёрстка вокруг пишется теми же
классами и `var(--токен)`. Свои цвета, отступы и радиусы литералами не пишите: всё есть в токенах.

| Семейство | Реальные имена |
|---|---|
| Кнопки | `.btn`, `.btn--secondary`, `.btn--danger`, `.btn--ghost`, `.btn--sm`, `.btn--xs`, `.icon-button` |
| Поля | `.inp`, `.field`, `.field--inline` |
| Блоки | `.panel`, `.panel--lg`, `.panel--danger`, `.panel__title` |
| Таблицы | `.table-scroll`, `.tbl`, `.tbl--sm`, `.tbl--dense`, `.tbl--nowrap`, `.tbl--plain`; строка `.is-active` (выбрана), `.is-void` (отменена) |
| Раскладка | `.page`, `.page--wide`, `.row`, `.row--between`, `.row--end`, `.row--lg`, `.stack`, `.stack--sm`, `.grid-auto`, `.split` |
| Статусы и числа | `.badge`, `.badge--warn`, `.badge--danger`, `.amount-chip`, `.stat`, `.stat--alarm`, `.num` (табличные цифры), `.warn-text` |
| Сообщения | `.alert`, `.alert--boxed`, `.notice`, `.notice--muted`, `.context-help` |
| Состояния | `.empty-state`, `.loading-state`, `.skeleton`, `.skeleton-title`, `.skeleton-stat` |
| Слои | `.ui-overlay`, `.ui-drawer`, `.confirm-dialog`, `.action-menu`, `.tooltip`, `.toast` |
| Прочее | `.seg` (переключатель вида), `.filter-chip`, `.sr-only` |

**Раздвинуть заголовок и действие по краям — `.row--between`.** `align="end"` у `Row` — это
выравнивание по нижнему краю, не раздвижка.

Токены: цвет `--primary`, `--surface`, `--surface-muted`, `--text`, `--text-2`, `--muted`, `--border`,
`--border-input`, `--danger`, `--warning`, `--success`, `--info`, `--focus`, `--row-hover`; статусы
`--st-confirmed`, `--st-tentative`, `--st-checked-in`, `--st-checked-out`, `--st-blocked`; отступы
`--space-1 … --space-16` (шкала 4/8); радиусы `--radius-xs … --radius-lg`, `--radius-control`; размеры
`--text-xs … --text-4xl` (12–28, мельче 12 px нет), начертания `--weight-regular|medium|semibold|bold`
(400/500/600/700); высоты полей и кнопок `--control-h` (38), `--control-h-sm` (30), `--control-h-xs` (24).

## Пять правил, без которых макет не узнают

1. **Залита только главная кнопка ряда**, остальные белые с цветной подписью.
2. **Цвет ничего не значит в одиночку**: у статуса всегда есть слово, у бейджа — текст, у легенды — глиф.
3. **Рамка вместо тени**: панели отделяются рамкой 1 px, тень — только у слоёв (`--shadow-floating`).
4. **Загрузка — словом** («Сохраняю…», «Загружаем брони…»), крутилок в системе нет.
5. **Пусто и сбой говорят, что делать дальше**, а не «Нет данных»: `EmptyState` и `ErrorState` несут
   следующий шаг. Необратимое спрашивают `ConfirmDialog` с суммой и последствием в теле окна.

## Где смотреть правду

`styles.css` (и всё, что он `@import`ит) — настоящее оформление; `components/<группа>/<Имя>/<Имя>.prompt.md`
— как пользоваться компонентом; `<Имя>.d.ts` — его пропы; `guidelines/DESIGN.md` — правила стойки
целиком (размеры, восемь состояний, статусы, контраст, тексты и форматы).

## Пример в идиоме системы

```jsx
const { Page, Panel, Row, Table, StatusBadge, AmountChip, Button } = window.Wetop;

<Page title="Брони" subtitle="9 бронирований на 20 сент." actions={<Button>Новая бронь</Button>}>
  <Panel>
    <Row className="row--between">
      <b className="panel__title">Проживают сейчас</b>
      <Button tone="secondary" size="sm">Все брони дня</Button>
    </Row>
    <Table aria-label="Брони">
      <tbody>
        <tr className="is-active">
          <td>Иванов Пётр</td>
          <td>R01</td>
          <td><StatusBadge status="CHECKED_IN" label="живёт" /></td>
          <td className="num"><AmountChip minor="1600000" tone="due" /></td>
        </tr>
      </tbody>
    </Table>
  </Panel>
</Page>
```

# Wetop (@pms/web@0.0.0)

This design system is the published @pms/web React library, bundled as a single
browser global. All 37 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Wetop`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (5 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Wetop.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { ActionMenu } = window.Wetop;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<ActionMenu />);
```

## Tokens

118 CSS custom properties from @pms/web. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (14): `--surface`, `--surface-muted`, `--surface-elevated`, …
- **spacing** (8): `--space-1`, `--space-2`, `--space-4`, …
- **typography** (7): `--font`, `--font-head`, `--font-mono`, …
- **radius** (6): `--radius-xs`, `--radius-sm`, `--radius-control`, …
- **shadow** (2): `--shadow`, `--shadow-floating`
- **other** (81): `--dot`, `--bg`, `--sidebar`, …

## Components

### actions
- `ActionMenu`
- `Button`

### messages
- `Alert`
- `FeaturePending`
- `Help`
- `Notice`

### data
- `AmountChip`
- `Badge`
- `Fact`
- `Legend`
- `Stat`
- `StatusBadge`
- `Table`

### overlays
- `ConfirmDialog`
- `Overlay`
- `ToastRegion`
- `Tooltip`

### states
- `EmptyState`
- `ErrorState`
- `LoadError`
- `LoadingState`
- `Skeleton`

### forms
- `Field`
- `Input`
- `Select`
- `Textarea`

### layout
- `Grid`
- `Page`
- `Panel`
- `PanelTitle`
- `RecordTabs`
- `Row`
- `SectionCards`
- `SectionTitle`
- `Stack`
- `Stats`

### foundation
- `Icon`
