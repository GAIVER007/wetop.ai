"""Точка входа голосового воркера: python -m voice.worker (из apps/ai-seller)."""

from __future__ import annotations

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
from voice.journal import CallJournal, CallState
from voice.numbers import decide_route
from voice.tools import VoiceTools
from voice.wetop_client import WetopCatalog

logger = logging.getLogger("voice.worker")

GEMINI_MODEL = "gemini-3.1-flash-live-preview"


@lru_cache(maxsize=1)
def settings() -> VoiceSettings:
    return VoiceSettings.from_env(os.environ)


@lru_cache(maxsize=1)
def journal() -> CallJournal:
    return CallJournal(settings().journal_path)


async def start_session(context: JobContext) -> None:
    cfg = settings()
    call_id = context.get_room_id() or f"call-{uuid.uuid4()}"
    route = decide_route(context.metadata, cfg.number_map)

    if route is None:
        journal().record(call_id, CallState.REJECTED, route=None, error="unknown_number")
        session = AgentSession(agent=RejectAgent(), pipeline=_pipeline(cfg))
        await session.start(wait_for_participant=True, run_until_shutdown=True)
        return

    journal().record(call_id, CallState.RECEIVED, route=route)

    holder: dict = {}

    async def transfer(_call_id: str, number: str) -> bool:
        await holder["session"].call_transfer(number)
        return True

    async with httpx.AsyncClient() as http:
        catalog = WetopCatalog(base_url=cfg.wetop_base_url, service_key=cfg.wetop_service_key, http=http)
        tools = VoiceTools(
            call_id=call_id, route=route, journal=journal(), catalog=catalog, profile=cfg.profile, transfer=transfer
        )
        agent = VoiceAgent(profile=cfg.profile, tools=tools, journal=journal(), route=route, call_id=call_id)
        try:
            session = AgentSession(agent=agent, pipeline=_pipeline(cfg))
            holder["session"] = session
            await session.start(wait_for_participant=True, run_until_shutdown=True)
        except Exception:  # noqa: BLE001 - причина в логе, клиенту ничего не показываем
            journal().record(call_id, CallState.FAILED, route=route, error="session_error")
            raise


def _pipeline(cfg: VoiceSettings) -> Pipeline:
    model = GeminiRealtime(
        model=os.getenv("VOICE_GEMINI_MODEL") or GEMINI_MODEL,
        api_key=cfg.google_api_key,
        config=GeminiLiveConfig(voice=cfg.profile.voice, response_modalities=["AUDIO"]),
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
