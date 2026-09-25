# Тесты бота к ADR-084 (25.09.2026)

Бот — `apps/ai-seller`, pytest в отдельном окружении (зависимости из `requirements.txt` без torch и sentence-transformers: их бот подключает лениво). `test:record` знает только наборы платформы, поэтому вывод — здесь.

## Красный: новые проверки ключа помощника до правки `auth_router.py`

```
WARNING  src.main:main.py:80 Виджет: домены сайта не заданы, проверка Origin выключена
=========================== short test summary info ============================
FAILED tests/test_service_key.py::test_support_key_opens_rules_and_model[GET-/prompt]
FAILED tests/test_service_key.py::test_support_key_opens_rules_and_model[PUT-/prompt]
FAILED tests/test_service_key.py::test_support_key_opens_rules_and_model[GET-/settings]
FAILED tests/test_service_key.py::test_support_key_opens_rules_and_model[PUT-/settings/model]
FAILED tests/test_service_key.py::test_support_key_writes_the_rules_the_engine_reads
5 failed, 14 passed in 3.70s
```

## Зелёный: `tests/test_service_key.py` после правки

```
...................                                                      [100%]
19 passed in 3.59s
```

## Весь набор бота после правки

```
................................                                         [100%]
1328 passed in 74.84s (0:01:14)
```
