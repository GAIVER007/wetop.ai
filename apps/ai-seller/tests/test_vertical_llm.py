import asyncio
from contextvars import ContextVar
from src.ai.llm import CascadeClient
from src.ai.tools import ToolRegistry, ToolSpec
from tests.llm_fakes import PRIMARY, ScriptedRouter, chat_response, llm_env
FINAL = '{"reply": "Уточнит администратор.", "needs_human": false}'
async def test_each_concurrent_generate_owns_registry(monkeypatch):
    settings = llm_env(monkeypatch)
    current = ContextVar('test_vertical', default='beauty')
    async def factory():
        name = current.get()
        await asyncio.sleep(0)
        r = ToolRegistry()
        async def read(): return name
        r.register(ToolSpec(name=name, description=name, parameters={"type": "object", "properties": {}}, handler=read))
        return r
    router = ScriptedRouter({PRIMARY: [chat_response(FINAL, model=PRIMARY), chat_response(FINAL, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client(), tools_getter=factory)
    async def run(name):
        token = current.set(name)
        try: return await client.generate([{"role": "user", "content": name}])
        finally: current.reset(token)
    results = await asyncio.gather(run('beauty'), run('food'))
    assert all(r.ok for r in results)
    assert sorted(c['tools'][0]['function']['name'] for c in router.calls) == ['beauty', 'food']
async def test_no_tools_generation_never_loads_agent_context(monkeypatch):
    settings = llm_env(monkeypatch)
    async def factory(): raise AssertionError('not an agent turn')
    router = ScriptedRouter({PRIMARY: [chat_response(FINAL, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client(), tools_getter=factory)
    assert (await client.generate([{"role": "user", "content": 'hello'}], use_tools=False)).ok
    assert 'tools' not in router.calls[0]
