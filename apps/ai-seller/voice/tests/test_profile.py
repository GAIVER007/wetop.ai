from voice.profile import VoiceProfile, build_instructions, opening_line


def _profile(**kw):
    return VoiceProfile(object_name="Салон Тест", **kw)


def test_opening_says_it_is_ai_and_that_call_is_recorded():
    text = opening_line(_profile())
    assert "ИИ" in text
    assert "записывается" in text
    assert "Салон Тест" in text


def test_instructions_carry_the_bot_prohibitions():
    text = build_instructions(_profile(), services_hint="")
    for must in ("не считай", "не обещай", "диагноз", "администратор"):
        assert must in text.lower()


def test_instructions_forbid_booking_in_first_slice():
    text = build_instructions(_profile(), services_hint="")
    assert "запись" in text.lower()
    assert "не оформляй запись" in text.lower()


def test_no_long_dash_in_texts():
    assert chr(0x2014) not in opening_line(_profile())
    assert chr(0x2014) not in build_instructions(_profile(), services_hint="")


def test_from_env_defaults_and_overrides():
    p = VoiceProfile.from_env(
        {"VOICE_OBJECT_NAME": "Объект", "VOICE_HANDOFF_NUMBER": "8 700 111 22 33", "VOICE_NAME": "Puck"}
    )
    assert p.object_name == "Объект"
    assert p.handoff_number == "+77001112233"
    assert p.voice == "Puck"
    default = VoiceProfile.from_env({})
    assert default.voice == "Leda"
    assert default.handoff_number is None


def test_bad_handoff_number_is_dropped_not_dialed():
    assert VoiceProfile.from_env({"VOICE_HANDOFF_NUMBER": "abc"}).handoff_number is None


def test_from_api_uses_platform_values():
    from voice.platform import ProfileData

    data = ProfileData(
        agent_id="a", organization_id="o",
        object_name="Салон Тест", greeting_tail="Работаем до 20 часов.", voice_name="Puck", handoff_phone="8 700 111 22 33",
    )
    p = VoiceProfile.from_api(data)
    assert (p.object_name, p.voice, p.handoff_number) == ("Салон Тест", "Puck", "+77001112233")
    text = opening_line(p)
    assert "Работаем до 20 часов." in text and "ИИ" in text and "записывается" in text


def test_greeting_tail_is_sanitised():
    p = VoiceProfile(object_name="Салон", greeting_tail="  строка\x00 с мусором  ")
    assert "\x00" not in opening_line(p)
