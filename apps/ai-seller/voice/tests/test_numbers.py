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
