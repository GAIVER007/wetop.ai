"""Хранилище API-ключей моделей партнёров (С2 «под ключ», Q-186).

Ключ — секрет партнёра: в базе лежит только шифрованным (Fernet, секрет
`LLM_KEYS_SECRET` из окружения бота), наружу уходят лишь последние 4 знака.
Контракт чтения на ходе: None — ключа нет, ход идёт ключом платформы;
строка — ходить ровно с ней. Нечитаемый шифртекст (сменили секрет) отдаёт
ПУСТУЮ строку, а не None: роутер честно откажет, и продавец гостиницы
замолчит с алертом — подставлять ключ платформы вместо партнёрского
нельзя, иначе деньги WETOP уходят на чужих гостей.
"""

from __future__ import annotations

import logging
import uuid

from cryptography.fernet import Fernet, InvalidToken

from src.config import Settings
from src.db.models import OrganizationLlmKey

logger = logging.getLogger(__name__)


class KeysNotConfigured(Exception):
    """`LLM_KEYS_SECRET` не задан: принимать ключи партнёров некуда."""


def _fernet(settings: Settings) -> Fernet:
    secret = (settings.llm_keys_secret or "").strip()
    if not secret:
        raise KeysNotConfigured()
    return Fernet(secret.encode())


def encrypt_key(plain: str, settings: Settings) -> bytes:
    return _fernet(settings).encrypt(plain.encode())


def decrypt_key(blob: bytes, settings: Settings) -> str | None:
    """Открытый ключ или None, когда расшифровать нечем или не вышло."""
    try:
        return _fernet(settings).decrypt(bytes(blob)).decode()
    except KeysNotConfigured:
        logger.error("ключ партнёра сохранён, а LLM_KEYS_SECRET не задан")
        return None
    except (InvalidToken, UnicodeDecodeError):
        logger.error("ключ партнёра не расшифровался: секрет менялся?")
        return None


async def org_llm_api_key(session, organization_id: uuid.UUID | None, settings: Settings) -> str | None:
    """Ключ модели для хода организации; см. контракт в шапке файла."""
    if organization_id is None:
        return None
    row = await session.get(OrganizationLlmKey, organization_id)
    if row is None:
        return None
    plain = decrypt_key(row.key_encrypted, settings)
    # Настроен, но нечитаем: пустая строка — честный отказ роутера, не подмена.
    return plain if plain is not None else ""
