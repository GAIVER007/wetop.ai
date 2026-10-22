"""Точка входа голосового воркера: python -m voice.worker (из apps/ai-seller)."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from functools import lru_cache

import httpx
from dotenv import load_dotenv
from videosdk.agents import AgentSession, JobContext, Options, Pipeline, RoomOptions, WorkerJob
from videosdk.plugins.google import GeminiLiveConfig, GeminiRealtime

from voice.agent import RejectAgent, VoiceAgent
from voice.config import ConfigError, VoiceSettings
from voice.flusher import drain, run_flusher
from voice.journal import CallJournal, CallState
from voice.outbox import Outbox
from voice.platform import PlatformClient, PlatformEvents
from voice.session_plan import PlanRejected, plan_call
from voice.tools import VoiceTools
from voice.wetop_client import WetopCatalog

logger = logging.getLogger("voice.worker")

GEMINI_MODEL = "gemini-3.1-flash-live-preview"
DRAIN_SECONDS = 10
FLUSHER_STOP_SECONDS = 5


@lru_cache(maxsize=1)
def settings() -> VoiceSettings:
    return VoiceSettings.from_env(os.environ)


@lru_cache(maxsize=1)
def journal() -> CallJournal:
    return CallJournal(settings().journal_path)


@lru_cache(maxsize=1)
def outbox() -> Outbox:
    return Outbox(settings().outbox_dir)


async def start_session(context: JobContext) -> None:
    cfg = settings()
    call_id = context.get_room_id() or f"call-{uuid.uuid4()}"
    async with httpx.AsyncClient() as http:
        platform = PlatformClient(base_url=cfg.wetop_base_url, key=cfg.ingest_key, http=http)
        events = PlatformEvents(outbox())
        stop = asyncio.Event()
        flusher = asyncio.create_task(run_flusher(outbox(), platform, stop))
        try:
            await _run_call(cfg, context, call_id, http, platform, events)
        finally:
            stop.set()
            # фоновая отправка не должна держать слот воркера: даём закончить проход и снимаем
            try:
                await asyncio.wait_for(flusher, timeout=FLUSHER_STOP_SECONDS)
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception):  # noqa: BLE001
                flusher.cancel()
            # что не ушло за отведённое время, остаётся в очереди: его подхватит следующий звонок или `python -m voice.flush`.
            # Сбой отчётности не должен подменять исход звонка
            try:
                await drain(outbox(), platform, timeout_seconds=DRAIN_SECONDS)
            except Exception as exc:  # noqa: BLE001 - в лог только тип, в очереди могут быть данные клиента
                logger.error("очередь событий: не удалось догнать при выходе (%s)", type(exc).__name__)


async def _run_call(cfg, context, call_id, http, platform, events) -> None:
    plan = await plan_call(context.metadata, cfg.number_map, platform, cfg.profile)
    if isinstance(plan, PlanRejected):
        journal().record(call_id, CallState.REJECTED, route=None, error=plan.reason)
        session = AgentSession(agent=RejectAgent(), pipeline=_pipeline(cfg, cfg.profile))
        await session.start(wait_for_participant=True, run_until_shutdown=True)
        return

    route, profile = plan.route, plan.profile
    journal().record(call_id, CallState.RECEIVED, route=route, profile_source=plan.source)
    events.state(call_id, route, CallState.RECEIVED)

    holder: dict = {}

    async def transfer(_call_id: str, number: str) -> bool:
        await holder["session"].call_transfer(number)
        return True

    catalog = WetopCatalog(base_url=cfg.wetop_base_url, service_key=cfg.wetop_service_key, http=http)
    tools = VoiceTools(
        call_id=call_id, route=route, journal=journal(), catalog=catalog, profile=profile, transfer=transfer, events=events
    )
    agent = VoiceAgent(profile=profile, tools=tools, journal=journal(), route=route, call_id=call_id, events=events)
    try:
        session = AgentSession(agent=agent, pipeline=_pipeline(cfg, profile))
        holder["session"] = session
        await session.start(wait_for_participant=True, run_until_shutdown=True)
    except Exception:  # noqa: BLE001 - причина в логе SDK, клиенту ничего не показываем
        journal().record(call_id, CallState.FAILED, route=route, error="session_error")
        events.state(call_id, route, CallState.FAILED, error_code="session_error")
        raise


def _pipeline(cfg: VoiceSettings, profile) -> Pipeline:
    model = GeminiRealtime(
        model=os.getenv("VOICE_GEMINI_MODEL") or GEMINI_MODEL,
        api_key=cfg.google_api_key,
        config=GeminiLiveConfig(voice=profile.voice, response_modalities=["AUDIO"]),
    )
    return Pipeline(llm=model)


def make_context() -> JobContext:
    return JobContext(room_options=RoomOptions())


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    try:
        cfg = settings()
    except ConfigError as exc:
        raise SystemExit(f"Настройка воркера: {exc}") from None
    options = Options(
        agent_id=cfg.agent_id,
        auth_token=cfg.videosdk_token,
        register=True,
        max_processes=cfg.max_processes,
        host=os.getenv("VOICE_WORKER_HOST", "127.0.0.1"),
        port=cfg.port,
    )
    try:
        WorkerJob(entrypoint=start_session, jobctx=make_context, options=options).start()
    except Exception as exc:  # noqa: BLE001 - текст исключения может нести адрес или ключ
        logger.error("воркер остановлен: %s", type(exc).__name__)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
