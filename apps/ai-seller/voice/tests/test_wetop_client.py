import httpx
import pytest

from voice.wetop_client import CatalogUnavailable, WetopCatalog

AGENT = "22222222-2222-4222-8222-222222222222"


def _client(handler):
    return WetopCatalog(
        base_url="https://wetop.test",
        service_key="k-test",
        http=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


async def test_sends_key_in_header_and_agent_in_query():
    seen = {}

    def handler(req: httpx.Request):
        seen["key"] = req.headers.get("x-wetop-service-key")
        seen["agent"] = req.url.params.get("agent")
        seen["url"] = str(req.url)
        return httpx.Response(200, json={"context": {}, "items": []})

    await _client(handler).beauty_services(AGENT)
    assert seen["key"] == "k-test"
    assert seen["agent"] == AGENT
    assert "k-test" not in seen["url"]


async def test_returns_items():
    items = [{"name": "Стрижка", "category": None, "durationMinutes": 60, "priceMinor": "500000", "currency": "KZT"}]
    c = _client(lambda r: httpx.Response(200, json={"context": {}, "items": items}))
    assert await c.beauty_services(AGENT) == items


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, json={}),
        httpx.Response(200, json={"error": "nope"}),
        httpx.Response(200, json={"items": "not a list"}),
        httpx.Response(200, text="not json"),
    ],
)
async def test_any_failure_is_catalog_unavailable(response):
    with pytest.raises(CatalogUnavailable):
        await _client(lambda r: response).beauty_services(AGENT)


async def test_network_error_is_catalog_unavailable():
    def boom(req):
        raise httpx.ConnectError("secret-host")

    with pytest.raises(CatalogUnavailable) as err:
        await _client(boom).beauty_services(AGENT)
    assert "secret-host" not in str(err.value)
