"""Заглушки шага 8б: настройки панели, пользователи с известным паролем,
токены, тестовый клиент и посев диалогов.

Ни сети, ни сервисов: база — sqlite из conftest, Redis — fakeredis.

🔴 Базу тест читает и сеет СИНХРОННЫМ движком поверх того же файла.
Приложение под TestClient крутит свой цикл событий; asyncio-сессия из теста
делила бы с ним один движок между двумя циклами, и это ломается не сразу,
а через раз — самый дорогой вид красного.

Открытый пароль живёт только здесь, в тестах: в настройках лежит хеш.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker as sa_sessionmaker

from src.config import Settings, get_settings
from src.db.base import ConversationMode, FunnelStage, MessageRole, OutboxKind, utcnow
from src.db.models import (
    Client,
    Conversation,
    DashboardUser,
    Document,
    Message,
    Organization,
    OutboxItem,
    OwnerAction,
)
from tests.alert_fakes import ALERT_ENV

# ─── Вымышленные значения. Боевых адресов и ключей в тестах быть не может. ───

PATH_PREFIX = "/p7k2m9x4qz1w"
PANEL = "/" + PATH_PREFIX.strip("/")
JWT_SECRET = "test-jwt-secret-not-a-production-one"

OWNER_EMAIL = "owner@example.test"
OPERATOR_EMAIL = "operator@example.test"
UNKNOWN_EMAIL = "nobody@example.test"
OWNER_PASSWORD = "Groza-Nad-Gorodom-77"
OPERATOR_PASSWORD = "Tihiy-Dvor-31"

# Имя и телефон клиента — для проверок маскировки в списке диалогов.
CLIENT_NAME = "Анна"
CLIENT_PHONE = "+7 700 111 22 33"
MASKED_NAME = "А***"

# Блок панели поверх блока алертов: register_failure зовёт raise_alert,
# а тому нужны адресаты, иначе строк в outbox не будет вовсе.
DASHBOARD_ENV: dict[str, str] = dict(ALERT_ENV) | {
    "DASHBOARD_JWT_SECRET": JWT_SECRET,
    "DASHBOARD_ADMIN_EMAIL": OWNER_EMAIL,
    "DASHBOARD_SESSION_TTL_HOURS": "12",
    "DASHBOARD_PATH_PREFIX": PATH_PREFIX,
    "DASHBOARD_LOGIN_MAX_ATTEMPTS": "3",
    "DASHBOARD_LOGIN_WINDOW_SECONDS": "900",
    "DASHBOARD_LOGIN_BLOCK_SECONDS": "900",
    "DASHBOARD_LOGIN_ALERT_AFTER": "2",
    "DASHBOARD_ALLOWED_IPS": "",
    "DASHBOARD_2FA_ENABLED": "false",
    "DASHBOARD_2FA_ISSUER": "WETOP-test",
    "DASHBOARD_2FA_DRIFT_STEPS": "1",
    "DASHBOARD_2FA_BACKUP_CODES": "4",
    "LLM_MODEL": "vendor-a/base",
    "LLM_ALLOWED_MODELS": "",
    "KB_EMBED_WARMUP": "false",
}


@lru_cache(maxsize=8)
def password_hash(plain: str) -> str:
    """Хеш с кэшем на процесс: bcrypt считается десятые доли секунды."""
    from src.dashboard.security import hash_password

    return hash_password(plain)


def dashboard_settings(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> Settings:
    """Настройки с заполненным блоком панели. Хеш пароля владельца ставится
    сам: положить туда открытый пароль тест не должен уметь даже случайно."""
    values = dict(DASHBOARD_ENV)
    values.setdefault("DASHBOARD_ADMIN_PASSWORD_HASH", password_hash(OWNER_PASSWORD))
    values.update(overrides)
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    return get_settings()


def use_fake_redis(monkeypatch: pytest.MonkeyPatch, fake: Any) -> None:
    """Ставим fakeredis в держатель синглтонов, а не подменяем имя get_redis:
    модули панели импортируют его по-разному, и подмена имени их не достанет."""
    import src.dependencies as deps

    monkeypatch.setattr(deps._resources, "redis", fake)


def no_login_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    """Задержку проверяет отдельный тест; остальным — секунда за попытку."""
    import src.dashboard.security as security

    # Подмена одна: auth_router читает значение через модуль security
    # в момент вызова, своего имени у него нет.
    monkeypatch.setattr(security, "FAILED_DELAY_SECONDS", 0.0)


# ─── Приложение ───


class Panel:
    """Тестовый клиент вместе с настройками, при которых он собран."""

    def __init__(self, client: Any, settings: Settings) -> None:
        self.client = client
        self.settings = settings

    def login(self, email: str = OWNER_EMAIL, password: str = OWNER_PASSWORD) -> Any:
        return self.client.post(f"{PANEL}/login", json={"email": email, "password": password})

    def headers(self, role: str = "owner", email: str = OWNER_EMAIL) -> dict[str, str]:
        return bearer(token_for(self.settings, email=email, role=role))


@contextmanager
def panel(monkeypatch: pytest.MonkeyPatch, fake_redis: Any, **overrides: str) -> Iterator[Panel]:
    """Приложение с настроенной панелью, подменённым Redis и без задержки входа."""
    from fastapi.testclient import TestClient

    settings = dashboard_settings(monkeypatch, **overrides)
    use_fake_redis(monkeypatch, fake_redis)
    no_login_delay(monkeypatch)
    from src.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as client:
        yield Panel(client, settings)


def fresh_browser() -> Any:
    """Второй клиент того же приложения — «другой браузер». Без контекстного
    менеджера намеренно: выход закрыл бы общие ресурсы посреди теста."""
    from fastapi.testclient import TestClient

    from src.main import create_app

    return TestClient(create_app(), raise_server_exceptions=False)


def token_for(
    settings: Settings, *, email: str = OWNER_EMAIL, role: str = "owner", twofa: bool = True
) -> str:
    from src.dashboard.security import issue_token

    return issue_token(settings, email=email, role=role, twofa_done=twofa)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def as_text(payload: Any) -> str:
    """Ответ целиком одной строкой — для проверок «этого здесь нет»."""
    return json.dumps(payload, ensure_ascii=False, default=str)


def step_code(secret: str, step: int) -> str:
    """Код TOTP ровно для шага step: считаем от номера шага, а не от системных
    часов, иначе тест краснеет в зависимости от секунды запуска."""
    import pyotp

    return pyotp.TOTP(secret).at(datetime.fromtimestamp(step * 30 + 1, tz=timezone.utc))


# ─── База: синхронные помощники ───


@pytest.fixture
def sync_db(migrated_db: str) -> Iterator[Any]:
    """Фабрика синхронных сессий поверх файла sqlite из conftest.
    expire_on_commit=False: иначе помощник отдаст объект с пустыми полями."""
    engine = sa.create_engine(migrated_db)
    try:
        yield sa_sessionmaker(engine, expire_on_commit=False)
    finally:
        engine.dispose()


def seed_org(
    sessions: Any,
    org_id: str,
    key: str = "sk_" + "ab" * 12,
    hosts: list[str] | tuple[str, ...] = (),
    *,
    active: bool = True,
    prompt: str | None = None,
    name: str = "Гостиница-стенд",
) -> uuid.UUID:
    """Гостиница у продавца (Э4) — так, как её заводит платформа."""
    now = utcnow()
    with sessions() as session:
        session.add(
            Organization(
                id=uuid.UUID(org_id),
                name=name,
                public_key=key,
                active=active,
                hosts=list(hosts),
                system_prompt=prompt,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    return uuid.UUID(org_id)


def _all(sessions: Any, stmt: Any) -> list[Any]:
    """Выборка в отдельной короткой сессии. 🔴 commit в конце обязателен:
    открытая транзакция держит файл, и запись приложения встаёт на замке."""
    with sessions() as session:
        rows = list(session.execute(stmt).scalars())
        session.commit()
        return rows


def make_user(
    sessions: Any,
    *,
    email: str = OWNER_EMAIL,
    password: str = OWNER_PASSWORD,
    role: str = "owner",
    totp_secret: str | None = None,
    totp_confirmed: bool = False,
    totp_last_step: int | None = None,
    backup_codes: list[str] | None = None,
) -> uuid.UUID:
    """Пользователь панели с известным паролем. Возвращает id."""
    with sessions() as session:
        user = DashboardUser(
            email=email,
            password_hash=password_hash(password),
            role=role,
            totp_secret=totp_secret,
            totp_confirmed_at=utcnow() if totp_confirmed else None,
            totp_last_step=totp_last_step,
            backup_codes=list(backup_codes or []),
            failed_logins=0,
            created_at=utcnow(),
        )
        session.add(user)
        session.commit()
        return user.id


def get_user(sessions: Any, email: str = OWNER_EMAIL) -> DashboardUser:
    return _all(sessions, sa.select(DashboardUser).where(DashboardUser.email == email))[0]


def seed_conversation(
    sessions: Any,
    *,
    external_id: str = "1001",
    channel: str = "telegram",
    name: str | None = CLIENT_NAME,
    phone: str | None = CLIENT_PHONE,
    mode: ConversationMode = ConversationMode.BOT_ACTIVE,
    stage: FunnelStage = FunnelStage.QUALIFYING,
    texts: tuple[str, ...] = ("Здравствуйте, есть места?", "Здравствуйте! Подскажу."),
) -> uuid.UUID:
    """Диалог с клиентом и парой сообщений. Возвращает id диалога."""
    now = utcnow()
    with sessions() as session:
        client = Client(
            channel=channel, external_id=external_id, name=name, phone=phone, created_at=now
        )
        session.add(client)
        session.flush()
        conversation = Conversation(
            client_id=client.id,
            mode=mode,
            funnel_stage=stage,
            lead_data={"phone": phone} if phone else {},
            is_active=True,
            created_at=now,
            last_activity_at=now,
        )
        session.add(conversation)
        session.flush()
        for index, text in enumerate(texts):
            session.add(
                Message(
                    conversation_id=conversation.id,
                    role=MessageRole.USER if index % 2 == 0 else MessageRole.ASSISTANT,
                    content=text,
                    sent_by_us=index % 2 == 1,
                    # Метки в прошлом: реплика оператора приходит «сейчас»
                    # и должна оказаться последней, а не в середине истории.
                    created_at=now - timedelta(seconds=len(texts) - index),
                )
            )
        session.commit()
        return conversation.id


def conversation_mode(sessions: Any, conversation_id: uuid.UUID) -> ConversationMode:
    stmt = sa.select(Conversation).where(Conversation.id == conversation_id)
    return _all(sessions, stmt)[0].mode


def messages_of(sessions: Any, conversation_id: uuid.UUID) -> list[Message]:
    stmt = (
        sa.select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at, Message.id)
    )
    return _all(sessions, stmt)


def owner_actions(sessions: Any, action: str | None = None) -> list[OwnerAction]:
    stmt = sa.select(OwnerAction).order_by(OwnerAction.created_at, OwnerAction.id)
    if action is not None:
        stmt = stmt.where(OwnerAction.action == action)
    return _all(sessions, stmt)


def documents(sessions: Any) -> list[Document]:
    return _all(sessions, sa.select(Document).order_by(Document.created_at))


def alert_bodies(sessions: Any) -> list[str]:
    """Тела строк outbox с kind=ALERT: по ним видно, ушёл ли алерт о переборе."""
    stmt = sa.select(OutboxItem).where(OutboxItem.kind == OutboxKind.ALERT).order_by(OutboxItem.id)
    return [row.body for row in _all(sessions, stmt)]


# ─── Отправитель канала ───


class MemorySender:
    """Отправитель панели в память: ответ оператора никуда не уходит."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    async def send(self, *, channel: str, external_id: str, text: str) -> Any:
        from src.channels.sender import SendResult

        self.sent.append((channel, str(external_id), text))
        return SendResult(ok=True, external_message_id=str(len(self.sent)))


class FailingSender:
    """Канал не принял. 🔴 На этом отказе проверяется, что ответ оператора
    не попадает в историю: иначе панель «ответила», а клиент ждёт."""

    def __init__(self) -> None:
        self.calls = 0

    async def send(self, *, channel: str, external_id: str, text: str) -> Any:
        from src.channels.sender import SendResult

        self.calls += 1
        return SendResult(ok=False, error="канал недоступен")


def install_sender(monkeypatch: pytest.MonkeyPatch, sender: Any) -> None:
    """Подменяет отправителя реплики (фабрика build_reply_sender): без этого
    тест на отказ канала не отличить от теста на живую сеть."""
    import src.dashboard.panel_conversations as panel_conversations

    monkeypatch.setattr(panel_conversations, "build_reply_sender", lambda settings: sender)
