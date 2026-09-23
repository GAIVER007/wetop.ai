"""Виджет: отправитель канала и фоновая обработка ходов.

Вынесено из widget.py вместе с боевой сборкой: маршруты и сборка живут
в разном темпе, а модуль канала режется на третьей сотне строк.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from src import dependencies
from src.ai.engine_types import IncomingMessage
from src.channels.sender import SendResult
from src.channels.widget_store import new_flag_key
from src.config import Settings

logger = logging.getLogger(__name__)

# Отметка «есть новое» живёт недолго: это будильник для опроса, а не
# хранилище — сама доставка уже лежит в истории.
NEW_FLAG_TTL_SECONDS = 120
# Потолок одновременных ходов. Браузеру уже ответили «принято», но плодить
# задачи с каскадом моделей без счёта нельзя: это память процесса и деньги
# за вызовы. Сверх потолка канал честно отвечает отказом.
MAX_INFLIGHT_TASKS = 200


@dataclass
class WidgetSender:
    """Отправитель канала.

    🔴 Виджет вытягивает сообщения сам, поэтому доставка здесь — это запись
    в историю, которую движок делает сразу после ok. Наружу ничего не уходит,
    отказу взяться неоткуда, очередь исходящих не нужна. Отметка в Redis
    только будит долгий опрос: её потеря стоит одного таймаута, а не ответа.
    """

    # Не задан — берём общий клиент процесса в момент отправки: так подмена
    # на fakeredis в тестах достаёт и отправитель, собранный заранее.
    redis: Any = None

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        client = self.redis if self.redis is not None else dependencies.get_redis()
        try:
            await client.set(new_flag_key(str(external_id)), b"1", ex=NEW_FLAG_TTL_SECONDS)
        except Exception:  # noqa: BLE001 — любой сбой Redis
            logger.warning("widget: отметка не поставлена, опрос ответит по таймауту")
        return SendResult(ok=True)


@dataclass
class WidgetRunner:
    """Ходы идут фоновыми задачами: браузеру уже ответили «принято», а ход
    с каскадом моделей длится до минуты."""

    engine_factory: Callable[[], Any]
    sessionmaker: Any
    redis: Any
    settings: Settings
    _tasks: set[asyncio.Task] = field(default_factory=set, init=False, repr=False)
    _engine: Any = field(default=None, init=False, repr=False)

    @property
    def engine(self) -> Any:
        """Движок собирается один раз и живёт с обработчиком."""
        if self._engine is None:
            self._engine = self.engine_factory()
        return self._engine

    def submit(self, incoming: IncomingMessage) -> asyncio.Task | None:
        """Ссылка на задачу хранится до конца: иначе цикл соберёт её на полпути.

        Очередь переполнена — None, и канал отвечает отказом: браузер
        повторит. Принять и потерять молча хуже, чем не принять.
        """
        if len(self._tasks) >= MAX_INFLIGHT_TASKS:
            logger.warning("widget: одновременных ходов слишком много, сообщение не принято")
            return None
        task = asyncio.create_task(self._handle(incoming))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    async def drain(self) -> None:
        """Дождаться всех задач: для остановки приложения и для тестов."""
        while self._tasks:
            await asyncio.gather(*list(self._tasks), return_exceptions=True)

    async def _handle(self, incoming: IncomingMessage) -> None:
        """Исключения ловятся здесь: один упавший ход не роняет обработчик."""
        try:
            await self.engine.process_message(incoming)
        except Exception:
            logger.exception("widget: обработка сообщения упала")


def build_runner(settings: Settings) -> WidgetRunner:
    """Боевая сборка канала. Импорты внутри: движок и каскад не нужны тем,
    кто подменяет runner в тестах.

    🔴 Здесь внешняя система подключается к живому пути: без хука заявка
    наружу не пишется никогда и алерт «горячий лид» не приходит, а без
    реестра модель не видит инструментов наличия и цены. Провайдеров
    выбирает фабрика по настройке — канал о конкретной системе не знает.
    """
    from src.ai.engine import build_engine
    from src.ai.hotel_tools import build_registry
    from src.ai.llm import CascadeClient, set_cascade_client
    from src.integrations.factory import get_providers
    from src.integrations.lead_writer import LeadWriter

    # Каскад пересобирается с реестром: build_engine берёт его синглтоном,
    # а пустой реестр означал бы модель без инструментов.
    set_cascade_client(
        CascadeClient(
            settings, http_client=dependencies.get_http_client(), tools=build_registry(get_providers)
        )
    )
    lead_hook = LeadWriter(
        sessionmaker=dependencies.get_sessionmaker(), redis=dependencies.get_redis(),
        # Фабрика, а не готовый набор: режим внешней системы читается настройкой.
        providers_getter=get_providers, settings=settings,
    )

    def factory() -> Any:
        # Виджет — веб-страница: эмодзи она показывает, разметку humanizer снимает.
        return build_engine(
            settings, sender=WidgetSender(), lead_hook=lead_hook,
            channel_markdown=False, channel_emoji=True,
        )

    return WidgetRunner(
        factory, dependencies.get_sessionmaker(), dependencies.get_redis(), settings
    )


def get_runner(app) -> WidgetRunner:
    """Runner из app.state; нет — создаётся лениво один раз."""
    runner = getattr(app.state, "widget_runner", None)
    if runner is None:
        runner = build_runner(app.state.settings)
        app.state.widget_runner = runner
    return runner
