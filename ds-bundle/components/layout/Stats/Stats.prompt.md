Stats from @pms/web. Use via `window.Wetop.Stats` (bundle loaded from the root `_ds_bundle.js`).

# Stats — ряд плиток показателей

Контейнер для `Stat`. `min` — минимальная ширина плитки; при нехватке места ряд переносится сам.

```tsx
<Stats min={180}>
  <Stat label="Загрузка" value="79,5 %" hint="+4,1 п.п. к прошлой неделе" />
  <Stat label="Заезды" value="24" />
  <Stat label="Не собрано" value="16 000 ₸" tone="alarm" />
</Stats>
```
