PanelTitle from @pms/web. Use via `window.Wetop.PanelTitle` (bundle loaded from the root `_ds_bundle.js`).

# PanelTitle — заголовок панели отдельно

Тот же заголовок, что делает `Panel title=…`, но отдельным элементом — когда шапка панели собирается
из заголовка и действий в одном ряду. Раздвигает их `row--between`.

```tsx
<Panel>
  <Row className="row--between">
    <PanelTitle>Очередь отправок в Channex</PanelTitle>
    <Button tone="secondary" size="sm">Показать все строки</Button>
  </Row>
</Panel>
```
