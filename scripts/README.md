# scripts

| Папка | Назначение |
|---|---|
| `imports/` | Импорт выгрузок Exely в PMS |
| `reconciliation/` | Сверка новой PMS с Exely, отчёты для гейтов |

## imports

Импорт обязан быть:
- идемпотентным (повторный запуск не создаёт дубли);
- транзакционным;
- с отчётом: сколько строк прочитано / создано / пропущено / отклонено и почему.

Если реальные данные не помещаются в утверждённую модель — **schema не меняется**,
проблема записывается в `QUESTIONS.md` (AGENTS.md §2).

## reconciliation

Отчёты, которыми закрываются гейты. Формат отчёта Gate 1:

```
CONTROL DATE: YYYY-MM-DD

TOTALS              PMS      EXELY    DIFF
physical rooms      ---      ---      0
beds                ---      ---      0
occupied            ---      ---      0
free                ---      ---      0
blocked             ---      ---      0
out of order        ---      ---      0

BY ACCOMMODATION TYPE
<type>              ---      ---      0

RESERVATIONS        PMS      EXELY    DIFF
arrivals            ---      ---      0
departures          ---      ---      0
in-house            ---      ---      0
future              ---      ---      0
```

Допустимое расхождение — **0**.

**Статус 07.09.2026:** `@pms/imports` — парсеры выгрузок Exely (`src/exely/`): `parseExelyInventory`,
`parseExelyAccommodationTypes`, `buildInventoryImportPlan`. Чистые функции, без БД; ошибки данных —
`ExelyImportError` с номером единицы, догадок нет. Запуск TS-скриптов — `npx tsx`.
`importInventoryPlan` — идемпотентный импорт внутри `db.$transaction`, отчёт создано/обновлено, запись в AuditLog.
CLI: `npx tsx scripts/imports/src/cli-import-inventory.ts`.
`@pms/reconciliation` — `compareInventory`/`renderInventoryReport` (Gate 1), CLI
`npx tsx scripts/reconciliation/src/cli-inventory.ts` → `reports/inventory-YYYY-MM-DD.md`, exit 1 при diff.
