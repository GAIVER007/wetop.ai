Badge from @pms/web. Use via `window.Wetop.Badge` (bundle loaded from the root `_ds_bundle.js`).

# Badge — бейдж

Короткое слово рядом с содержимым: «грязно», «Ещё не подключено», число в шапке вкладки.

**Тона:** `neutral` (по умолчанию), `info`, `ok`, `warn`, `danger`. Цвет **дублирует** слово, а не
заменяет его: смысл не должен держаться только на цвете (DESIGN.md §1 п. 4, §9).

```tsx
<Badge>Ещё не подключено</Badge>
<Badge tone="warn">грязно</Badge>
<Badge tone="danger">продано сверх мест</Badge>
```

Статус брони — не `Badge`, а `StatusBadge`: он знает соответствие статуса и тона.
