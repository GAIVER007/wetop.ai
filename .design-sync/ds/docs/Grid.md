---
category: layout
---
# Grid — сетка «сколько влезет»

Колонки нужной минимальной ширины, число колонок считает браузер. `min` — минимальная ширина
колонки в px, `gap="sm"` — плотнее.

```tsx
<Grid min={210}>
  {rooms.map((r) => <Panel key={r.code} title={r.code}>{r.state}</Panel>)}
</Grid>
```
