"""Гейт согласия на обработку данных (слой 0б).

Здесь только механизм: экран, проверка «нужно ли», запись согласия и отзыв.
🔴 Решение «пускать ли сообщение в движок» принимает вызывающий код
(движок, шаг 5) вызовом consent_required ДО любой логики диалога.
Включается настройкой CONSENT_GATE_ENABLED: выключен — код есть, но не мешает.

Что хранится как доказательство: момент, версия политики, способ и дословно
показанный текст. Флага «да/нет» недостаточно — предъявлять придётся
обстоятельства, а не флаг. Отзыв — поле в той же записи, старая не удаляется.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings
from src.db.base import utcnow
from src.db.models import Consent

DEFAULT_BUTTON_TEXT = "Согласен"


@dataclass(frozen=True)
class ConsentScreen:
    """Что видит клиент вместо ответа по существу, пока не нажал кнопку."""

    text: str
    policy_url: str
    policy_version: str
    button_text: str


def consent_screen(settings: Settings) -> ConsentScreen:
    """Экран из трёх частей: фраза об обработке, ссылка на политику, кнопка.

    Текст собирается здесь, а не в промпте: он же пишется в consents
    как shown_text, и должен быть ровно тем, что человек видел.
    """
    button_text = settings.consent_button_text or DEFAULT_BUTTON_TEXT
    parts = [
        "Чтобы продолжить, нужно ваше согласие на обработку персональных данных.",
    ]
    if settings.consent_policy_url:
        parts.append(f"Политика обработки: {settings.consent_policy_url}")
    parts.append(f"Нажмите «{button_text}», чтобы начать диалог.")
    return ConsentScreen(
        text="\n".join(parts),
        policy_url=settings.consent_policy_url,
        policy_version=settings.consent_policy_version,
        button_text=button_text,
    )


async def _active_consent(session: AsyncSession, client_id: uuid.UUID) -> Consent | None:
    """Активное согласие клиента: без revoked_at. Одно на клиента (idx_consents_active)."""
    result = await session.execute(
        sa.select(Consent).where(Consent.client_id == client_id, Consent.revoked_at.is_(None))
    )
    return result.scalar_one_or_none()


async def consent_required(session: AsyncSession, settings: Settings, client_id: uuid.UUID) -> bool:
    """True — сообщение в движок не идёт, клиенту показывается экран.

    Гейт выключен — False всегда: основание обработки не согласие,
    и лишний экран здесь только отвал на входе.
    """
    if not settings.consent_gate_enabled:
        return False
    return await _active_consent(session, client_id) is None


async def grant_consent(
    session: AsyncSession,
    settings: Settings,
    client_id: uuid.UUID,
    *,
    method: str,
    shown_text: str,
) -> Consent:
    """Пишет согласие. Повторное нажатие при активном согласии возвращает
    существующее: проверка «уже сделано» ДО записи, иначе уникальный индекс
    idx_consents_active упал бы ошибкой на ровном месте."""
    existing = await _active_consent(session, client_id)
    if existing is not None:
        return existing
    consent = Consent(
        client_id=client_id,
        policy_version=settings.consent_policy_version,
        policy_url=settings.consent_policy_url,
        method=method,
        shown_text=shown_text,
        granted_at=utcnow(),
    )
    session.add(consent)
    await session.commit()
    return consent


async def revoke_consent(session: AsyncSession, client_id: uuid.UUID) -> Consent | None:
    """Отзыв: revoked_at в той же записи. Нет активного согласия — None."""
    consent = await _active_consent(session, client_id)
    if consent is None:
        return None
    consent.revoked_at = utcnow()
    await session.commit()
    return consent
