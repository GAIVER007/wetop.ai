StatusBadge from @pms/web. Use via `window.Wetop.StatusBadge` (bundle loaded from the root `_ds_bundle.js`).

# StatusBadge — статус брони или проживания

Тон выбирается по статусу, подпись даёт экран — у стойки свои слова («ждём», «живёт»), а не коды.

| статус | тон | слово стойки |
|---|---|---|
| `TENTATIVE` | warn | не подтверждена |
| `CONFIRMED` | info | подтверждена |
| `CHECKED_IN` | ok | живёт |
| `CHECKED_OUT` | neutral | выехал |
| `CANCELLED` | danger | отменена |
| `NO_SHOW` | danger | незаезд |

```tsx
<StatusBadge status="CHECKED_IN" label="живёт" />
<StatusBadge status="TENTATIVE" label="не подтверждена" />
```
