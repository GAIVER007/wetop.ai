ActionMenu from @pms/web. Use via `window.Wetop.ActionMenu` (bundle loaded from the root `_ds_bundle.js`).

# ActionMenu — меню действий «⋯»

Список действий за кнопкой «⋯» там, где ряд кнопок не помещается: на плашке брони, в строке таблицы.
Дублирует перетаскивание и жесты пунктами — с планшета и с клавиатуры (DESIGN.md §8, §12).

Клавиатура: стрелки ходят по пунктам, Home/End — края, Escape закрывает и возвращает фокус на кнопку,
щелчок мимо закрывает. Отключённый пункт объясняет причину подписью, а не исчезает.

```tsx
<ActionMenu
  label="Действия по брони"
  items={[
    { label: 'Открыть карточку', href: '/reservations/20260920-0007' },
    { label: 'Продлить на ночь', onSelect: extend },
    { label: 'Переселить', onSelect: move, disabled: true },
    { label: 'Отменить бронь', onSelect: cancel, tone: 'danger' },
  ]}
/>
```

Пункт с `href` — ссылка (открывается в новой вкладке средней кнопкой), с `onSelect` — кнопка.
