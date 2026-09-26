# Прогоны pytest бота — пакет F исправлений по аудиту комиссии (26.09.2026)

Журнал `test:record` pytest бота не знает, поэтому доказательства — здесь, как в отчётах Э3 и Э4.
Прогоны из `apps/ai-seller`, окружение — `requirements.txt` без torch и sentence-transformers (эмбеддер в тестах —
`HashingBackend` из `tests/kb_fakes.py`), Python 3.11.

## До правок — базовый прогон

```
$ python -m pytest -q
1347 passed in 85.14s (0:01:25)
```

## Красный до кода (red before green)

Новый файл `tests/test_security_2026_09_26.py`, прогон на коде до правок:

```
$ python -m pytest -q tests/test_security_2026_09_26.py
FAILED test_unknown_role_refuses_to_start                                  (С-60)
FAILED test_known_and_empty_roles_still_start[ Seller -seller]
FAILED test_known_and_empty_roles_still_start[SUPPORT-support]
FAILED test_seller_panel_human_cannot_pick_an_organization                 (X-Organization)
FAILED test_visitor_ip_behind_the_tunnel_comes_from_cloudflare_header       (С-63)
FAILED test_cyrillic_letters_do_not_hide_an_english_injection               (С-51)
FAILED test_zip_bomb_document_is_refused_before_parsing                     (С-57)
FAILED test_taken_over_conversation_does_not_call_the_model                 (С-59)
FAILED test_daily_token_budget_stops_paid_calls                             (С-10 от 25.09)
FAILED test_database_errors_do_not_print_query_parameters                   (С-41)
FAILED test_uvicorn_and_gunicorn_loggers_get_the_pii_mask                   (С-41)
11 failed, 3 passed
```

Три зелёных и до правок — проверки, что правка не ломает рабочее: пустая роль остаётся помощником, служебный ключ
платформы по-прежнему выбирает организацию, русские слова не трогаются гомоглифами. Тест папки вложений (С-62)
дописан следом и тоже был красным (`200` вместо `507`, старый файл не удалён).

## Прежние тесты, переписанные под новое правило

- `tests/test_support_role.py::test_unknown_role_falls_back_to_support` → `test_unknown_role_refuses_to_start`:
  незнакомая роль больше не сводится к помощнику, бот не стартует (С-60, ADR-085).
- `tests/test_service_key.py::test_mistyped_role_keeps_the_rules_closed`: цель та же — опечатка не открывает правила
  ключу; теперь закрыто всё, потому что бот не стартует.
- `tests/test_step3_normalize.py::test_latin_word_stays_latin` не менялся: он поймал лишнее в первой версии обратных
  гомоглифов («hotelь» → «hotelb»). В латиницу теперь переводятся только буквы, которые пишутся так же.

## Зелёный после кода

```
$ python -m pytest -q tests/test_security_2026_09_26.py
15 passed in 1.92s

$ python -m pytest -q          # весь набор бота, дважды подряд
1362 passed in 84.08s (0:01:24)
1362 passed in 83.44s (0:01:23)
```

По ходу: первая версия теста С-41 обнуляла общий движок базы, который уже держали другие тесты, и его соединения
падали потом в закрытом цикле событий (предупреждение pytest в двух прогонах). Тест исправлен: движок проверяется, но
не бросается; после этого два прогона подряд без предупреждений.
