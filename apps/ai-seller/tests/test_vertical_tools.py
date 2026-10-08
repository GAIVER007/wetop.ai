import asyncio
from types import SimpleNamespace
import pytest
from src import dependencies
from src.ai.vertical_tools import build_vertical_registry
A = "11111111-1111-4111-8111-111111111111"
O = "22222222-2222-4222-8222-222222222222"
B = "33333333-3333-4333-8333-333333333333"
L = "44444444-4444-4444-8444-444444444444"
def context(v="BEAUTY"):
    caps = {"BEAUTY": ["beauty.services"], "FOOD_SERVICE": ["food.servicePeriods"],
            "HOSPITALITY": ["hotel.availability", "hotel.price", "hotel.booking"]}
    return dict(agentId=A, organizationId=O, businessId=B, locationId=L, vertical=v,
                timezone="Asia/Almaty", currency="KZT", capabilities=caps[v])
class Provider:
    def __init__(self, binding): self.binding, self.reads = binding, []
    async def agent_context(self):
        await asyncio.sleep(0)
        return dict(self.binding)
    async def beauty_services(self):
        self.reads.append("beauty")
        return {"context": dict(self.binding), "items": [dict(name="Услуга", category=None,
            priceMinor="12000", currency="KZT", durationMinutes=45)]}
    async def food_service_periods(self):
        self.reads.append("food")
        return {"context": dict(self.binding), "items": [dict(name="Ужин", weekday=2,
            timeFrom="18:00", timeTo="23:00", endsNextDay=False, defaultDurationMinutes=90)]}
@pytest.fixture(autouse=True)
def turn_scope():
    a = dependencies.agent_id_var.set(A); o = dependencies.organization_id_var.set(O)
    yield
    dependencies.agent_id_var.reset(a); dependencies.organization_id_var.reset(o)
async def registry(p):
    return await build_vertical_registry(lambda: SimpleNamespace(mode="wetop", availability=p))
@pytest.mark.parametrize("v,names", [("BEAUTY", ["get_beauty_services"]),
    ("FOOD_SERVICE", ["get_food_service_periods"]), ("HOSPITALITY", ["check_availability", "get_price"])])
async def test_server_selected_toolset(v, names):
    p = Provider(context(v)); r = await registry(p)
    assert r.names == names and p.reads == []
async def test_foreign_binding_fails_closed():
    c = context(); c["organizationId"] = B; p = Provider(c)
    assert (await registry(p)).names == [] and p.reads == []
async def test_changed_location_no_domain():
    p = Provider(context()); r = await registry(p); p.binding["locationId"] = B
    assert "недоступ" in await r._run("get_beauty_services", {})
    assert p.reads == []
async def test_cross_vertical_and_scope_arguments():
    p = Provider(context()); r = await registry(p)
    assert await r._run("get_food_service_periods", {}) == "инструмент недоступен"
    assert await r._run("get_beauty_services", {"locationId": L}) == "неверные аргументы"
    assert p.reads == []
async def test_catalog_has_no_context_ids():
    p = Provider(context()); r = await registry(p); result = await r._run("get_beauty_services", {})
    assert "12000" in result and "Услуга" in result and A not in result and L not in result
    assert p.reads == ["beauty"]
async def test_unknown_capability_no_fallback():
    c = context(); c["capabilities"].append("hotel.booking")
    assert (await registry(Provider(c))).names == []
async def test_concurrent_registries_independent():
    p, q = Provider(context()), Provider(context("FOOD_SERVICE"))
    a, b = await asyncio.gather(registry(p), registry(q))
    assert a.names == ["get_beauty_services"] and b.names == ["get_food_service_periods"]
    x, y = await asyncio.gather(a._run(a.names[0], {}), b._run(b.names[0], {}))
    assert "Услуга" in x and "Ужин" in y
async def test_unavailable_context_no_tools():
    p = Provider(context())
    async def fail(): raise RuntimeError("offline")
    p.agent_context = fail
    assert (await registry(p)).names == []

async def test_bound_agent_cannot_use_stub_hotel_fallback():
    p = Provider(context())
    r = await build_vertical_registry(lambda: SimpleNamespace(mode="stub", availability=p))
    assert r.names == [] and p.reads == []

async def test_pii_or_bad_price_in_catalog_is_rejected():
    p = Provider(context())
    async def private():
        return {"context": dict(p.binding), "items": [{"name": "Услуга", "category": None,
            "priceMinor": "12.5", "currency": "KZT", "durationMinutes": 45, "phone": "private"}]}
    p.beauty_services = private
    r = await registry(p)
    result = await r._run("get_beauty_services", {})
    assert "недоступ" in result and "private" not in result

async def test_anonymous_unknown_provider_mode_has_no_hotel_fallback():
    a = dependencies.agent_id_var.set(None)
    o = dependencies.organization_id_var.set(None)
    try:
        registry = await build_vertical_registry(lambda: SimpleNamespace(mode='unknown'))
        assert registry.names == []
    finally:
        dependencies.agent_id_var.reset(a); dependencies.organization_id_var.reset(o)

async def test_food_period_days_and_timezone_are_explicit():
    r = await registry(Provider(context("FOOD_SERVICE")))
    assert "0=воскресенье" in r.get("get_food_service_periods").description
    assert "6=суббота" in r.get("get_food_service_periods").description
    assert "Asia/Almaty" in r.system_message

@pytest.mark.parametrize("vertical", ["BEAUTY", "FOOD_SERVICE"])
async def test_verified_vertical_overrides_legacy_hotel_role(vertical):
    r = await registry(Provider(context(vertical)))
    assert "Гостиничная роль и сценарии размещения к этому ходу не применяются" in r.system_message

async def test_failed_binding_instructs_honest_unavailability():
    c = context(); c["agentId"] = B
    r = await registry(Provider(c))
    assert r.names == []
    assert "Направление бизнеса не подтверждено" in r.system_message
