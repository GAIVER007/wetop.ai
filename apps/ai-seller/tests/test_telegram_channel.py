import httpx
import pytest
import sqlalchemy as sa
from src import dependencies
from src.db.models import TelegramConnection, TelegramInboundEvent
from tests.dashboard_fakes import PANEL, panel, seed_org, sync_db
from tests.test_whatsapp import KEY, ORG, ORG_B, FERNET, SERVICE
from tests.test_telegram_api import TOKEN

@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):
    import asyncio
    from src.channels import telegram_worker
    async def idle(_settings):
        await asyncio.Event().wait()
    monkeypatch.setattr(telegram_worker, 'run_worker', idle)
    state = {'url': '', 'calls': []}
    def handler(req):
        method = req.url.path.rsplit('/', 1)[-1]
        state['calls'].append(method)
        if method == 'getMe': result = {'id': 123456789, 'is_bot': True, 'username': 'example_test_bot'}
        elif method == 'getWebhookInfo': result = {'url': state['url']}
        elif method == 'setWebhook':
            import json
            state['url'] = json.loads(req.content)['url']; result = True
        else: result = True
        return httpx.Response(200, json={'ok': True, 'result': result})
    monkeypatch.setattr(dependencies._resources, 'http_client', httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE='seller', LLM_KEYS_SECRET=FERNET,
               TELEGRAM_SELLER_ENABLED='true', TELEGRAM_WEBHOOK_BASE_URL='https://seller.example.test') as p:
        seed_org(sync_db, ORG)
        seed_org(sync_db, ORG_B, key='sk_' + 'cd' * 12)
        yield p, state


def connect(app):
    return app[0].client.put(f'{PANEL}/seller/organizations/{ORG}/telegram', headers=SERVICE,
        json={'token': TOKEN, 'allowed_user_ids': ['1234']})


def test_encrypted_connection_and_no_secret_readback(app, sync_db):
    response = connect(app)
    assert response.status_code == 200, response.text
    assert response.json()['state'] == 'CONNECTED'
    assert TOKEN not in response.text
    with sync_db() as s:
        row = s.scalar(sa.select(TelegramConnection))
        assert row.token_encrypted != TOKEN.encode()
    assert 'setWebhook' in app[1]['calls']


def test_existing_foreign_webhook_is_not_overwritten(app):
    app[1]['url'] = 'https://another.example.test/webhook'
    assert connect(app).status_code == 409
    assert 'setWebhook' not in app[1]['calls']


def test_scope_is_checked_before_checking_token(app):
    res = app[0].client.post(f'{PANEL}/seller/organizations/{ORG}/telegram/check',
        headers={**SERVICE, 'X-Agent': ORG_B}, json={'token': TOKEN})
    assert res.status_code in (403, 404)
    assert app[1]['calls'] == []


def test_webhook_rejects_forged_secret_before_acceptance(app, sync_db):
    assert connect(app).status_code == 200
    res = app[0].client.post(f'/channels/telegram/webhook/{ORG}', json={'update_id': 42})
    assert res.status_code == 403
    with sync_db() as s:
        assert s.scalar(sa.select(sa.func.count()).select_from(TelegramInboundEvent)) == 0


def test_private_allowlist_and_repeated_update_are_durable(app, sync_db):
    from src.security.llm_keys import decrypt_key
    assert connect(app).status_code == 200
    with sync_db() as s:
        row = s.scalar(sa.select(TelegramConnection))
        secret = decrypt_key(row.webhook_secret_encrypted, app[0].client.app.state.settings)
    headers = {'X-Telegram-Bot-Api-Secret-Token': secret}
    payload = {'update_id': 99, 'message': {'chat': {'id':1234,'type':'private'}, 'from':{'id':1234,'is_bot':False},'text':'Тестовый вопрос'}}
    for _ in range(2):
        assert app[0].client.post(f'/channels/telegram/webhook/{ORG}',headers=headers,json=payload).status_code == 200
    payload['update_id'] = 100
    payload['message']['from']['id'] = 5678
    payload['message']['chat']['id'] = 5678
    assert app[0].client.post(f'/channels/telegram/webhook/{ORG}',headers=headers,json=payload).status_code == 200
    with sync_db() as s:
        rows = list(s.scalars(sa.select(TelegramInboundEvent)))
        assert len(rows) == 1
        assert rows[0].state == 'RECEIVED'
        assert b'1234' not in rows[0].payload_encrypted


def test_pause_stops_connection(app):
    assert connect(app).status_code == 200
    response = app[0].client.post(f'{PANEL}/seller/organizations/{ORG}/telegram/disconnect',headers=SERVICE)
    assert response.status_code == 200
    assert response.json()['state'] == 'CONFIGURED'
