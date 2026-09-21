Select from @pms/web. Use via `window.Wetop.Select` (bundle loaded from the root `_ds_bundle.js`).

# Select — выбор из списка

Нативный `<select>` в оформлении поля (38 px, та же рамка). Нативный — намеренно: на планшете
системный список удобнее любого своего, и он работает с клавиатуры без кода.

В ряду фильтров полю нужен `min-width: 0`, иначе длинное название категории уводит экран вбок
(найдено обходом 17.09).

```tsx
<Field label="Категория" inline>
  <Select name="category" defaultValue="dorm-m">
    <option value="dorm-m">Мужской общий номер</option>
    <option value="twin">Двухместный номер</option>
  </Select>
</Field>
```
