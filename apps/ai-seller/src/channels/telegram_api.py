"""Telegram Bot API boundary. Tokens and provider error bodies never leave this module.

Contract: docs/telegram/seller-channel.md. No user-selectable host or redirects.
"""
from __future__ import annotations

import re
import logging
import httpx


class TelegramUnavailable(Exception):
    """A bounded public error code, never the provider's body or URL."""


class _TokenFilter(logging.Filter):
    def filter(self, record):
        record.msg = re.sub(r"(/bot)[0-9]{5,20}:[A-Za-z0-9_-]{20,200}", r"\1[REDACTED]", record.getMessage())
        record.args = ()
        return True


class TelegramAPI:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        logger = logging.getLogger('httpx')
        if not any(isinstance(item, _TokenFilter) for item in logger.filters):
            logger.addFilter(_TokenFilter())

    async def call(self, token: str, method: str, payload: dict | None = None):
        if not re.fullmatch(r'[0-9]{5,20}:[A-Za-z0-9_-]{20,200}', token):
            raise TelegramUnavailable('invalid_token')
        if method not in {'getMe', 'getWebhookInfo', 'setWebhook', 'deleteWebhook', 'sendMessage'}:
            raise TelegramUnavailable('invalid_method')
        try:
            response = await self.client.post(
                f'https://api.telegram.org/bot{token}/{method}', json=payload or {},
                timeout=15, follow_redirects=False,
            )
            body = response.json()
        except (httpx.HTTPError, ValueError):
            raise TelegramUnavailable('connection_failed') from None
        if response.status_code != 200 or not isinstance(body, dict) or body.get('ok') is not True:
            raise TelegramUnavailable('telegram_rejected')
        return body.get('result')

    async def identity(self, token: str) -> dict:
        result = await self.call(token, 'getMe')
        if (not isinstance(result, dict) or result.get('is_bot') is not True
                or type(result.get('id')) is not int or result['id'] <= 0
                or not isinstance(result.get('username'), str)
                or not re.fullmatch(r'[A-Za-z0-9_]{5,32}', result['username'])):
            raise TelegramUnavailable('invalid_identity')
        return {'bot_id': str(result['id']), 'username': result['username']}

    async def webhook(self, token: str) -> dict:
        result = await self.call(token, 'getWebhookInfo')
        if not isinstance(result, dict) or not isinstance(result.get('url'), str):
            raise TelegramUnavailable('invalid_webhook_state')
        return result

    async def connect(self, token: str, url: str, secret: str) -> None:
        if await self.call(token, 'setWebhook', {
            'url': url, 'secret_token': secret, 'allowed_updates': ['message'],
            'drop_pending_updates': False,
        }) is not True:
            raise TelegramUnavailable('webhook_not_confirmed')
        if (await self.webhook(token))['url'] != url:
            raise TelegramUnavailable('webhook_not_confirmed')

    async def send(self, token: str, chat_id: str, text: str) -> str:
        if not chat_id.isdigit() or not 1 <= len(text) <= 4096:
            raise TelegramUnavailable('invalid_message')
        result = await self.call(token, 'sendMessage', {'chat_id': chat_id, 'text': text})
        if not isinstance(result, dict) or type(result.get('message_id')) is not int:
            raise TelegramUnavailable('message_not_confirmed')
        return str(result['message_id'])
