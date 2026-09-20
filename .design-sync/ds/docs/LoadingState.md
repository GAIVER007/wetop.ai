---
category: states
---
# LoadingState — загрузка

`aria-busy` на области, живая подпись **словом** для читалки и скелетоны той формы, что займёт
содержимое. Крутилок нет: слово говорит, чего именно ждём (DESIGN.md §8).

```tsx
<LoadingState label="Загружаем брони на 20 сент.…" rows={5} />

<LoadingState label="Считаем показатели за месяц…">
  <Skeleton variant="title" />
  <Skeleton variant="stat" />
</LoadingState>
```
