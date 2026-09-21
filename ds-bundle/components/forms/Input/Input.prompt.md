Input from @pms/web. Use via `window.Wetop.Input` (bundle loaded from the root `_ds_bundle.js`).

# Input — текстовое поле

Поле ввода 38 px, рамка `--border-input`. На телефоне шрифт 16 px и высота 44 px — иначе Safari
увеличивает страницу при фокусе. Все атрибуты проходят насквозь: `name`, `required`, `aria-invalid`.

Ошибка поля — `aria-invalid` плюс `Alert` рядом, а не красная рамка молча (DESIGN.md §8).

```tsx
<Field label="Фамилия и имя">
  <Input name="guest" defaultValue="Иванов Пётр" required />
</Field>
<Field label="Дата заезда">
  <Input type="date" name="from" />
</Field>
```
