Panel from @pms/web. Use via `window.Wetop.Panel` (bundle loaded from the root `_ds_bundle.js`).

# Panel — белый блок с рамкой

Основной контейнер содержимого: рамка 1 px, радиус 16, внутри 16 px. **Рамка вместо тени** — тень
на стойке читается как «поверх», а панель лежит в потоке (DESIGN.md §5).

`title` рисует заголовок панели; для формы ставьте `className="panel"` прямо на `<form>`.
Опасное действие — своя панель с `className="panel--danger"`, последствие названо до кнопки.

```tsx
<Panel title="Проживания">
  <Table>…</Table>
</Panel>
<Panel size="lg" title="Счёт">…</Panel>
```
