import json

import pytest

from voice.numbers import NumberMap, NumberMapError, Route

ORG = "11111111-1111-4111-8111-111111111111"
AGENT = "22222222-2222-4222-8222-222222222222"


def _map(**kw):
    return json.dumps({"+77001112233": {"organization_id": ORG, "agent_id": AGENT, **kw}})


def test_resolve_known_number_in_any_format():
    numbers = NumberMap.from_json(_map())
    route = numbers.resolve("8 (700) 111-22-33")
    assert route is not None
    assert route.organization_id == ORG
    assert route.agent_id == AGENT


def test_unknown_number_resolves_to_none():
    assert NumberMap.from_json(_map()).resolve("+77009998877") is None
    assert NumberMap.from_json(_map()).resolve(None) is None


def test_empty_config_is_empty_map_not_error():
    assert NumberMap.from_json("").resolve("+77001112233") is None
    assert NumberMap.from_json("{}").resolve("+77001112233") is None


@pytest.mark.parametrize(
    "text",
    [
        "not json",
        '["list"]',
        json.dumps({"+77001112233": {"organization_id": ORG}}),
        json.dumps({"+77001112233": {"organization_id": "x", "agent_id": AGENT}}),
        json.dumps({"bad": {"organization_id": ORG, "agent_id": AGENT}}),
    ],
)
def test_broken_config_fails_loudly_at_startup(text):
    with pytest.raises(NumberMapError):
        NumberMap.from_json(text)


def test_duplicate_numbers_after_normalization_are_rejected():
    text = json.dumps(
        {
            "+77001112233": {"organization_id": ORG, "agent_id": AGENT},
            "8 700 111 22 33": {"organization_id": ORG, "agent_id": AGENT},
        }
    )
    with pytest.raises(NumberMapError):
        NumberMap.from_json(text)


def test_route_from_dispatch_metadata():
    from voice.numbers import route_from_metadata

    route = route_from_metadata({"organization_id": ORG, "agent_id": AGENT})
    assert route == Route(organization_id=ORG, agent_id=AGENT)


@pytest.mark.parametrize(
    "meta",
    [None, {}, "text", {"organization_id": ORG}, {"organization_id": "x", "agent_id": AGENT}],
)
def test_bad_dispatch_metadata_is_none(meta):
    from voice.numbers import route_from_metadata

    assert route_from_metadata(meta) is None


def test_sole_route_only_when_exactly_one_number():
    one = NumberMap.from_json(_map())
    assert one.sole_route() == Route(organization_id=ORG, agent_id=AGENT)
    two = NumberMap.from_json(
        json.dumps(
            {
                "+77001112233": {"organization_id": ORG, "agent_id": AGENT},
                "+77004445566": {"organization_id": ORG, "agent_id": AGENT},
            }
        )
    )
    assert two.sole_route() is None
    assert NumberMap.from_json("").sole_route() is None


def test_decide_route_metadata_must_match_configured_route():
    from voice.numbers import decide_route

    numbers = NumberMap.from_json(_map())
    ok = {"organization_id": ORG, "agent_id": AGENT}
    assert decide_route(ok, numbers) == Route(ORG, AGENT)
    other_agent = {"organization_id": ORG, "agent_id": "33333333-3333-4333-8333-333333333333"}
    assert decide_route(other_agent, numbers) is None


def test_decide_route_mixed_org_and_agent_is_rejected():
    from voice.numbers import decide_route

    numbers = NumberMap.from_json(_map())
    mixed = {"organization_id": "44444444-4444-4444-8444-444444444444", "agent_id": AGENT}
    assert decide_route(mixed, numbers) is None


@pytest.mark.parametrize("meta", ["garbage", {"organization_id": "x"}, [1], 5])
def test_decide_route_invalid_metadata_does_not_fall_back_to_sole_route(meta):
    from voice.numbers import decide_route

    assert decide_route(meta, NumberMap.from_json(_map())) is None


@pytest.mark.parametrize("meta", [None, {}, "", "{}"])
def test_decide_route_absent_metadata_uses_sole_route(meta):
    from voice.numbers import decide_route

    assert decide_route(meta, NumberMap.from_json(_map())) == Route(ORG, AGENT)


def test_decide_route_accepts_json_string_metadata():
    from voice.numbers import decide_route

    text = json.dumps({"organization_id": ORG, "agent_id": AGENT})
    assert decide_route(text, NumberMap.from_json(_map())) == Route(ORG, AGENT)


def test_empty_map_trusts_valid_metadata_api_checks_the_agent():
    from voice.numbers import decide_route

    meta = {"organization_id": ORG, "agent_id": AGENT}
    assert decide_route(meta, NumberMap.from_json("")) == Route(ORG, AGENT)
    assert decide_route("garbage", NumberMap.from_json("")) is None
    assert decide_route(None, NumberMap.from_json("")) is None
