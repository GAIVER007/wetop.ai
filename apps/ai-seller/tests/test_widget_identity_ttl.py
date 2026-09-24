"""Срок подписи равен сроку сессии платформы.

Виджет читает data-identity один раз при загрузке страницы, а приложение
платформы ходит между экранами без перезагрузки. С часовым сроком через час
вошедший человек стал бы для помощника чужим и перестал видеть свой диалог.
"""

import re
from pathlib import Path

from src.config import Settings

PLATFORM_SESSION_SECONDS = 12 * 3600
ROOT = Path(__file__).resolve().parent.parent


def test_default_ttl_matches_the_platform_session() -> None:
    assert Settings.model_fields["widget_identity_ttl_seconds"].default == PLATFORM_SESSION_SECONDS


def test_env_example_says_the_same() -> None:
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    assert re.search(rf"^WIDGET_IDENTITY_TTL_SECONDS={PLATFORM_SESSION_SECONDS}\b", text, re.MULTILINE)
