Stack from @pms/web. Use via `window.Wetop.Stack` (bundle loaded from the root `_ds_bundle.js`).

# Stack — колонка

Вертикальная стопка блоков с одним отступом. `gap="sm"` — плотнее.

Колонка тянется по самому широкому неразрывному содержимому — если внутрь идёт код или длинный
номер, колонке нужен `minmax(0, 1fr)`, иначе на телефоне экран уезжает вбок (найдено обходом 17.09).

```tsx
<Stack>
  <Panel title="Начислено гостям">…</Panel>
  <Panel title="Деньги на руках">…</Panel>
</Stack>
```
