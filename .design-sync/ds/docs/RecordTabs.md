---
category: layout
---
# RecordTabs — вкладки карточки

Разделы карточки брони или гостя: «Обзор», «Проживания», «Счета», «Действия». Вкладка попадает в
адрес якорем (`#folio`), поэтому ссылку на конкретную вкладку можно дать смене.

Клавиатура: стрелки переключают, Home/End — края, панель принимает фокус (DESIGN.md §12).

```tsx
<RecordTabs
  tabs={[
    { id: 'overview', label: 'Обзор', content: <Overview /> },
    { id: 'stays', label: 'Проживания', content: <Stays /> },
    { id: 'folio', label: 'Счета', content: <Folio /> },
  ]}
/>
```
