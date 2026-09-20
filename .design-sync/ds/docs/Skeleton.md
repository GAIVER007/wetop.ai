---
category: states
---
# Skeleton — серая плашка вместо содержимого

Форма будущего содержимого, а не абстрактный прямоугольник. Скрыт от читалки (`aria-hidden`) — о
загрузке говорит `LoadingState`; при `prefers-reduced-motion` не мигает.

**Виды:** `title` (34 px), `stat` (130 px), `row` (42 px, по умолчанию), `text` (14 px).

```tsx
<Skeleton variant="title" />
<Skeleton variant="stat" />
<Skeleton />
<Skeleton variant="text" />
```
