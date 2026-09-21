Row from @pms/web. Use via `window.Wetop.Row` (bundle loaded from the root `_ds_bundle.js`).

# Row — ряд

Горизонтальный ряд с отступом по шкале, перенос на вторую строку при нехватке места.

**`align="end"`** — выравнивание по **нижнему** краю (`align-items: end`), для ряда, где элементы разной
высоты. **Раздвинуть заголовок и действие по краям** — это другое: `className="row--between"`.
**`gap="lg"`** — увеличенный промежуток.

```tsx
<Row>
  <Button>Заселить</Button>
  <Button tone="secondary">Переселить</Button>
</Row>

<Row className="row--between">
  <PanelTitle>Проживания</PanelTitle>
  <Button size="sm">Добавить проживание</Button>
</Row>
```
