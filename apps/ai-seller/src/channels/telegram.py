"""Telegram ingress: authenticate, restrict pilot, persist before acknowledging."""
import json
import secrets
import uuid
import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from src import dependencies
from src.db.models import Agent, Organization, TelegramConnection, TelegramInboundEvent
from src.db.base import utcnow
from src.security.llm_keys import decrypt_key, encrypt_key

router = APIRouter()


@router.post('/channels/telegram/webhook/{agent_id}')
async def webhook(request: Request, agent_id: uuid.UUID):
    settings = request.app.state.settings
    if not settings.telegram_seller_enabled:
        raise HTTPException(503, 'Unavailable')
    async with dependencies.get_sessionmaker()() as s:
        row = await s.get(TelegramConnection, agent_id)
        secret = decrypt_key(row.webhook_secret_encrypted, settings) if row else None
        supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not secret or not secrets.compare_digest(secret, supplied):
            raise HTTPException(403, 'Forbidden')
        if row.connection_state == 'CONNECTING':
            raise HTTPException(503, 'Retry later')
        agent = await s.get(Agent, agent_id)
        org = await s.get(Organization, agent.organization_id) if agent else None
        if not row.enabled or not agent or not agent.active or not org or not org.active:
            return {'ok': True}
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 64 * 1024:
                raise HTTPException(413, 'Too large')
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(400, 'Invalid update') from None
        if not isinstance(body, dict) or type(body.get('update_id')) is not int:
            raise HTTPException(400, 'Invalid update')
        message = body.get('message')
        if not isinstance(message, dict):
            return {'ok': True}
        chat, author = message.get('chat'), message.get('from')
        if not isinstance(chat, dict) or not isinstance(author, dict):
            return {'ok': True}
        if (chat.get('type') != 'private' or author.get('is_bot') is not False
                or type(author.get('id')) is not int or chat.get('id') != author['id']
                or str(author['id']) not in row.allowed_user_ids):
            return {'ok': True}
        text = message.get('text')
        if not isinstance(text, str) or not text.strip() or len(text) > 4096:
            return {'ok': True}
        now = utcnow()
        row.last_received_at = now
        s.add(TelegramInboundEvent(agent_id=agent_id, update_id=str(body['update_id']), received_at=now,
            state='RECEIVED', attempts=0, next_retry_at=now,
            payload_encrypted=encrypt_key(json.dumps({'chat_id': str(author['id']), 'text': text}), settings)))
        try:
            await s.commit()
        except IntegrityError:
            await s.rollback()
            duplicate = await s.scalar(sa.select(TelegramInboundEvent.id).where(
                TelegramInboundEvent.agent_id == agent_id, TelegramInboundEvent.update_id == str(body['update_id'])))
            if duplicate is None:
                raise HTTPException(503, 'Retry later') from None
        return {'ok': True}
