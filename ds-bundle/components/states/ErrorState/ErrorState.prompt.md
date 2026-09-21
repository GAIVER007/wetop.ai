ErrorState from @pms/web. Use via `window.Wetop.ErrorState` (bundle loaded from the root `_ds_bundle.js`).

# ErrorState — экран сбоя

Различает два разных случая, потому что советы разные: **отклонённый запрос** (4xx — неверная дата
или адрес; повтор с теми же данными даст тот же ответ) и **нет связи** (повтор поможет).

Статус берётся из `error.digest` вида `API_404` — так код ошибки переживает production-сборку Next,
которая стирает текст серверной ошибки.

```tsx
<ErrorState
  error={Object.assign(new Error('Период больше 366 дней'), { digest: 'API_400' })}
  retry={() => router.refresh()}
/>
```

Внутри экрана, который должен остаться живым, используйте `LoadError` — он оставляет заголовок и
фильтры на месте.
