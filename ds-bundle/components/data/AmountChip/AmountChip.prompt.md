AmountChip from @pms/web. Use via `window.Wetop.AmountChip` (bundle loaded from the root `_ds_bundle.js`).

# AmountChip — плашка суммы

«к оплате 16 000 ₸» на полосе брони, в строке справочника, на плашке шахматки. **Слово перед суммой
обязательно** — оно несёт смысл, цвет только подчёркивает.

Сумма приходит строкой **в тиынах** (ADR-008): денег с плавающей точкой в системе нет. Тиыны
печатаются, только если они есть: «12 500 ₸», но «12 500,50 ₸».

**Тона и слова по умолчанию:** `due` → «к оплате», `paid` → «оплачено», `refund` → «возврат»,
`neutral` → «сумма». Своё слово — `label`.

```tsx
<AmountChip minor="1600000" tone="due" />
<AmountChip minor="3300000" tone="paid" />
<AmountChip minor="850000" tone="neutral" label="штраф" />
```
