Notice from @pms/web. Use via `window.Wetop.Notice` (bundle loaded from the root `_ds_bundle.js`).

# Notice — спокойное сообщение

Пояснение или итог без тревоги и без роли `alert`: «Оплата принята: 12 500 ₸», «Показано 16 из 88».
`tone="muted"` — совсем тихо.

```tsx
<Notice>Оплата принята: 12 500 ₸</Notice>
<Notice tone="muted">Категории и тарифы приходят из Exely</Notice>
```
