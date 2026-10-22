import json

from voice.numbers import NumberMap, Route
from voice.platform import ProfileData, ProfileNotFound, ProfileUnavailable
from voice.profile import VoiceProfile
from voice.session_plan import PlanOk, PlanRejected, plan_call

ORG = "11111111-1111-4111-8111-111111111111"
AGENT = "22222222-2222-4222-8222-222222222222"
OTHER_ORG = "99999999-9999-4999-8999-999999999999"
META = {"organization_id": ORG, "agent_id": AGENT}
FALLBACK = VoiceProfile(object_name="Из окружения")


def _data(org=ORG, name="Салон Тест", agent=AGENT):
    return ProfileData(
        agent_id=agent, organization_id=org, vertical="BEAUTY",
        object_name=name, greeting_tail="", voice_name="Leda", handoff_phone=None,
    )


class FakeClient:
    def __init__(self, result):
        self.result = result
        self.asked = []

    async def get_profile(self, agent_id):
        self.asked.append(agent_id)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


async def test_valid_metadata_and_profile_gives_plan_with_platform_profile():
    client = FakeClient(_data())
    plan = await plan_call(META, NumberMap.from_json(""), client, FALLBACK)
    assert isinstance(plan, PlanOk)
    assert plan.route == Route(ORG, AGENT)
    assert plan.profile.object_name == "Салон Тест" and plan.source == "platform"
    assert client.asked == [AGENT]


async def test_no_route_rejects_without_asking_the_platform():
    client = FakeClient(_data())
    plan = await plan_call("garbage", NumberMap.from_json(""), client, FALLBACK)
    assert plan == PlanRejected("unknown_number")
    assert client.asked == []


async def test_organization_of_agent_must_match_metadata():
    plan = await plan_call(META, NumberMap.from_json(""), FakeClient(_data(org=OTHER_ORG)), FALLBACK)
    assert plan == PlanRejected("org_mismatch")


async def test_unknown_agent_is_rejected():
    plan = await plan_call(META, NumberMap.from_json(""), FakeClient(ProfileNotFound("404")), FALLBACK)
    assert plan == PlanRejected("unknown_agent")


SINGLE = json.dumps({"+77001112233": {"organization_id": ORG, "agent_id": AGENT}})


async def test_platform_down_single_configured_route_uses_env_profile():
    plan = await plan_call(META, NumberMap.from_json(SINGLE), FakeClient(ProfileUnavailable("x")), FALLBACK)
    assert isinstance(plan, PlanOk) and plan.source == "env"
    assert plan.profile.object_name == "Из окружения"


async def test_platform_down_without_single_route_never_uses_env_profile():
    """Профиль из окружения принадлежит одному объекту: чужому звонку его отдавать нельзя (ревью H1)."""
    for numbers in ("", json.dumps({
        "+77001112233": {"organization_id": ORG, "agent_id": AGENT},
        "+77004445566": {"organization_id": OTHER_ORG, "agent_id": "33333333-3333-4333-8333-333333333333"},
    })):
        plan = await plan_call(META, NumberMap.from_json(numbers), FakeClient(ProfileUnavailable("x")), FALLBACK)
        assert plan == PlanRejected("profile_unavailable"), numbers


async def test_platform_down_route_differs_from_the_single_configured_one():
    single_other = json.dumps({"+77001112233": {"organization_id": OTHER_ORG, "agent_id": "33333333-3333-4333-8333-333333333333"}})
    plan = await plan_call(META, NumberMap.from_json(single_other), FakeClient(ProfileUnavailable("x")), FALLBACK)
    assert plan == PlanRejected("unknown_number")  # пары нет в непустой таблице: отказ ещё до профиля


async def test_agent_in_profile_must_match_the_requested_agent():
    plan = await plan_call(META, NumberMap.from_json(""), FakeClient(_data(agent="33333333-3333-4333-8333-333333333333")), FALLBACK)
    assert plan == PlanRejected("agent_mismatch")


async def test_non_empty_map_still_limits_pairs():
    other = json.dumps({"+77001112233": {"organization_id": ORG, "agent_id": "33333333-3333-4333-8333-333333333333"}})
    plan = await plan_call(META, NumberMap.from_json(other), FakeClient(_data()), FALLBACK)
    assert plan == PlanRejected("unknown_number")
