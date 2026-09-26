"""Подмены для тестов канала «виджет на сайте».

Ни сети, ни сервисов: база — sqlite из conftest, Redis — fakeredis.
Все значения вымышленные: домены на example.test, почты на example.com,
секреты приметные, чтобы утечка была видна глазами.

🔴 FakeTransport переехал сюда из telegram_fakes вместе с удалением канала:
он нужен не виджету, а очереди алертов (почта и мессенджер), и без него
тесты outbox остались бы без транспорта в память.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import pytest
import sqlalchemy as sa

from src.ai.engine_types import IncomingMessage
from src.channels.outbox import Transport
from src.channels.sender import SendResult
from src.config import Settings, get_settings
from src.db.base import MessageRole, utcnow
from src.db.models import Client, Conversation, Message

# ─── Вымышленные значения ───

CHANNEL = "widget"
PREFIX = "/widget"
SITE_ORIGIN = "https://app.example.test"
OTHER_ORIGIN = "https://zloumyshlennik.example.test"
IDENTITY_SECRET = "primetnyy-sekret-podpisi-vidzheta"

USER_ID = "u-42"
USER_EMAIL = "platform.user@example.com"
ORG_ID = "org-7"
USER_ROLE = "manager"

# Долгий опрос в тестах короткий: иначе каждый пустой опрос стоит 25 секунд.
POLL_TIMEOUT = "1"

WIDGET_ENV: dict[str, str] = {
    "WIDGET_SITE_HOSTS": SITE_ORIGIN,
    "WIDGET_IDENTITY_SECRET": IDENTITY_SECRET,
    "WIDGET_IDENTITY_TTL_SECONDS": "3600",
    "WIDGET_SESSION_TTL_HOURS": "720",
    "WIDGET_MESSAGES_PER_HOUR": "60",
    "WIDGET_MAX_BODY_BYTES": "65536",
    "WIDGET_ATTACHMENTS_ENABLED": "true",
    # 1 МБ, а не 5: перебор предела в тесте не должен весить пять мегабайт.
    "WIDGET_ATTACHMENT_MAX_MB": "1",
    "WIDGET_ATTACHMENT_DIR": "data/attachments",
    "WIDGET_ATTACHMENT_TYPES": "image/png,image/jpeg,image/webp",
    "WIDGET_POLL_TIMEOUT_SECONDS": POLL_TIMEOUT,
    "KB_EMBED_WARMUP": "false",
    "LLM_MODEL": "vendor-a/base",
}

# ─── Картинки: настоящие первые байты, по ним и проверяется тип ───

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
NOT_AN_IMAGE = "это обычный текст, а вовсе не снимок экрана\n".encode("utf-8")


def widget_settings(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> Settings:
    """Настройки с заполненным блоком виджета. Пустая строка = «не задано»."""
    values = dict(WIDGET_ENV)
    values.update(overrides)
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    return get_settings()


def use_fake_redis(monkeypatch: pytest.MonkeyPatch, fake: Any) -> None:
    """Fakeredis в держатель синглтонов: модули канала берут get_redis
    по-разному, и подмена одного имени их не достанет."""
    import src.dependencies as deps

    monkeypatch.setattr(deps._resources, "redis", fake)


# ─── Признак пользователя платформы ───


def identity_token(
    *,
    secret: str = IDENTITY_SECRET,
    user_id: str = USER_ID,
    email: str = USER_EMAIL,
    org_id: str = ORG_ID,
    role: str = USER_ROLE,
    issued_at: int | None = None,
) -> str:
    """Подпись, как её ставит платформа. Формат живёт в самом боте, чтобы
    его было где прочитать и чем проверить."""
    from src.channels.widget_identity import sign_identity

    return sign_identity(
        secret,
        user_id=user_id,
        email=email,
        org_id=org_id,
        role=role,
        issued_at=int(time.time()) if issued_at is None else issued_at,
    )


# ─── Отправитель и обработчик ───


def make_sender(redis: Any):
    """Отправитель канала поверх fakeredis.

    Отметку в Redis он ставит затем, чтобы долгий опрос проснулся сразу.
    Клиента передаём явно: в бою отправитель берёт общий клиент процесса.
    """
    from src.channels.widget import WidgetSender

    return WidgetSender(redis=redis)


@dataclass
class FakeRunner:
    """Подмена WidgetRunner: запоминает, что ему отдали, и ничего не делает.

    На нём проверяется, что приём сообщения отвечает БЫСТРО: ход — фоном.
    """

    submitted: list[IncomingMessage] = field(default_factory=list)

    def submit(self, incoming: IncomingMessage) -> object:
        # Не None: None канал понимает как «очередь переполнена» и отвечает
        # отказом. Возвращаем что угодно осмысленное вместо задачи.
        self.submitted.append(incoming)
        return incoming

    async def drain(self) -> None:
        return None


@dataclass
class EchoRunner:
    """Обработчик-эхо на месте движка: отправляет ответ отправителем канала
    и только ПОСЛЕ успеха пишет его в историю — тот же порядок, что у движка.

    Нужен там, где проверяется путь «ход прошёл фоном → ответ виден опросом»,
    а настоящий каскад моделей не нужен.
    """

    sessionmaker: Any
    sender: Any
    reply: str = "Здравствуйте! Подскажу."
    submitted: list[IncomingMessage] = field(default_factory=list)
    _tasks: set[asyncio.Task] = field(default_factory=set)

    def submit(self, incoming: IncomingMessage) -> asyncio.Task:
        self.submitted.append(incoming)
        task = asyncio.create_task(self._handle(incoming))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    async def drain(self) -> None:
        while self._tasks:
            await asyncio.gather(*list(self._tasks), return_exceptions=True)

    async def _handle(self, incoming: IncomingMessage) -> None:
        result = await self.sender.send(
            channel=incoming.channel, external_id=str(incoming.external_id), text=self.reply
        )
        if not result.ok:
            return
        # Своя сессия: задача живёт дольше запроса, в котором пришло сообщение.
        async with self.sessionmaker() as session:
            stmt = (
                sa.select(Conversation)
                .join(Client, Client.id == Conversation.client_id)
                .where(Client.channel == CHANNEL, Client.external_id == str(incoming.external_id))
                .order_by(Conversation.last_activity_at.desc())
            )
            conversation = (await session.execute(stmt)).scalars().first()
            if conversation is None:
                return
            now = utcnow()
            session.add(
                Message(
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=self.reply,
                    sent_by_us=True,
                    created_at=now,
                )
            )
            conversation.last_activity_at = now
            await session.commit()


# ─── Приложение ───


class WidgetApp:
    """Тестовый клиент вместе с настройками, при которых он собран."""

    def __init__(self, client: Any, settings: Settings) -> None:
        self.client = client
        self.settings = settings

    def headers(
        self, origin: str | None = SITE_ORIGIN, identity: str | None = None
    ) -> dict[str, str]:
        """Признак пользователя идёт заголовком: в адресе ему не место,
        адреса оседают в журналах привратника, а в признаке почта."""
        out: dict[str, str] = {}
        if origin:
            out["Origin"] = origin
        if identity is not None:
            out["X-Widget-Identity"] = identity
        return out

    @staticmethod
    def door(path: str, org_key: str | None) -> str:
        """Ключ гостиницы (Э4) идёт параметром k на каждой двери — так же
        его шлёт widget.js. Ключ публичный (стоит в теге страницы), поэтому
        адресная строка ему не вредит."""
        if org_key is None:
            return path
        return f"{path}{'&' if '?' in path else '?'}k={org_key}"

    def session(
        self,
        *,
        visitor_key: str | None = None,
        identity: str | None = None,
        origin: str | None = SITE_ORIGIN,
        org_key: str | None = None,
    ) -> Any:
        body: dict[str, str] = {}
        if visitor_key is not None:
            body["visitor_key"] = visitor_key
        if identity is not None:
            body["identity"] = identity
        return self.client.post(
            self.door(f"{PREFIX}/session", org_key), json=body, headers=self.headers(origin)
        )

    def new_visitor(self, **kwargs: Any) -> str:
        response = self.session(**kwargs)
        assert response.status_code == 200, response.text
        return response.json()["visitor_key"]

    def message(
        self,
        visitor_key: str,
        text: str = "Здравствуйте, есть места?",
        *,
        identity: str | None = None,
        attachment_id: str | None = None,
        origin: str | None = SITE_ORIGIN,
        org_key: str | None = None,
    ) -> Any:
        body: dict[str, str] = {"visitor_key": visitor_key, "text": text}
        if identity is not None:
            body["identity"] = identity
        if attachment_id is not None:
            body["attachment_id"] = attachment_id
        return self.client.post(
            self.door(f"{PREFIX}/message", org_key), json=body, headers=self.headers(origin)
        )

    def poll(
        self,
        visitor_key: str,
        after: str | None = None,
        *,
        identity: str | None = None,
        origin: str | None = SITE_ORIGIN,
        org_key: str | None = None,
    ) -> Any:
        params: dict[str, str] = {"visitor_key": visitor_key}
        if after is not None:
            params["after"] = after
        if org_key is not None:
            params["k"] = org_key
        return self.client.get(
            f"{PREFIX}/messages", params=params, headers=self.headers(origin, identity)
        )

    def consent(
        self,
        visitor_key: str,
        *,
        identity: str | None = None,
        origin: str | None = SITE_ORIGIN,
        org_key: str | None = None,
    ) -> Any:
        body: dict[str, str] = {"visitor_key": visitor_key}
        if identity is not None:
            body["identity"] = identity
        return self.client.post(
            self.door(f"{PREFIX}/consent", org_key), json=body, headers=self.headers(origin)
        )

    def attach(
        self,
        visitor_key: str,
        content: bytes = PNG_BYTES,
        *,
        filename: str = "snimok-ekrana.png",
        content_type: str = "image/png",
        identity: str | None = None,
        origin: str | None = SITE_ORIGIN,
        org_key: str | None = None,
    ) -> Any:
        # Ключ идёт в адресе, а не в форме: его проверяют ДО разбора формы,
        # иначе файл окажется на диске раньше, чем спросят, чей он.
        params: dict[str, str] = {"visitor_key": visitor_key}
        if org_key is not None:
            params["k"] = org_key
        return self.client.post(
            f"{PREFIX}/attachment",
            params=params,
            files={"file": (filename, content, content_type)},
            headers=self.headers(origin, identity),
        )


@contextmanager
def widget_app(
    monkeypatch: pytest.MonkeyPatch, fake_redis: Any, *, runner: Any = None, **overrides: str
) -> Iterator[WidgetApp]:
    """Приложение с настроенным виджетом, подменённым Redis и, если нужно,
    подменённым обработчиком хода."""
    from fastapi.testclient import TestClient

    settings = widget_settings(monkeypatch, **overrides)
    use_fake_redis(monkeypatch, fake_redis)
    if runner is not None:
        # Патчим там, где имя разрешается: get_runner живёт в widget_runner
        # и берёт build_runner из своего пространства имён. Подмена в widget
        # ничего бы не значила, а боевая сборка тихо ушла бы в каскад.
        import src.channels.widget_runner as widget_runner

        monkeypatch.setattr(widget_runner, "build_runner", lambda _settings: runner)

    from src.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as client:
        if runner is not None:
            client.app.state.widget_runner = runner
        yield WidgetApp(client, settings)


# ─── Чтение базы синхронным движком ───
# 🔴 Приложение под TestClient крутит свой цикл событий; asyncio-сессия
# из теста делила бы с ним один движок между двумя циклами.


def _all(sessions: Any, stmt: Any) -> list[Any]:
    with sessions() as session:
        rows = list(session.execute(stmt).scalars())
        session.commit()
        return rows


def clients_of(sessions: Any, channel: str = CHANNEL) -> list[Client]:
    return _all(sessions, sa.select(Client).where(Client.channel == channel))


def conversation_of(sessions: Any, visitor_key: str) -> Conversation | None:
    stmt = (
        sa.select(Conversation)
        .join(Client, Client.id == Conversation.client_id)
        .where(Client.channel == CHANNEL, Client.external_id == str(visitor_key))
    )
    rows = _all(sessions, stmt)
    return rows[0] if rows else None


def seed_visitor(
    sessions: Any,
    *,
    visitor_key: str = "v-1001",
    mode: Any = None,
    texts: tuple[str, ...] = (),
) -> uuid.UUID:
    """Посетитель с диалогом и парой сообщений, минуя запрос сессии."""
    from src.db.base import ConversationMode, FunnelStage

    now = utcnow()
    with sessions() as session:
        client = Client(channel=CHANNEL, external_id=str(visitor_key), created_at=now)
        session.add(client)
        session.flush()
        conversation = Conversation(
            client_id=client.id,
            mode=mode or ConversationMode.BOT_ACTIVE,
            funnel_stage=FunnelStage.NEW,
            lead_data={},
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
                    # Метки в прошлом и по одной на сообщение: одинаковое
                    # время сделало бы порядок в опросе случайным.
                    created_at=now - timedelta(seconds=len(texts) - index),
                )
            )
        session.commit()
        return conversation.id


def add_message(
    sessions: Any,
    conversation_id: uuid.UUID,
    text: str,
    *,
    role: MessageRole = MessageRole.ASSISTANT,
) -> uuid.UUID:
    with sessions() as session:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=text,
            sent_by_us=role is not MessageRole.USER,
            created_at=utcnow(),
        )
        session.add(message)
        session.commit()
        return message.id


def messages_of(sessions: Any, conversation_id: uuid.UUID) -> list[Message]:
    stmt = (
        sa.select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at, Message.id)
    )
    return _all(sessions, stmt)


# ─── Транспорт очереди (переехал из telegram_fakes) ───


@dataclass
class FakeTransport(Transport):
    """Транспорт в память. ok=False — отказ с кодом error; raise_exc=True —
    исключение вместо результата (проверка внешнего try/except)."""

    ok: bool = True
    sent: list[tuple[str, str]] = field(default_factory=list)
    error: str = "boom"
    raise_exc: bool = False

    async def deliver(self, recipient: str, text: str) -> SendResult:
        if self.raise_exc:
            raise RuntimeError("транспорт сломан")
        if not self.ok:
            return SendResult(ok=False, error=self.error)
        self.sent.append((str(recipient), text))
        return SendResult(ok=True, external_message_id=str(len(self.sent)))
