"""Durable pilot inbox. Unknown delivery is visible and never blindly resent."""
import asyncio
import json
import logging
import uuid
from datetime import timedelta
import sqlalchemy as sa
from src import dependencies
from src.ai.engine_types import IncomingMessage
from src.ai.turn_lock import TurnLock
from src.channels.sender import SendResult
from src.channels.telegram_api import TelegramAPI, TelegramUnavailable
from src.channels.widget_runner import build_runner
from src.db.base import utcnow
from src.db.models import Agent, Organization, TelegramConnection, TelegramInboundEvent
from src.security.llm_keys import decrypt_key

logger = logging.getLogger(__name__)


class TelegramSender:
    def __init__(self, settings):
        self.settings = settings

    async def send(self, *, channel, external_id, text):
        agent = dependencies.get_current_agent_id()
        if channel != 'telegram' or not agent:
            return SendResult(ok=False, error='invalid_scope')
        async with dependencies.get_sessionmaker()() as s:
            row = await s.get(TelegramConnection, uuid.UUID(agent))
            if not row or not row.enabled or external_id not in row.allowed_user_ids:
                return SendResult(ok=False, error='not_connected')
            token = decrypt_key(row.token_encrypted, self.settings)
            if not token:
                return SendResult(ok=False, error='token_unreadable')
            try:
                message_id = await TelegramAPI(dependencies.get_http_client()).send(token, external_id, text)
            except TelegramUnavailable:
                return SendResult(ok=False, error='delivery_unconfirmed')
            row.last_sent_at = utcnow()
            await s.commit()
            return SendResult(ok=True, external_message_id=message_id)


async def process_one(settings, engine):
    sessions = dependencies.get_sessionmaker()
    now = utcnow()
    async with sessions() as s:
        # A crash may occur after Telegram accepted the reply. Do not resend it automatically.
        interrupted = list(await s.scalars(sa.select(TelegramInboundEvent.agent_id).where(
            TelegramInboundEvent.state == 'PROCESSING', TelegramInboundEvent.next_retry_at <= now)))
        if interrupted:
            await s.execute(sa.update(TelegramInboundEvent).where(
                TelegramInboundEvent.state == 'PROCESSING', TelegramInboundEvent.next_retry_at <= now
            ).values(state='FAILED', error_code='processing_interrupted', next_retry_at=None))
            await s.execute(sa.update(TelegramConnection).where(TelegramConnection.agent_id.in_(interrupted))
                .values(last_error_code='processing_interrupted'))
        row = await s.scalar(sa.select(TelegramInboundEvent).where(
            TelegramInboundEvent.state.in_(['RECEIVED', 'FAILED']),
            TelegramInboundEvent.next_retry_at <= now,
        ).order_by(TelegramInboundEvent.received_at).with_for_update(skip_locked=True).limit(1))
        if not row:
            await s.commit()
            return False
        row.state, row.attempts = 'PROCESSING', row.attempts + 1
        row.next_retry_at = now + timedelta(minutes=5)
        event_id, agent_id, payload, received = row.id, row.agent_id, row.payload_encrypted, row.received_at
        agent = await s.get(Agent, agent_id)
        org = await s.get(Organization, agent.organization_id) if agent else None
        connection = await s.get(TelegramConnection, agent_id)
        ready = bool(agent and agent.active and org and org.active and connection and connection.enabled)
        org_id = str(org.id) if org else None
        allowed = connection.allowed_user_ids if connection else []
        await s.commit()
    error = None
    state = 'DONE'
    if not ready:
        state, error = 'FAILED', 'agent_unavailable'
    else:
        try:
            data = json.loads(decrypt_key(payload, settings) or '')
            if data['chat_id'] not in allowed:
                raise ValueError('Tester removed')
            incoming = IncomingMessage(channel='telegram', external_id=data['chat_id'], text=data['text'],
                received_at=received, organization_id=org_id, agent_id=str(agent_id))
            context = dependencies.incoming_text_var.set(incoming.text)
            try:
                outcome = await asyncio.wait_for(engine.process_message(incoming), timeout=180)
            finally:
                dependencies.incoming_text_var.reset(context)
            if outcome.status in {'error', 'send_failed', 'queued'}:
                state, error = 'FAILED', 'delivery_unconfirmed' if outcome.status == 'send_failed' else 'processing_unconfirmed'
        except Exception:
            # No payload, token, exception text or personal data in logs.
            state, error = 'FAILED', 'processing_unconfirmed'
            logger.warning('telegram: event processing requires review')
    async with sessions() as s:
        row = await s.get(TelegramInboundEvent, event_id)
        row.state, row.error_code, row.next_retry_at = state, error, None
        connection = await s.get(TelegramConnection, agent_id)
        if connection:
            connection.last_error_code = error
        await s.commit()
    return True


async def run_worker(settings):
    runner = build_runner(settings, sender=TelegramSender(settings))
    while True:
        try:
            # One bounded pilot turn across gunicorn workers avoids volatile engine queues.
            lock = TurnLock(dependencies.get_redis(), uuid.UUID('3a1f8d1b-f041-488f-a7d1-743a8cfbb77d'), ttl_seconds=240)
            handled = False
            if await lock.acquire():
                try:
                    handled = await process_one(settings, runner.engine)
                finally:
                    await lock.release()
        except Exception:
            logger.warning('telegram: inbox temporarily unavailable')
            handled = False
        if not handled:
            await asyncio.sleep(2)
