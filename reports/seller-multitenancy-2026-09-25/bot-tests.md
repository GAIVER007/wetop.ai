# Прогоны pytest бота — Э4 «один продавец на все гостиницы» (25.09.2026)

Журнал `test:record` пока не знает pytest бота (набора для `apps/ai-seller` в
`tests/journal` нет), поэтому доказательства — здесь, как в отчёте Э3.
Прогоны из `apps/ai-seller`, окружение `/tmp/claude-0/botenv`
(requirements.txt без torch/sentence-transformers; эмбеддер в тестах —
HashingBackend из `tests/kb_fakes.py`).

## Красный до кода (red before green)

```
$ python -m pytest tests/test_orgs_isolation.py -q
ERROR tests/test_orgs_isolation.py
E   ImportError: cannot import name 'Organization' from 'src.db.models'
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 error in 0.30s
```

Организаций не было ни в моделях, ни в дверях — весь файл изоляции красный.
По ходу работы красными были и промежуточные состояния: батч SQLite отказал
безымянному внешнему ключу («Constraint must have a name» → имена
`fk_<таблица>_organization`), знания панели ходили в настоящий эмбеддер
(починено фикстурой `fake_embedder`), `widget.js` перерос бюджет строк
(300 → 320 с пометкой Э4 в `tests/test_widget_js.py`).

## Зелёный после кода

```
$ python -m pytest tests/test_orgs_isolation.py -q
19 passed in 5.52s

$ python -m pytest -q          # весь набор бота
1347 passed in 94.97s (0:01:34)
```

До Э4 набор держал 1328 тестов; 19 новых — `tests/test_orgs_isolation.py`:
служебный upsert гостиницы (и 409 у помощника), дверь виджета по ключу
и доменам гостиницы, молчание погашенного расширения (Q-183), один
посетитель в двух гостиницах — два клиента, опрос не отдаёт чужую историю,
помощник без ключа как раньше, панель без `X-Organization` — 400, отбор
диалогов/знаний/фактов по заголовку, профиль в `organizations.system_prompt`
(ядро правил на месте, соседняя гостиница не задета), движок берёт промпт
организации (и prompt_missing без строки), поиск знаний в пределах
организации, одинаковый файл у двух гостиниц — две записи.

Обновлённые контрактные тесты: `test_seller_profile.py` и
`test_seller_facts.py` (заголовок `X-Organization`, промпт из строки
организации вместо файла), `test_step1_migrations.py` (+`organizations`
в списке таблиц: upgrade и downgrade ходят в обе стороны на SQLite).
