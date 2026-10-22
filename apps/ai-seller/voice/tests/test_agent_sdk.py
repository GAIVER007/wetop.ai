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


def _tools(tmp_path):
    profile = VoiceProfile(object_name="Салон")
    journal = CallJournal(tmp_path / "c.jsonl")
    return profile, journal, VoiceTools(
        call_id="c1", route=ROUTE, journal=journal, catalog=_Catalog(), profile=profile
    )


def test_three_tools_are_registered_with_descriptions(tmp_path):
    _, _, tools = _tools(tmp_path)
    built = make_function_tools(tools)
    names = sorted(t._tool_info.name for t in built)
    assert names == ["get_services", "request_callback", "transfer_to_human"]
    assert all(t._tool_info.description for t in built)


async def test_wrapped_tool_calls_through_to_logic(tmp_path):
    _, _, tools = _tools(tmp_path)
    by_name = {t._tool_info.name: t for t in make_function_tools(tools)}
    assert "администратор" in (await by_name["get_services"]()).lower()


def test_agent_builds_with_instructions_and_tools(tmp_path):
    profile, journal, tools = _tools(tmp_path)
    agent = VoiceAgent(profile=profile, tools=tools, journal=journal, route=ROUTE, call_id="c1")
    assert "не считай" in agent.instructions.lower()
    assert len(agent.tools) == 3
    assert RejectAgent() is not None
