Table from @pms/web. Use via `window.Wetop.Table` (bundle loaded from the root `_ds_bundle.js`).

# Table — таблица

Шапка 42 px, строка 38–42 px, прокрутка **внутри** области с фокусом (`role="region"`, `tabIndex`) —
таблица прокручивается с клавиатуры, а не уводит вбок весь экран.

**Модификаторы:** `size="sm"`, `dense`, `nowrap`, `plain`.
**Состояния строки:** `.is-active` — выбрана (`--primary-soft`), `.is-void` — отменена (зачёркнута,
`--muted`).

На телефоне длинную строку складывают в карточку (класс семейства, например `dir-table--stays`):
разметка таблицы остаётся той же, шапка прячется, ячейки становятся строками карточки.

```tsx
<Table aria-label="Проживания брони">
  <thead>
    <tr><th>Гость</th><th>Проживание</th><th>Место</th><th>Стоимость</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Иванов Пётр</td>
      <td><time dateTime="2026-09-20">20 сент. → 23 сент. · 3 ночи</time></td>
      <td>R01</td>
      <td className="num">33 000 ₸</td>
    </tr>
  </tbody>
</Table>
```
