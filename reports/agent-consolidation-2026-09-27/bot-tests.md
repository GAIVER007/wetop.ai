# Прогон бота после слияния веток агента (27.09.2026)

`npm run test:record` набора для pytest бота нет — доказательство здесь, как в
`reports/seller-cost-controls-2026-09-26/bot-tests.md`. Окружение: облачная копия `apps/ai-seller` на коммите
`3bad134b` ветки `claude/festive-johnson-0aark9` (`main` `24a66cbf` + три ветки агента; дерево
`apps/ai-seller` = `dd5d8f5c`), Python 3.11.15, pytest 9.1.1, зависимости `requirements.txt` без torch и
sentence-transformers (модель эмбеддингов в тестах подменяется, `testy.md`). Запуск из `apps/ai-seller`:
`python -m pytest -q -p no:cacheprovider`.

До слияния: `main` — 1434 (запись PR #87 в хронике 26.09), ветка расходов — 1432 на своей основе.

После слияния всех трёх веток и разбора конфликта в `engine.py` и `llm.py` (оба предела — README §2):

```
........................................................................ [ 92%]
........................................................................ [ 96%]
..............................................                           [100%]
1486 passed in 100.09s (0:01:40)
```

В набор входят тесты всех трёх веток: `test_widget_identity_not_in_url.py` и `test_widget_cors.py` (ключ посетителя
в заголовке), `test_budget_daily_cap.py`, `test_llm_emergency_route.py`, `test_usage_breakdown.py`,
`test_usage_report.py` (расход), а также сторожа безопасности PR #87 (`test_security_2026_09_26.py` — защитный
потолок `LLM_DAILY_TOKEN_BUDGET`) и шаблона окружения (`test_partner_config.py`: у каждой настройки есть строка
в `env.example`).
