---
category: data
---
# Legend — легенда статусов

Подпись к цветам шахматки. **Глиф обязателен**: те же глифы стоят на плашках броней, и легенда
читается как подпись к ним — смысл не держится на одном цвете (DESIGN.md §1 п. 4, §9).

```tsx
<Legend
  items={[
    { color: 'var(--st-checked-in)', glyph: '✓', label: 'заселён' },
    { color: 'var(--st-confirmed)', glyph: '•', label: 'ждём' },
    { color: 'var(--st-tentative)', glyph: '?', label: 'не подтверждена' },
    { color: 'var(--st-checked-out)', glyph: '✕', label: 'выселен' },
    { color: 'var(--st-blocked)', glyph: '▨', label: 'блокировка' },
  ]}
/>
```
