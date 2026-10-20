# Общая главная владельца: UI-срез 16.10.2026

Рабочее дерево: `/opt/data/workspace/wetop-unified-owner-data`. Production, .env и база не изменялись. Пакеты не установлены; commit/push/merge/deploy не выполнялись. APP_UNIFIED_OWNER_HOME по умолчанию выключен.

## Реализовано

- Одна серверная презентация `apps/web/src/app/today/unified-owner.tsx` для BEAUTY, FOOD_SERVICE, HOSPITALITY; existing shell с Inter и hamburger не менялся.
- `apps/web/src/lib/owner-summary.ts`: фактический DTO, названия причин, форматирование minor strings через BigInt и currency exponent, нормализация today/week/month.
- `apps/web/src/lib/owner-summary-api.ts`: реальный GET через существующий authenticated scoped transport, без fallback пустого ответа.
- `/today` использует новый экран только при флаге true, signed-in reports и выбранном филиале. API остаётся окончательной проверкой scope. Ошибка показывает alert и повтор, не нули.
- `/today/operations` сохраняет специализированные инструменты; прямые ссылки на appointments/floor-plan/chessboard и соответствующие финансовые разделы.
- Общие четыре показателя и блоки V4; без ring, permanent sidebar, сравнения единственного филиала, синтетических линий или предыдущих дельт. PARTIAL загрузка без итогового процента; ROOM/BED отдельно. Категории не выдуманы.
- `docs/contracts/owner-summary.md` актуализирован до реализации UI; решение зарегистрировано в DECISIONS.md и DESIGN.md §8.

## Проверено

RED: отсутствующий модуль презентации, `tests/runs/entries/2026-10-16T09-13-47Z-unit-e406.json` (ошибка импорта отсутствующего нового модуля, не behavioral assertion).

GREEN после окончательных правок, без изменения source во время прогонов:
- 19/19: новые DTO-render tests (today/week/month, multicurrency, BigInt, PARTIAL workload, ROOM/BED, unsupported), transport errors/default-off и существующий dispatch: `tests/runs/entries/2026-10-16T09-18-05Z-unit-ca1e.json`.
- Полный root/API/web typecheck: `tests/runs/entries/2026-10-16T09-18-08Z-typecheck-7372.json`.
- Все CSS variables нового блока существуют в tokens.css; проверены назначения операционных и финансовых ссылок.
- gbrain TodayPage callers/blast: graph not_built/not_found; fallback поиск references нашёл только определение маршрута.

## Не доказано и не готово к релизу

Браузер не запускался: 320/390/1440 и обе темы визуально НЕ проверены, screenshots не созданы. Только responsive CSS, SSR unit и typecheck не являются визуальной приёмкой. Полный lint, весь unit и live API UI roundtrip не запускались. Тестовые DTO синтетические, production UI использует только реальный API.

Backend gaps: hold migrations не применены; workload capture/полнота истории, immutable hotel cash currencies, Beauty payment ledger, чтение связанной классификации расходов, временные ряды и comparable previous projection, итоговые RLS/concurrency/release gates. Hospitality workload текущего reader принципиально PARTIAL; полоса появляется лишь для COMPLETE percent. API не передаёт автоматические attention tasks, вместо них явно показаны ограничения данных.

Следующий безопасный шаг: isolated real API + собственный Next порт, затем browser verification 320/390/1440 обе темы с screenshots, проверки links/keyboard/error/retry и усиление route-level tests. Не включать production flag до отдельного принятия backend и UI gates.
