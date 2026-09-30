"""Шаг 3: проверка ответа (слой 7). Промпт просит, проверка гарантирует:
всё, что клиент может проверить сам, проверяется кодом после модели."""

from src.ai.guardrails import OutputContext, check_output

FALLBACK = "Уточню у администратора и вернусь к вам."
CONTACT_FALLBACK = "Продолжим здесь, в чате."


def _ctx(**overrides) -> OutputContext:
    params = dict(first_turn=True, contact_known=False, allowed_prices=None, allowed_urls=set())
    params.update(overrides)
    return OutputContext(**params)


def test_clean_answer_is_untouched() -> None:
    answer = "Заезд с 14:00, выезд до 12:00. Парковка есть."
    verdict = check_output(answer, _ctx(first_turn=False, contact_known=True))
    assert verdict.text == answer
    assert verdict.edits == []


def test_a_repeated_greeting_is_removed_but_first_turn_keeps_it() -> None:
    answer = "Здравствуйте! Заезд с 14:00."
    verdict = check_output(answer, _ctx(first_turn=False))
    assert "Здравствуйте" not in verdict.text
    assert "Заезд с 14:00." in verdict.text
    assert "greeting" in verdict.edits

    verdict = check_output("Добрый день! Заезд с 14:00.", _ctx(first_turn=True))
    assert verdict.text.startswith("Добрый день")
    assert verdict.edits == []


def test_b_false_contact_claim_is_replaced() -> None:
    verdict = check_output("Записал ваш номер. Администратор перезвонит.", _ctx(contact_known=False))
    assert "Записал" not in verdict.text
    assert CONTACT_FALLBACK in verdict.text
    assert "Администратор перезвонит." in verdict.text
    assert "false_contact" in verdict.edits

    # Контакт действительно есть: «передал ваш телефон» — правда.
    verdict = check_output("Передал ваш телефон администратору.", _ctx(contact_known=True))
    assert verdict.edits == []


def test_c_contact_request_removed_when_contact_known() -> None:
    answer = "Оставьте ваш номер, и мы перезвоним. Номер на двоих свободен."
    verdict = check_output(answer, _ctx(contact_known=True))
    assert "Оставьте" not in verdict.text
    assert "Номер на двоих свободен." in verdict.text
    assert len(verdict.edits) == 1

    verdict = check_output(answer, _ctx(contact_known=False))
    assert "Оставьте" not in verdict.text
    assert "ask_contact" in verdict.edits


def test_d_unknown_url_is_removed_allowed_stays() -> None:
    answer = "Фото номеров: https://example.com/rooms и https://evil.example.org/x?y=1 — смотрите."
    verdict = check_output(answer, _ctx(allowed_urls={"https://example.com"}))
    assert "https://example.com/rooms" in verdict.text
    assert "evil.example.org" not in verdict.text
    assert len(verdict.edits) == 1


def test_e_unknown_price_is_replaced_known_stays() -> None:
    ctx = _ctx(allowed_prices={15000})
    verdict = check_output("Стандарт стоит 20000 тенге в сутки. Заезд с 14:00.", ctx)
    assert "20000" not in verdict.text
    assert "Точную стоимость подтвердит администратор." in verdict.text
    assert "Заезд с 14:00." in verdict.text
    assert len(verdict.edits) == 1

    verdict = check_output("Стандарт стоит 15000 ₸ в сутки.", ctx)
    assert verdict.edits == []

    # allowed_prices=None — цены не проверяются (клиент без карточки цен).
    verdict = check_output("Стандарт стоит 20000 тенге.", _ctx(allowed_prices=None))
    assert verdict.edits == []


def test_f_promised_action_is_reassigned_to_admin() -> None:
    verdict = check_output("Сейчас пришлю прайс на почту.", _ctx())
    assert "администратор пришлёт" in verdict.text.lower()
    assert "сейчас пришлю" not in verdict.text.lower()
    assert "прайс" in verdict.text
    assert len(verdict.edits) == 1


def test_g_disavowal_sentences_are_removed() -> None:
    answer = "Возможно, это уже неактуально. Прежняя цена была ошибкой. Заезд с 14:00."
    verdict = check_output(answer, _ctx())
    assert "неактуально" not in verdict.text
    assert "ошибкой" not in verdict.text
    assert "Заезд с 14:00." in verdict.text
    assert len(verdict.edits) >= 1


def test_empty_result_is_replaced_with_fallback() -> None:
    verdict = check_output("Здравствуйте!", _ctx(first_turn=False))
    assert verdict.text == FALLBACK
    assert "greeting" in verdict.edits


def test_c_room_number_is_not_a_contact_request() -> None:
    # В отеле «номер» — комната: без «ваш/телефон» предложение не трогаем.
    ctx = _ctx(contact_known=True)
    for answer in (
        "Укажите, какой номер вам подходит: студия или двухкомнатный.",
        "Укажите, пожалуйста, номер брони.",
        "Напишите номер комнаты, и горничная подойдёт.",
    ):
        verdict = check_output(answer, ctx)
        assert verdict.text == answer
        assert verdict.edits == []
    verdict = check_output("Оставьте номер телефона, и мы перезвоним.", ctx)
    assert "ask_contact" in verdict.edits


def test_b_room_number_is_not_a_false_contact_claim() -> None:
    answer = "Приняла заявку: номер люкс на 3 ночи."
    verdict = check_output(answer, _ctx(contact_known=False))
    assert verdict.text == answer
    assert verdict.edits == []


def test_f_promise_with_leading_pronoun_is_replaced_whole() -> None:
    verdict = check_output("Я сейчас пришлю прайс.", _ctx())
    assert verdict.text == "Администратор пришлёт прайс."
    assert verdict.edits == ["promise_action"]


def test_d_url_removal_keeps_trailing_punctuation() -> None:
    answer = "Смотрите https://evil.example.org. Заезд с 14:00."
    verdict = check_output(answer, _ctx(allowed_urls=set()))
    assert "evil.example.org" not in verdict.text
    assert "Смотрите. Заезд с 14:00." == verdict.text


def test_e_shirts_are_not_rubles() -> None:
    answer = "В номере есть 2 рубашки для стирки."
    verdict = check_output(answer, _ctx(allowed_prices={15000}))
    assert verdict.text == answer
    assert verdict.edits == []
    verdict = check_output("Стирка 300 руб. за штуку.", _ctx(allowed_prices={15000}))
    assert "price" in verdict.edits


def test_e_price_regex_is_linear_on_long_digit_rows() -> None:
    import time

    answer = " ".join(["1"] * 4000)
    started = time.perf_counter()
    check_output(answer, _ctx(allowed_prices={15000}))
    assert time.perf_counter() - started < 0.05


def test_phone_questions_removed_even_when_channel_context_missing() -> None:
    for question in ("Какой у вас телефон?", "По какому номеру с вами связаться?", "Ваш номер телефона?", "Напишите, пожалуйста, ваш телефон."):
        verdict = check_output("Заезд с 14:00. " + question, _ctx())
        assert verdict.text == "Заезд с 14:00."
        assert "ask_contact" in verdict.edits
