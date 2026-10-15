"""Мелочи, общие для экранов панели.

Вынесены отдельно, потому что dashboard_router.py режется на третьей сотне
строк (struktura.txt), а дублировать маскировку имени в двух модулях —
значит однажды поправить её в одном.
"""

from __future__ import annotations

from src import dependencies
from src.config import Settings
from src.db.base import utcnow
from src.db.models import OwnerAction


def sessions():
    """Фабрика сессий через модуль, а не импортом имени: тесты подменяют
    dependencies.get_sessionmaker, и импортированное имя подмену не увидит."""
    return dependencies.get_sessionmaker()


def redis():
    """То же самое про Redis: обращение через модуль."""
    return dependencies.get_redis()


def mask_name(name: str | None) -> str:
    """🔴 Первая буква и звёздочки. Список диалогов висит на экране весь день:
    целое имя утекает со скриншотом и через плечо, а в списке оно не нужно."""
    clean = (name or "").strip()
    return f"{clean[0]}***" if clean else "—"


def iso(value) -> str | None:
    """Время в ответе строкой ISO; None остаётся None."""
    return value.isoformat() if value is not None else None


#: Канал клиента, которого завела вкладка «Проверка» (`POST /internal/sandbox`). 🔴 Живёт здесь, а не
#: у самой песочницы: отбор очереди техподдержки стоит в panel_conversations, а `dashboard_router`
#: импортирует этот пакет, и обратный импорт закольцевался бы.
SANDBOX_CHANNEL = "sandbox"


def allowed_models(settings: Settings) -> list[str]:
    """LLM_ALLOWED_MODELS через запятую. Пусто — экран выбора не показывается."""
    return [m.strip() for m in settings.llm_allowed_models.split(",") if m.strip()]


# Слова, по которым имя настройки считается секретом. 🔴 Белый список правки
# на лету — сам настройка: завтра в RUNTIME_SETTINGS_ALLOWED допишут ключ
# роутера, и экран настроек покажет его всем, кто вошёл. Второй рубеж дешевле
# разбирательства, откуда утёк ключ.
SECRET_WORDS = ("key", "password", "secret", "token", "hash", "dsn", "url")


def is_secret_name(name: str) -> bool:
    """Имя пахнет секретом — значение наружу не отдаём."""
    lowered = name.lower()
    return any(word in lowered for word in SECRET_WORDS)


def log_action(session, *, action: str, payload: dict, conversation_id=None) -> None:
    """Строка в owner_actions. Метку времени ставит приложение, не база:
    server_default схлопнул бы метки по времени начала транзакции.
    Commit делает вызывающий — действие и его запись в одной транзакции."""
    session.add(
        OwnerAction(
            conversation_id=conversation_id,
            action=action,
            payload=payload,
            created_at=utcnow(),
        )
    )
