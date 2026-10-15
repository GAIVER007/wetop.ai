"""Telegram transport: untrusted responses, secret-free errors, no live requests."""
import httpx
import pytest
from src.channels.telegram_api import TelegramAPI, TelegramUnavailable

TOKEN = '123456789:fake_token_for_tests_only_abcdefghijkl'

@pytest.mark.asyncio
async def test_get_me_returns_only_verified_bot_identity():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={'ok': True, 'result': {'id': 123456789, 'is_bot': True, 'username': 'example_test_bot'}}))) as client:
        assert await TelegramAPI(client).identity(TOKEN) == {'bot_id': '123456789', 'username': 'example_test_bot'}

@pytest.mark.asyncio
@pytest.mark.parametrize('body', [{'ok': False, 'description': TOKEN}, {'ok': True, 'result': {'id': 123456789, 'is_bot': False}}, {'ok': True, 'result': None}])
async def test_refusal_and_malformed_identity_never_count_as_connected(body):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, json=body))) as client:
        with pytest.raises(TelegramUnavailable) as error:
            await TelegramAPI(client).identity(TOKEN)
        assert TOKEN not in str(error.value)

@pytest.mark.asyncio
async def test_network_exception_does_not_reveal_request_url():
    def fail(req):
        raise httpx.ConnectError(str(req.url), request=req)
    async with httpx.AsyncClient(transport=httpx.MockTransport(fail)) as client:
        with pytest.raises(TelegramUnavailable) as error:
            await TelegramAPI(client).identity(TOKEN)
        assert TOKEN not in str(error.value)

@pytest.mark.asyncio
async def test_invalid_token_is_rejected_before_network():
    def fail(req):
        raise AssertionError('must not send')
    async with httpx.AsyncClient(transport=httpx.MockTransport(fail)) as client:
        with pytest.raises(TelegramUnavailable):
            await TelegramAPI(client).identity('bad/token?x')

@pytest.mark.asyncio
async def test_send_requires_message_acknowledgement():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={'ok': True, 'result': {}}))) as client:
        with pytest.raises(TelegramUnavailable):
            await TelegramAPI(client).send(TOKEN, '1234', 'test')

@pytest.mark.asyncio
async def test_http_request_logs_never_include_bot_token(caplog):
    import logging
    caplog.set_level(logging.INFO, logger='httpx')
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={'ok': True, 'result': {'id': 123456789, 'is_bot': True, 'username': 'example_test_bot'}}))) as client:
        await TelegramAPI(client).identity(TOKEN)
    assert TOKEN not in caplog.text
