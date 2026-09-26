# Прогоны бота: котировка у платформы (25.09.2026, ADR-085)

`npm run test:record` набора для pytest бота нет — доказательство здесь, как для «Техподдержки»
(`reports/platform-support-2026-09-25/bot-tests.md`). Окружение: `/tmp/claude-0/botenv`
(Python 3.11, зависимости `apps/ai-seller/requirements.txt`), запуск из `apps/ai-seller`:
`python -m pytest -q -p no:cacheprovider`.

## Красные первыми

Новый `tests/test_step7_quote_org.py` (6 проверок) до правок кода падал весь: не было
`dependencies.organization_id_var` (ImportError), путь был `/w/availability` и поле `guests`,
`totalMinor` строкой не читался, закрытая и не вмещающая категории получали цену.
После правок (`dependencies.py`, `ai/engine.py`, `integrations/wetop.py`, `wetop_parse.py`,
`factory.py`) — 6/6 зелёные, соседние `test_step7_wetop.py` не тронуты: «1 failed, 40 passed»,
где падение — старый тест фабрики, ждавший от роли `support` провайдера наличия.

## Правки по ходу

1. `test_step7_factory.py::test_wetop_with_address_and_key_builds_client_implementation` переписан
   в два теста по ролям (план §1): продавец — только `availability` (+ заявка заглушкой), помощник —
   только `incidents`/`health`.
2. `test_step7_imports.py::test_integrations_files_stay_short`: `wetop.py` перевалил бюджет
   (315 > 300 строк) — ужат до 298 без потери смысла (шапка переписана по ADR-085, импорт разбора
   сгруппирован, комментарий двери сжат).
3. `test_step7_imports.py::test_wetop_docstring_says_the_connection_is_not_decided_yet` требовал слов
   «способ подключения не выбран» — после ADR-085 это неправда. Переписан в
   `test_wetop_docstring_names_the_decision_and_its_scope`: докстринг обязан называть ADR-085
   и границу «бронь не включена» (Q-166б).

## Итог

```
1354 passed in 91.37s
```

Полный набор бота (было 1353 после правок №1–2; финальный прогон после №3 — 1354/1354, ноль упавших).
Платформенные прогоны (typecheck, lint, unit с `bot-quote.controller.test.ts` 6/6, integration) —
журналом `npm run test:record`, строки в `tests/runs/JOURNAL.md` этим же коммитом.
