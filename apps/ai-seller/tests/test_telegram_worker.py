import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from src import dependencies
from src.db.base import utcnow
from src.db.models import Organization, Agent, TelegramInboundEvent, TelegramConnection
from src.security.llm_keys import encrypt_key
from src.config import get_settings
from tests.test_whatsapp import FERNET
from src.channels.telegram_worker import process_one

@pytest.mark.asyncio
@pytest.mark.parametrize('outcome,state,error', [('replied','DONE',None), ('send_failed','FAILED','delivery_unconfirmed'), ('interrupted','FAILED','processing_interrupted')])
async def test_persisted_event_is_processed_with_agent_scope(db_session, monkeypatch, outcome, state, error):
    import json
    monkeypatch.setenv('LLM_KEYS_SECRET', FERNET)
    get_settings.cache_clear(); settings = get_settings()
    org = Organization(id=uuid.uuid4(), name='Synthetic hotel', active=True, public_key='synthetic_org', created_at=utcnow(), updated_at=utcnow())
    db_session.add(org); await db_session.flush()
    agent = Agent(id=uuid.uuid4(), organization_id=org.id, name='Synthetic agent', active=True, public_key='synthetic_agent', created_at=utcnow(), updated_at=utcnow())
    db_session.add(agent); await db_session.flush()
    db_session.add(TelegramConnection(agent_id=agent.id, bot_id='1234567', bot_username='fake_bot', token_encrypted=b'x', webhook_secret_encrypted=b'x', allowed_user_ids=['1234'], enabled=True, connection_state='CONNECTED', updated_at=utcnow()))
    event = TelegramInboundEvent(agent_id=agent.id, update_id='17', received_at=utcnow(), state='RECEIVED', attempts=0, next_retry_at=utcnow(), payload_encrypted=encrypt_key(json.dumps({'chat_id':'1234','text':'Есть свободный номер?'}),settings))
    if outcome == 'interrupted':
        from datetime import timedelta
        event.state = 'PROCESSING'
        event.next_retry_at = utcnow() - timedelta(minutes=6)
    db_session.add(event); await db_session.commit()
    engine = SimpleNamespace(process_message=AsyncMock(return_value=SimpleNamespace(status=outcome)))
    assert await process_one(settings, engine) == (outcome != 'interrupted')
    await db_session.refresh(event)
    assert (event.state, event.error_code) == (state,error)
    connection = await db_session.get(TelegramConnection, agent.id)
    await db_session.refresh(connection)
    assert connection.last_error_code == error
    if outcome == 'interrupted':
        assert engine.process_message.await_count == 0
        return
    incoming = engine.process_message.call_args.args[0]
    assert incoming.agent_id == str(agent.id) and incoming.organization_id == str(org.id)
    assert incoming.external_id == '1234'
    assert not await process_one(settings, engine)
    assert engine.process_message.await_count == 1
