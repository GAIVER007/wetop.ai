"""Проверка обвязки SDK. Пропускается, если videosdk-agents не установлен."""

import pytest

pytest.importorskip("videosdk.agents")

from voice.agent import VoiceAgent, RejectAgent, make_function_tools  # noqa: E402
from voice.journal import CallJournal  # noqa: E402
from voice.numbers import Route  # noqa: E402
from voice.profile import VoiceProfile  # noqa: E402
from voice.tools import VoiceTools  # noqa: E402

ROUTE = Route(
    organization_id="11111111-1111-4111-8111-111111111111",
    agent_id="22222222-2222-4222-8222-222222222222",
)


class _Catalog:
    async def beauty_services(self, agent_id):
        return []

    async def food_service_periods(self, agent_id):
        return []


def _tools(tmp_path):
    profile = VoiceProfile(object_name="Салон")
    journal = CallJournal(tmp_path / "c.jsonl")
    return profile, journal, VoiceTools(
        call_id="c1", route=ROUTE, journal=journal, catalog=_Catalog(), profile=profile
    )


def test_three_tools_are_registered_with_descriptions(tmp_path):
    _, _, tools = _tools(tmp_path)
    built = make_function_tools(tools, "BEAUTY")
    names = sorted(t._tool_info.name for t in built)
    assert names == ["get_services", "request_callback", "transfer_to_human"]
    assert all(t._tool_info.description for t in built)


async def test_wrapped_tool_calls_through_to_logic(tmp_path):
    _, _, tools = _tools(tmp_path)
    by_name = {t._tool_info.name: t for t in make_function_tools(tools, "BEAUTY")}
    assert "администратор" in (await by_name["get_services"]()).lower()


def test_agent_builds_with_instructions_and_tools(tmp_path):
    profile, journal, tools = _tools(tmp_path)
    agent = VoiceAgent(profile=profile, tools=tools, journal=journal, route=ROUTE, call_id="c1")
    assert "не считай" in agent.instructions.lower()
    assert len(agent.tools) == 3
    assert RejectAgent() is not None


@pytest.mark.parametrize(
    "vertical, expected",
    [
        ("BEAUTY", ["get_services", "request_callback", "transfer_to_human"]),
        ("FOOD_SERVICE", ["get_service_hours", "request_callback", "transfer_to_human"]),
        ("HOSPITALITY", ["request_callback", "transfer_to_human"]),
    ],
)
def test_tool_set_follows_the_vertical(tmp_path, vertical, expected):
    _, _, tools = _tools(tmp_path)
    built = make_function_tools(tools, vertical)
    assert sorted(t._tool_info.name for t in built) == sorted(expected)


def test_hotel_gets_booking_tools_only_when_booking_is_on(tmp_path):
    _, _, tools = _tools(tmp_path)
    off = sorted(t._tool_info.name for t in make_function_tools(tools, "HOSPITALITY", False))
    on = sorted(t._tool_info.name for t in make_function_tools(tools, "HOSPITALITY", True))
    assert off == ["request_callback", "transfer_to_human"]
    assert on == ["check_availability", "confirm_booking", "quote_stay", "request_callback", "transfer_to_human"]
    # других направлений бронь по телефону не касается
    for vertical in ("BEAUTY", "FOOD_SERVICE"):
        names = [t._tool_info.name for t in make_function_tools(tools, vertical, True)]
        assert "confirm_booking" not in names


def test_salon_gets_booking_tools_only_when_booking_is_on(tmp_path):
    _, _, tools = _tools(tmp_path)
    off = sorted(t._tool_info.name for t in make_function_tools(tools, "BEAUTY", False))
    on = sorted(t._tool_info.name for t in make_function_tools(tools, "BEAUTY", True))
    assert off == ["get_services", "request_callback", "transfer_to_human"]
    assert on == ["confirm_visit", "find_slots", "get_masters", "get_services", "quote_visit", "request_callback", "transfer_to_human"]
    assert "confirm_visit" not in [t._tool_info.name for t in make_function_tools(tools, "FOOD_SERVICE", True)]


def test_restaurant_gets_booking_tools_only_when_booking_is_on(tmp_path):
    _, _, tools = _tools(tmp_path)
    off = sorted(t._tool_info.name for t in make_function_tools(tools, "FOOD_SERVICE", False))
    on = sorted(t._tool_info.name for t in make_function_tools(tools, "FOOD_SERVICE", True))
    assert off == ["get_service_hours", "request_callback", "transfer_to_human"]
    assert on == ["check_table", "confirm_table", "get_service_hours", "quote_table", "request_callback", "transfer_to_human"]
