"""Agent-scoped Telegram setup; credentials are write-only."""
from contextlib import asynccontextmanager
from redis.exceptions import WatchError
import secrets
import uuid
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from src import dependencies
from src.channels.telegram_api import TelegramAPI, TelegramUnavailable
from src.dashboard.auth_router import agent_of_organization, require_platform
from src.dashboard.panel_common import sessions, log_action
from src.dashboard.panel_whatsapp import _require_seller
from src.db.models import TelegramConnection
from src.db.base import utcnow
from src.security.llm_keys import encrypt_key, KeysNotConfigured

router = APIRouter()


class TelegramIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(default='', max_length=256)
    allowed_user_ids: list[str] = Field(default_factory=list, max_length=20)


def view(row):
    return {'set': row is not None, 'state': row.connection_state if row else 'NOT_CONNECTED',
            'username': row.bot_username if row else None,
            'allowedUserIds': row.allowed_user_ids if row else [],
            'lastReceivedAt': row.last_received_at if row else None,
            'lastSentAt': row.last_sent_at if row else None,
            'error': row.last_error_code if row else None}


async def scope_of(request, org_id):
    _require_seller(request)
    scope = await agent_of_organization(request, org_id)
    if not request.app.state.settings.telegram_seller_enabled:
        raise HTTPException(503, 'Подключение Telegram ещё не включено на сервере')
    return scope


def webhook_url(settings, agent_id):
    base = settings.telegram_webhook_base_url.rstrip('/')
    parsed = urlsplit(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise HTTPException(503, 'Адрес приёма сообщений ещё не настроен')
    return f'{base}/channels/telegram/webhook/{agent_id}'


@router.get('/seller/organizations/{org_id}/telegram', dependencies=[Depends(require_platform)])
async def status(request: Request, org_id: uuid.UUID):
    scope = await scope_of(request, org_id)
    async with sessions()() as s:
        return view(await s.get(TelegramConnection, scope.agent_id))


@router.post('/seller/organizations/{org_id}/telegram/check', dependencies=[Depends(require_platform)])
async def check(request: Request, org_id: uuid.UUID, body: TelegramIn):
    scope = await scope_of(request, org_id)
    api = TelegramAPI(dependencies.get_http_client())
    try:
        identity = await api.identity(body.token.strip())
        state = await api.webhook(body.token.strip())
        expected = webhook_url(request.app.state.settings, scope.agent_id)
        return {'valid': True, 'username': identity['username'], 'conflict': bool(state['url'] and state['url'] != expected)}
    except TelegramUnavailable:
        return {'valid': False, 'username': None, 'conflict': False}


@router.put('/seller/organizations/{org_id}/telegram', dependencies=[Depends(require_platform)])
async def connect(request: Request, org_id: uuid.UUID, body: TelegramIn):
    scope = await scope_of(request, org_id)
    ids = list(dict.fromkeys(body.allowed_user_ids))
    if not ids or any(not item.isascii() or not item.isdigit() or len(item) > 20 or int(item) <= 0 for item in ids):
        raise HTTPException(422, 'Добавьте Telegram ID тестировщиков (только цифры)')
    settings = request.app.state.settings
    url = webhook_url(settings, scope.agent_id)
    api = TelegramAPI(dependencies.get_http_client())
    # Serializes configuration changes, including outbound webhook registration.
    async with setup_lock(scope.agent_id):
        try:
            token = body.token.strip()
            identity = await api.identity(token)
            state = await api.webhook(token)
            if state['url'] and state['url'] != url:
                raise HTTPException(409, 'Бот уже подключён к другому сервису. Сначала отключите его там.')
            secret = secrets.token_urlsafe(32)
            encrypted = encrypt_key(token, settings)
            encrypted_secret = encrypt_key(secret, settings)
            async with sessions()() as s:
                row = await s.get(TelegramConnection, scope.agent_id)
                if row and row.bot_id != identity['bot_id']:
                    raise HTTPException(409, 'Сначала отключите текущего бота')
                if row is None:
                    row = TelegramConnection(agent_id=scope.agent_id)
                    s.add(row)
                row.bot_id, row.bot_username = identity['bot_id'], identity['username']
                row.token_encrypted, row.webhook_secret_encrypted = encrypted, encrypted_secret
                row.allowed_user_ids, row.enabled = ids, False
                row.connection_state, row.last_error_code, row.updated_at = 'CONNECTING', None, utcnow()
                try:
                    await s.commit()
                except IntegrityError:
                    await s.rollback()
                    raise HTTPException(409, 'Бот уже закреплён за другим агентом') from None
            # A crash here leaves CONNECTING and a retryable setup, never a fake success.
            await api.connect(token, url, secret)
            async with sessions()() as s:
                row = await s.get(TelegramConnection, scope.agent_id)
                row.enabled, row.connection_state, row.updated_at = True, 'CONNECTED', utcnow()
                log_action(s, action='telegram_connected', payload={'agent': str(scope.agent_id)})
                await s.commit()
                return view(row)
        except (TelegramUnavailable, KeysNotConfigured):
            async with sessions()() as s:
                row = await s.get(TelegramConnection, scope.agent_id)
                if row:
                    row.enabled, row.connection_state, row.last_error_code = False, 'ERROR', 'connection_failed'
                    await s.commit()
            raise HTTPException(503, 'Не удалось подключить Telegram. Проверьте токен и повторите.') from None


@router.post('/seller/organizations/{org_id}/telegram/disconnect', dependencies=[Depends(require_platform)])
async def disconnect(request: Request, org_id: uuid.UUID):
    scope = await scope_of(request, org_id)
    # Stop local handling first. Keep encrypted configuration for explicit retry/reconnect.
    async with setup_lock(scope.agent_id), sessions()() as s:
        row = await s.get(TelegramConnection, scope.agent_id)
        if row is None:
            return view(None)
        row.enabled, row.connection_state, row.updated_at = False, 'CONFIGURED', utcnow()
        log_action(s, action='telegram_disabled', payload={'agent': str(scope.agent_id)})
        await s.commit()
        return view(row)


@asynccontextmanager
async def setup_lock(agent_id):
    redis = dependencies.get_redis()
    key, token = f'telegram:setup:{agent_id}', secrets.token_hex(16)
    if not await redis.set(key, token, nx=True, ex=90):
        raise HTTPException(409, 'Подключение уже обновляется, повторите позже')
    try:
        yield
    finally:
        # Compare ownership atomically: an expired lease must not delete a new lock.
        try:
            async with redis.pipeline(transaction=True) as pipe:
                await pipe.watch(key)
                value = await pipe.get(key)
                if isinstance(value, bytes):
                    value = value.decode()
                if value == token:
                    pipe.multi()
                    pipe.delete(key)
                    await pipe.execute()
        except WatchError:
            pass  # Ownership changed; leave the new owner's lease intact.
