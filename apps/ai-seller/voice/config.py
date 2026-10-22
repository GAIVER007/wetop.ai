"""Настройки воркера из окружения. Падаем при старте, а не посреди звонка."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlparse

from voice.numbers import NumberMap, NumberMapError
from voice.profile import VoiceProfile

REQUIRED = (
    "VIDEOSDK_AUTH_TOKEN",
    "GOOGLE_API_KEY",
    "VOICE_AGENT_ID",
    "VOICE_WETOP_BASE_URL",
    "VOICE_WETOP_SERVICE_KEY",
    "VOICE_JOURNAL_PATH",
)


class ConfigError(Exception):
    """Текст называет переменную, но не её значение."""


@dataclass(frozen=True)
class VoiceSettings:
    videosdk_token: str
    google_api_key: str
    agent_id: str
    wetop_base_url: str
    wetop_service_key: str
    journal_path: str
    number_map: NumberMap
    profile: VoiceProfile
    port: int = 8081
    max_processes: int = 10

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "VoiceSettings":
        for name in REQUIRED:
            if not (env.get(name) or "").strip():
                raise ConfigError(f"не задана переменная {name}")
        try:
            port = int(env.get("VOICE_WORKER_PORT") or 8081)
        except ValueError:
            raise ConfigError("VOICE_WORKER_PORT: ожидалось число") from None
        try:
            numbers = NumberMap.from_json(env.get("VOICE_NUMBER_MAP"))
        except NumberMapError:
            raise ConfigError("VOICE_NUMBER_MAP: неверный формат") from None
        if len(numbers) > 1:
            raise ConfigError(
                "VOICE_NUMBER_MAP: больше одного номера не поддерживается, пока у профиля нет разделения по объектам"
            )
        base = env["VOICE_WETOP_BASE_URL"].strip()
        host = urlparse(base).hostname or ""
        if not base.startswith("https://") and host not in ("localhost", "127.0.0.1"):
            raise ConfigError("VOICE_WETOP_BASE_URL: ключ нельзя слать по http")
        return cls(
            videosdk_token=env["VIDEOSDK_AUTH_TOKEN"].strip(),
            google_api_key=env["GOOGLE_API_KEY"].strip(),
            agent_id=env["VOICE_AGENT_ID"].strip(),
            wetop_base_url=env["VOICE_WETOP_BASE_URL"].strip(),
            wetop_service_key=env["VOICE_WETOP_SERVICE_KEY"].strip(),
            journal_path=env["VOICE_JOURNAL_PATH"].strip(),
            number_map=numbers,
            profile=VoiceProfile.from_env(env),
            port=port,
        )
