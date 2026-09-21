ConfirmDialog from @pms/web. Use via `window.Wetop.ConfirmDialog` (bundle loaded from the root `_ds_bundle.js`).

# ConfirmDialog — окно подтверждения

Вместо `window.confirm`, которого в системе не осталось нигде. Только для **необратимого**: отмена со
штрафом, переселение с пересчётом, удаление документа, снятие блокировки.

Правила: сумма и последствие названы **в теле окна, до нажатия**; кнопка названа действием
(«Отменить бронь», не «ОК»); фокус по умолчанию на «Оставить как есть»; Escape — отказ; `pending`
отключает обе кнопки и пишет «Выполняю…».

```tsx
<ConfirmDialog
  open={open}
  title="Отменить бронь 20260920-0007?"
  confirmLabel="Отменить бронь"
  onConfirm={cancel}
  onCancel={close}
>
  Начисление 33 000 ₸ сторнируется, вместо него штраф 11 000 ₸ останется на счёте.
</ConfirmDialog>
```

Удобнее через хук `useConfirm`: `ask({ title, body, confirmLabel })` возвращает `Promise<boolean>`.
