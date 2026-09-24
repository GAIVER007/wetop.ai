"""Опознание пользователя платформы для виджета.

Бот живёт внутри платформы, и кто пишет — знает платформа, а не браузер.
Поэтому признак пользователя приходит ПОДПИСАННЫМ её ключом, а всё, что
браузер прислал сам, доверия не имеет: подставить чужой user_id в теге
script стоит десяти секунд. Неподписанный посетитель тоже обслуживается —
как аноним.

🔴 В журнал отсюда не уходит ни токен, ни почта целиком: только признак
«подписан/аноним» и хвост ключа. Это чужие персональные данные, а журнал
читают и пересылают.
"""

from __future__ import annotations

import base64
from contextvars import ContextVar
from dataclasses import dataclass

from src.security.signatures import sign_hmac_sha256, verify_hmac_sha256

# Ключ пользователя платформы отличается от анонимного префиксом: по нему
# канал видит, что такой ключ без подписи принимать нельзя.
PLATFORM_PREFIX = "pu:"
# Запас на расхождение часов платформы и бота: минута вперёд — не подделка.
CLOCK_SKEW_SECONDS = 60
# user_id | email | org_id | role | issued_at
_FIELDS = 5
_SEPARATOR = "|"


@dataclass(frozen=True)
class Visitor:
    """Кто пишет в виджет. key — устойчивый ключ посетителя, всегда строка."""

    key: str
    user_id: str | None = None
    email: str | None = None
    org_id: str | None = None
    role: str | None = None
    signed: bool = False

    @property
    def display_name(self) -> str | None:
        """Как посетителя зовёт панель. У анонима имени нет — и выдумывать
        его нельзя: оператор решит, что клиент представился."""
        if not self.signed:
            return None
        return self.email or self.user_id or None


def _clean(value: object) -> str:
    """Поле для строки под подписью. 🔴 Разделитель из значения вычищается:
    иначе почта с '|' сдвинет разбор, и подпись сойдётся не на тех полях."""
    return str(value if value is not None else "").replace(_SEPARATOR, " ").strip()


def sign_identity(
    secret: str, *, user_id: str, email: str, org_id: str, role: str, issued_at: int
) -> str:
    """Подписывает признак пользователя.

    Это код ПЛАТФОРМЫ: бот признаки только проверяет. Функция живёт здесь,
    чтобы формат был виден тестам и тому, кто будет встраивать виджет.

    Строка под подписью — поля через '|':
        '42|ivan@example.com|7|manager|1700000000'
    Токен — '<payload_b64>.<hmac_hex>'; платформа кладёт его в атрибут
    data-identity тега script и обновляет не реже, чем раз в TTL.
    """
    payload = _SEPARATOR.join(
        (_clean(user_id), _clean(email), _clean(org_id), _clean(role), str(int(issued_at)))
    )
    raw = payload.encode("utf-8")
    body = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return f"{body}.{sign_hmac_sha256(secret, raw)}"


def read_identity(
    secret: str, token: str | None, *, now: int, ttl_seconds: int
) -> Visitor | None:
    """Проверяет подпись и срок. Любая беда с форматом — None, без исключений:
    сломанный токен от чужого — это просто «не подписан», а не отказ в приёме.

    🔴 Пустой secret — None всегда: нет ключа, нет доверия. Иначе забытая
    переменная превратила бы любой присланный браузером признак в правду.
    """
    if not secret or not token or "." not in token:
        return None
    body, _, signature = token.strip().partition(".")
    try:
        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        payload = raw.decode("utf-8")
    except (ValueError, UnicodeError):
        return None
    # compare_digest внутри verify_hmac_sha256: обычное == выдаёт подпись
    # по времени ответа побайтно.
    if not verify_hmac_sha256(secret, raw, signature):
        return None
    parts = payload.split(_SEPARATOR)
    if len(parts) != _FIELDS:
        return None
    user_id, email, org_id, role, issued = parts
    try:
        issued_at = int(issued)
    except ValueError:
        return None
    if not user_id:
        return None
    # Просрочен или выписан из будущего — не принимаем: перехваченный токен
    # иначе работал бы вечно, а часы платформы могут уйти вперёд.
    if issued_at > now + CLOCK_SKEW_SECONDS or issued_at + ttl_seconds < now:
        return None
    return Visitor(
        key=PLATFORM_PREFIX + user_id,
        user_id=user_id,
        email=email or None,
        org_id=org_id or None,
        role=role or None,
        signed=True,
    )


def anonymous(visitor_key: str) -> Visitor:
    """Посетитель без подписи. Ключ — строкой: внешние идентификаторы строкой."""
    return Visitor(key=str(visitor_key), signed=False)


def is_platform_key(visitor_key: str) -> bool:
    """Ключ принадлежит пользователю платформы: без подписи его не выдают."""
    return str(visitor_key).startswith(PLATFORM_PREFIX)


def key_tail(visitor_key: str) -> str:
    """Хвост ключа для журнала. Целый ключ — это доступ к диалогу."""
    return str(visitor_key)[-6:]


# ─── Текущий посетитель хода ───

# 🔴 Инструментам модели нужно знать, КТО спрашивает: журнал происшествий
# показывается только своему хозяину. Тащить посетителя через движок нельзя —
# движок про платформу не знает и знать не должен (это ядро). Поэтому канал
# кладёт его сюда, а инструменты берут отсюда.
#
# ContextVar, а не глобал: ход идёт фоновой задачей, задач одновременно много,
# и обычная переменная процесса подменила бы одного пользователя другим —
# то есть показала бы чужие ошибки. asyncio.create_task копирует контекст,
# поэтому значение, поставленное перед submit, доезжает до задачи и дальше
# никуда не расходится.
current_visitor: ContextVar["Visitor | None"] = ContextVar(
    "current_visitor", default=None
)


def get_current_visitor() -> "Visitor | None":
    """Посетитель текущего хода или None (вне хода и в фоновых прогонах)."""
    return current_visitor.get()


def clear_current_visitor() -> None:
    """Снять посетителя после хода. Оставленное значение — это чужие ошибки
    в следующем ответе, если задача переиспользует контекст."""
    current_visitor.set(None)
