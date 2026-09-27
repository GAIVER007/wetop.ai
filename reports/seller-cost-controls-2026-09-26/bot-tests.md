# Прогоны бота: расход на модели под контролем (26.09.2026)

`npm run test:record` набора для pytest бота нет — доказательство здесь, как в
`reports/seller-quotes-2026-09-25/bot-tests.md`. Окружение: облачная копия `apps/ai-seller` с `main` `bfe811bd`
(дерево `apps/ai-seller` = `4057c610`), Python 3.12.3, SQLite 3.45.1, зависимости `requirements.txt` без
torch и sentence-transformers (модель эмбеддингов в тестах подменяется, `testy.md`). Запуск из `apps/ai-seller`:
`python -m pytest -q -p no:cacheprovider`. До правок весь набор — **1392 passed**.

Порядок: п. 1 → п. 2 → п. 4 → п. 3 (отчёт последним — ему нужна разбивка из п. 4). Каждый файл тестов
написан до кода и прогнан на старом коде; «PASSED» в красном прогоне — сторожа прежнего поведения
(ниже предела, чужая гостиница, ключ партнёра, помощник…), они обязаны остаться зелёными и после правки.

## П. 1 — дневной предел (`tests/test_budget_daily_cap.py`)

Красный на старом коде:

```
PASSED tests/test_budget_daily_cap.py::test_under_the_cap_the_model_answers
PASSED tests/test_budget_daily_cap.py::test_yesterday_does_not_count
PASSED tests/test_budget_daily_cap.py::test_another_hotel_spend_does_not_count
PASSED tests/test_budget_daily_cap.py::test_a_hotel_with_its_own_key_has_no_platform_cap
PASSED tests/test_budget_daily_cap.py::test_zero_turns_the_cap_off
PASSED tests/test_budget_daily_cap.py::test_the_support_instance_is_not_capped
FAILED tests/test_budget_daily_cap.py::test_the_owner_default_is_150000_tokens_a_day
FAILED tests/test_budget_daily_cap.py::test_the_setting_is_in_the_template_with_the_same_value
FAILED tests/test_budget_daily_cap.py::test_the_day_is_counted_by_kazakhstan_time
FAILED tests/test_budget_daily_cap.py::test_over_the_cap_the_model_is_not_called
FAILED tests/test_budget_daily_cap.py::test_the_alert_goes_once_a_day
5 failed, 6 passed in 2.47s
```

Проверка окна молчания («алерт раз в сутки», `ttl` ключа молчания > 23 ч) дописана в
`test_the_alert_goes_once_a_day` после первой правки: два хода подряд глушит и десятиминутное окно,
так что без неё тест правку `dedup.py` не доказывал. На коде без правки `src/alerts/dedup.py`:

```
E       AssertionError: 600
E       assert 600 > (23 * 3600)
1 failed in 1.23s
```

Зелёный после правки: 11/11. Весь набор: **1403 passed**.

## П. 2 — второй путь к модели (`tests/test_llm_emergency_route.py`)

Красный на старом коде:

```
PASSED tests/test_llm_emergency_route.py::test_without_the_variables_the_emergency_goes_through_the_gateway
PASSED tests/test_llm_emergency_route.py::test_the_first_two_steps_never_take_the_second_route
PASSED tests/test_llm_emergency_route.py::test_a_partner_key_turn_never_takes_the_second_route
PASSED tests/test_llm_emergency_route.py::test_emergency_model_equal_to_the_primary_is_not_rerouted
FAILED tests/test_llm_emergency_route.py::test_gateway_down_the_emergency_model_answers_by_the_second_route
FAILED tests/test_llm_emergency_route.py::test_one_variable_is_not_enough_and_the_log_says_so
FAILED tests/test_llm_emergency_route.py::test_the_template_lists_both_names_with_empty_values
3 failed, 4 passed in 0.50s
```

Зелёный после правки: 7/7 (вместе с `test_step4_cascade.py` и `test_llm_keys.py` — 32/32). Весь набор:
**1410 passed**, 1 предупреждение — `PytestUnhandledThreadExceptionWarning` в `test_support_loader.py`
(поток aiosqlite закрылся после цикла событий; тест не тронут, в следующих прогонах не повторилось).

## П. 4 — разбивка расхода и кэш (`tests/test_usage_breakdown.py`)

Красный на старом коде:

```
PASSED tests/test_usage_breakdown.py::test_the_cache_mark_is_off_by_default
PASSED tests/test_usage_breakdown.py::test_with_the_mark_on_other_vendors_are_untouched
FAILED tests/test_usage_breakdown.py::test_the_cascade_returns_model_input_cached_and_output
FAILED tests/test_usage_breakdown.py::test_tool_rounds_add_up
FAILED tests/test_usage_breakdown.py::test_without_details_the_cached_part_stays_unknown
FAILED tests/test_usage_breakdown.py::test_the_engine_writes_the_breakdown_to_the_bot_reply
FAILED tests/test_usage_breakdown.py::test_with_the_mark_on_claude_gets_it_on_the_constant_prefix_only
FAILED tests/test_usage_breakdown.py::test_the_marked_prefix_is_still_masked
FAILED tests/test_usage_breakdown.py::test_the_mark_setting_is_off_and_in_the_template
FAILED tests/test_usage_breakdown.py::test_the_migration_adds_and_removes_the_columns
FAILED tests/test_usage_breakdown.py::test_the_reference_schema_lists_the_column[llm_model]
FAILED tests/test_usage_breakdown.py::test_the_reference_schema_lists_the_column[tokens_cached]
FAILED tests/test_usage_breakdown.py::test_the_reference_schema_lists_the_column[tokens_input]
FAILED tests/test_usage_breakdown.py::test_the_reference_schema_lists_the_column[tokens_output]
12 failed, 2 passed in 1.49s
```

Зелёный после правки: 14/14; миграция `0005` на SQLite: `upgrade head` → `downgrade 0004` (колонок нет,
`tokens_used` на месте) → `upgrade head`. Весь набор: **1424 passed**.

## П. 3 — отчёт о расходе (`tests/test_usage_report.py`)

Красный на старом коде:

```
FAILED tests/test_usage_report.py::test_the_month_is_counted_by_kazakhstan_time
FAILED tests/test_usage_report.py::test_hotels_are_counted_apart_and_the_assistant_is_left_out
FAILED tests/test_usage_report.py::test_cost_uses_the_input_cache_and_output_prices
FAILED tests/test_usage_report.py::test_models_without_a_price_are_named_not_guessed
FAILED tests/test_usage_report.py::test_prices_parse_and_bad_entries_are_reported
FAILED tests/test_usage_report.py::test_the_command_prints_the_report_without_guest_data
FAILED tests/test_usage_report.py::test_a_bad_month_is_refused
FAILED tests/test_usage_report.py::test_prices_setting_is_in_the_template_empty
8 failed in 0.80s
```

Зелёный после правки: 8/8. Весь набор: **1432 passed**.

## Итог

```
40 passed in 3.32s   # 4 новых файла
1432 passed in 87.91s (0:01:27)   # весь набор бота
```

Импорты: `ruff check --select F` по изменённым и новым файлам — «All checks passed!». Длинные строки: в
`engine.py` и `llm.py` их 7 до правки и 7 после — новых нет.

Вид отчёта на данных теста (цены — только для примера формата):

```
Расход модели ИИ-продавца за 2026-09 (месяц по времени Казахстана, UTC+5)

Гостиница               Ключ сейчас  Диалогов  Ответов  Токенов   Вход  Из него кэш  Выход  Стоимость
Luxx Aparts (aaaaaaaa)  платформы           2        4    3 700  2 700  1 000 (37%)    500      0.01*
Гостиница Б (bbbbbbbb)  свой                1        1    2 000  1 800       0 (0%)    200       0.01
-----------------------------------------------------------------------------------------------------
Итого                                       3        5    5 700  4 500  1 000 (22%)    700      0.01*

Стоимость — по ценам LLM_PRICES за 1 млн токенов: вход без кэша, кэш и выход — каждый по своей цене, в валюте этих цен. «*» — стоимость неполная, причина ниже.
Нет цены в LLM_PRICES: google/y — их токены в стоимость не вошли.
Ответов без разбивки (до обновления продавца): 1 — в «Токенов» вошли, в стоимость нет.
«Ключ сейчас: свой» — гостиница платит модели своим ключом (окно «Модель»); признак на сегодня, а не на весь месяц. Помощник платформы в отчёт не входит.
```
