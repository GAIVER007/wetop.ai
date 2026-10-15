import asyncio
from types import SimpleNamespace
from src import dependencies
from src.ai.vertical_tools import build_vertical_registry
from tests.test_vertical_tools import Provider, context, A, O
async def check():
    a = dependencies.agent_id_var.set(A); o = dependencies.organization_id_var.set(O)
    try:
        r = await build_vertical_registry(lambda: SimpleNamespace(mode='wetop', availability=Provider(context('FOOD_SERVICE'))))
        assert '0=воскресенье' in r.get('get_food_service_periods').description
        assert 'Asia/Almaty' in r.system_message
    finally:
        dependencies.agent_id_var.reset(a); dependencies.organization_id_var.reset(o)
asyncio.run(check())
