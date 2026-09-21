Fact from @pms/web. Use via `window.Wetop.Fact` (bundle loaded from the root `_ds_bundle.js`).

# Fact — подпись и значение без карточки

Пара «что» — «значение» внутри панели, когда карточка была бы лишней: ключ счётчика, время
последнего события, гражданство гостя. Пустое значение — «—», а не «Не указан» (DESIGN.md §14).

```tsx
<Grid min={200}>
  <Fact label="Гражданство" value="Казахстан" />
  <Fact label="Телефон" value="—" />
  <Fact label="Последнее событие" value={<time dateTime="2026-09-20T10:12">20.09.2026, 10:12</time>} />
</Grid>
```
