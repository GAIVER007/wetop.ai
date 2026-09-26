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
  незнакомая роль больше не сводится к помощнику, бот не стартует (С-60, ADR-095).
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

## Ревизия исправлений: гомоглифы, бюджет токенов, доля вложений (26.09.2026)

Три находки перепроверки пакета F. Новые тесты — в конце `tests/test_security_2026_09_26.py`.

**Красный до кода** (`python -m pytest -q tests/test_security_2026_09_26.py`, код до правок):

```
FAILED test_lookalikes_from_any_alphabet_do_not_hide_an_injection[...] × 7   (С-51: «РRОМРТ» кириллицей,
       «ІGNОRЕ PRЕVІОUS ІNSTRUСTІОNS» с украинской І и с «У» на месте U, греческие Ι и Α, македонская ѕ,
       греческая Ο в «прΟмпт»)
FAILED test_failed_paid_calls_count_toward_the_budget        (С-10: неудачный платный вызов не списывался; 3 вызова из 2)
FAILED test_parallel_calls_do_not_overrun_the_budget         (проверка и списание врозь: 4 параллельных вызова из 4)
FAILED test_cascade_reports_tokens_of_failed_stages          (tokens_used = 12 вместо 30 + 12)
FAILED test_one_hotel_filling_its_share_does_not_block_another   (С-62: вложение не в папке гостиницы)
11 failed, 21 passed
```

Зелёные и до правок — ограждения: обычный русский, казахский и английский текст не даёт `refuse` ни в одной
свёртке (5), счётчик бюджета не уходит ниже нуля и истекает (1).

**Что сделано.** Шаблоны проверяются на тексте как есть, целиком в латинице и целиком в кириллице; буква слова —
любая буква (`[^\W\d_]`), в таблицы добавлены І/і, Ј/ј, Ѕ/ѕ, Һ/һ, Ӏ/ӏ и греческие двойники; к сбросу
инструкций — «ignore <одно слово> instructions» (кроме «my»). Каскад суммирует токены всех ступеней и отдаёт их
и при отказе; движок резервирует под вызов `LLM_MAX_TOKENS` одной операцией `INCRBY`, после вызова — фактический
расход при любом исходе, счётчик не ниже нуля. У продавца вложения — в подпапке организации с долей
`WIDGET_ATTACHMENT_ORG_MAX_MB=100` внутри общего предела папки.

**Зелёный после кода:**

```
$ python -m pytest -q tests/test_security_2026_09_26.py
32 passed

$ python -m pytest -q          # весь набор бота, дважды подряд
1379 passed in 113.81s (0:01:53)
1379 passed in 110.75s (0:01:50)
```

## Слияние с `main` (26.09.2026, вечер)

В `main` к этому времени пришли WhatsApp продавца, ключ модели партнёра (`cryptography`, Fernet), подписка в
техподдержке и котировка продавца. Ветка исправлений слита с `main`; конфликт в боте — только `env.example`
(оставлены обе переменные: `LLM_DAILY_TOKEN_BUDGET` и `LLM_KEYS_SECRET`), код бота слился без конфликтов.

```
$ pip install "cryptography>=46,<47"   # новая зависимость из main
$ python -m pytest -q                  # весь набор бота, дважды подряд
1424 passed, 1 warning in 95.63s       # предупреждение — незакрытый поток aiosqlite в чужом тесте, во втором прогоне нет
1424 passed in 95.74s
```
