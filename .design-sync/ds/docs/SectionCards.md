---
category: layout
---
# SectionCards — плитки-ссылки раздела

Хаб раздела: плитка с иконкой, названием и стрелкой. Пункт, которого ещё нет, помечен бейджем
«Ещё не подключено» — честнее, чем прятать.

```tsx
<SectionCards
  items={[
    { href: '/rooms', label: 'Управление номерами', icon: 'inventory' },
    { href: '/rates', label: 'Цены и ограничения', icon: 'rates' },
    { href: '/marketing', label: 'Акции', icon: 'analytics', pending: true },
  ]}
/>
```
