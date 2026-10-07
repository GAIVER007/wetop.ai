"""Real loopback WETOP provider/registry readback, synthetic fixtures only."""
import asyncio
import json
import os
from types import SimpleNamespace
import httpx
from src import dependencies
from src.config import Settings
from src.integrations.wetop import WetopProviders
from src.ai.vertical_tools import build_vertical_registry

async def main():
    config = json.loads(os.environ['MV10_RUNTIME_FIXTURE'])
    calls = []
    async def record(request):
        calls.append(request.url.path)
    async with httpx.AsyncClient(event_hooks={'request': [record]}) as http:
        settings = Settings(integration_base_url=config['url'], integration_api_key='synthetic-mv10-key')
        provider = WetopProviders(settings, http)
        async def turn(agent, name, expected):
            a = dependencies.agent_id_var.set(agent)
            o = dependencies.organization_id_var.set(config['organization'])
            try:
                registry = await build_vertical_registry(lambda: SimpleNamespace(mode='wetop', availability=provider))
                assert registry.names == [name]
                count = len(calls)
                assert await registry._run('create_booking', {}) == 'инструмент недоступен'
                assert await registry._run(name, {'locationId': config['foreignLocation']}) == 'неверные аргументы'
                assert len(calls) == count
                output = json.loads(await registry._run(name, {}))
                assert output == expected, output
                return {'tool': name, 'items': output, 'forgedScope': 'denied-before-HTTP', 'foreignTool': 'denied-before-HTTP'}
            finally:
                dependencies.agent_id_var.reset(a)
                dependencies.organization_id_var.reset(o)
        results = await asyncio.gather(
            turn(config['beautyAgent'], 'get_beauty_services', [{'name': 'Услуга', 'category': None, 'durationMinutes': 45, 'priceMinor': '12000', 'currency': 'KZT'}]),
            turn(config['foodAgent'], 'get_food_service_periods', [{'name': 'Ужин', 'weekday': 2, 'timeFrom': '18:00', 'timeTo': '23:00', 'endsNextDay': False, 'defaultDurationMinutes': 90}]),
        )
        a = dependencies.agent_id_var.set(config['hotelAgent'])
        o = dependencies.organization_id_var.set(config['organization'])
        try:
            hotel = await build_vertical_registry(lambda: SimpleNamespace(mode='wetop', availability=provider))
            assert hotel.names == ['check_availability', 'get_price']
        finally:
            dependencies.agent_id_var.reset(a); dependencies.organization_id_var.reset(o)
        assert all(p in {'/bot/agent-context', '/bot/beauty-services', '/bot/food-service-periods'} for p in calls)
        print(json.dumps({'results': results, 'hotelTools': hotel.names, 'HTTPPaths': calls}, ensure_ascii=False, indent=2))
asyncio.run(main())
