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

**Статус 07.09.2026:** пакеты `@pms/imports` и `@pms/reconciliation` созданы как каркас (шаг 1 Slice 1), код пуст.
