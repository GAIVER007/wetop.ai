"""Вход в панель: пароль, счётчик перебора, токен сессии, путь и адреса.

Слой 8б guardrails.md целиком лежит здесь и в ``twofa``. Главное правило
пароля: 🔴 в настройках лежит ХЕШ, а не пароль. Файл настроек читают агент,
бэкап и любой, кто попал на сервер, — открытый пароль оттуда достаётся
без усилий.

🔴 Ни пароля, ни токена в журнале: строка журнала переживает инцидент
и уезжает наружу вместе с выгрузкой.
"""

from __future__ import annotations

import ipaddress
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.alerts.raise_alert import raise_alert
from src.config import Settings
from src.db.base import utcnow
from src.db.models import DashboardUser

logger = logging.getLogger(__name__)

# 🔴 ОДНА фраза на любую неудачу входа: «нет такого пользователя» и «неверный
# пароль» — разные ответы, и по разнице видно, что логин угадан. Дальше
# перебирают только пароль, а это на порядок дешевле.
LOGIN_FAILED_MESSAGE = "Неверная почта или пароль"

# Задержка на каждую неудачную попытку: перебор становится нерентабельным
# ещё до блокировки, а живому человеку секунда не мешает.
FAILED_DELAY_SECONDS = 1.0

FAIL_EMAIL_PREFIX = "login:fail:email:"
FAIL_IP_PREFIX = "login:fail:ip:"
BLOCK_PREFIX = "login:block:"

JWT_ALGORITHM = "HS256"


class ConfigError(RuntimeError):
    """Настройка не заполнена, и работать с пустым значением нельзя."""


@dataclass(frozen=True)
class LoginAttempt:
    """Исход неудачной попытки: пускать ли дальше, до какого времени закрыто
    и сколько неудач насчитано. Счёт возвращается, чтобы вызывающий не лез
    в Redis второй раз."""

    allowed: bool
    blocked_until: datetime | None
    count: int


# ─── Пароль ───


def hash_password(plain: str) -> str:
    """Хеш bcrypt для .env и для тестов. Считается один раз, руками.

    Пароль длиннее 72 байт не обрезаем молча: обрезка делает разные пароли
    одинаковыми, и владелец об этом не узнает.
    """
    raw = plain.encode("utf-8")
    if len(raw) > 72:
        raise ValueError("пароль длиннее 72 байт: bcrypt столько не берёт, задайте короче")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """Сверка пароля с хешем. Любая беда — False, без исключения наружу.

    🔴 bcrypt 5.x бросает ValueError на пароле длиннее 72 байт и на битом
    хеше. Пропущенное исключение превратило бы форму входа в 500 —
    и заодно рассказало бы переборщику, что он нащупал границу.
    """
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Причину не пишем подробнее: в текст попал бы сам пароль.
        logger.warning("пароль не проверен: неподходящая длина или формат хеша")
        return False


# 🔴 Фиктивный хеш для несуществующей почты: bcrypt должен считаться в обеих
# ветках входа. Иначе ответ на неизвестный логин приходит на ~0,2 с раньше,
# и логин угадывается секундомером — та самая подсказка, которую запрещает
# правило про одинаковый отказ. Значение случайное и живёт в памяти процесса.
DUMMY_PASSWORD_HASH = bcrypt.hashpw(
    secrets.token_urlsafe(24).encode("ascii"), bcrypt.gensalt()
).decode("ascii")


# ─── Перебор: счётчик живёт на сервере ───


def _norm_email(email: str) -> str:
    """Ключ счётчика не должен зависеть от регистра и пробелов, иначе
    «Ivan@» и «ivan@» дадут переборщику два независимых лимита."""
    return (email or "").strip().lower()


def _norm_ip(ip: str | None) -> str:
    return (ip or "-").strip() or "-"


def _short_email(email: str) -> str:
    """Для алерта: первая буква и домен. Полного адреса в чужом канале
    алертов быть не должно (см. raise_alert)."""
    email = _norm_email(email)
    if "@" not in email:
        return "***"
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


async def _bump(redis, key: str, window: int) -> int:
    """Счётчик с окном: INCR, и на первой единице — срок жизни ключа.

    🔴 Счётчик в Redis, а не в браузере и не в памяти процесса: он переживает
    перезагрузку страницы, смену браузера и перезапуск приложения.
    """
    count = int(await redis.incr(key))
    if count == 1:
        await redis.expire(key, window)
    return count


async def _block_user(
    sessionmaker: async_sessionmaker[AsyncSession] | None,
    *,
    email: str,
    until: datetime,
) -> None:
    """Отметка блокировки у учётки. Своя сессия: вызов приходит из запроса,
    но запись должна пережить его закрытие."""
    if sessionmaker is None:
        return
    try:
        async with sessionmaker() as session:
            user = (
                await session.execute(select(DashboardUser).where(DashboardUser.email == email))
            ).scalar_one_or_none()
            if user is None:
                # Несуществующая почта — норма при переборе: ключ в Redis уже
                # стоит, и этого достаточно.
                return
            user.blocked_until = until
            user.failed_logins = (user.failed_logins or 0) + 1
            await session.commit()
    except Exception:
        # Блокировка в Redis уже поставлена — отметка в базе только для панели.
        logger.exception("отметку блокировки учётки записать не удалось")


async def register_failure(
    redis,
    sessionmaker: async_sessionmaker[AsyncSession] | None,
    settings: Settings,
    *,
    email: str,
    ip: str,
) -> LoginAttempt:
    """Записать неудачную попытку: счётчики, блокировка, алерт владельцу.

    Считаем по почте И по адресу: перебор одной учётки с разных адресов
    и перебор разных учёток с одного адреса — это две разные атаки, и одного
    счётчика на них не хватает.
    """
    email_key = _norm_email(email)
    ip_key = _norm_ip(ip)
    window = max(1, settings.dashboard_login_window_seconds)
    try:
        by_email = await _bump(redis, FAIL_EMAIL_PREFIX + email_key, window)
        by_ip = await _bump(redis, FAIL_IP_PREFIX + ip_key, window)
    except Exception:
        # Redis лёг: сама попытка всё равно отбита 401. Молчать нельзя —
        # без этой строки пропажу защиты от перебора никто не заметит.
        logger.exception("счётчик неудачных входов не обновлён")
        return LoginAttempt(allowed=True, blocked_until=None, count=0)

    count = max(by_email, by_ip)
    blocked_until: datetime | None = None

    if count >= max(1, settings.dashboard_login_max_attempts):
        seconds = max(1, settings.dashboard_login_block_seconds)
        blocked_until = utcnow() + timedelta(seconds=seconds)
        try:
            await redis.set(BLOCK_PREFIX + "email:" + email_key, "1", ex=seconds)
            await redis.set(BLOCK_PREFIX + "ip:" + ip_key, "1", ex=seconds)
        except Exception:
            logger.exception("блокировку входа поставить не удалось")
        await _block_user(sessionmaker, email=email_key, until=blocked_until)
        logger.warning("вход в панель заблокирован на %d с, неудач: %d", seconds, count)

    if count == settings.dashboard_login_alert_after:
        # Ровно на настроенной попытке, а не на каждой следующей: иначе
        # перебор сам превратится в поток алертов.
        # 🔴 В теле ни пароля, ни полного адреса: канал алертов чужой.
        await raise_alert(
            sessionmaker,
            redis,
            settings,
            event_type="login_attack",
            body=(
                f"Панель: неудачных попыток входа: {count}. "
                f"Учётка {_short_email(email_key)}."
            ),
            dedup_key=f"login_attack:{ip_key}",
        )

    return LoginAttempt(allowed=blocked_until is None, blocked_until=blocked_until, count=count)


async def is_blocked(
    redis, *, email: str, ip: str, sessionmaker=None
) -> bool:
    """Стоит ли блокировка на учётке или на адресе.

    Два рубежа. Быстрый — ключи в Redis. Долговечный — поле blocked_until
    в базе: перезапуск или очистка кэша иначе снимали бы блок молча,
    и перебор продолжался бы с чистого листа.

    Сбой Redis сам по себе не запирает панель: пароль и второй фактор
    на месте, а закрытая во время аварии панель — это владелец без доступа
    к своим контактам ровно тогда, когда что-то уже сломалось. Но
    записанную в базу блокировку мы всё равно уважаем.
    """
    keys = (
        BLOCK_PREFIX + "email:" + _norm_email(email),
        BLOCK_PREFIX + "ip:" + _norm_ip(ip),
    )
    try:
        for key in keys:
            if await redis.exists(key):
                return True
    except Exception:
        logger.exception("проверка блокировки входа не выполнена")

    # Долговечный рубеж: блокировка записана в базу и переживает кэш.
    if sessionmaker is not None:
        try:
            async with sessionmaker() as session:
                until = (
                    await session.execute(
                        select(DashboardUser.blocked_until).where(
                            DashboardUser.email == _norm_email(email)
                        )
                    )
                ).scalar_one_or_none()
            if until is not None and _aware(until) > utcnow():
                return True
        except Exception:
            logger.exception("проверка блокировки в базе не выполнена")
    return False


def _aware(value: datetime) -> datetime:
    """SQLite отдаёт метку без часового пояса; сравнивать наивное с aware нельзя."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


async def reset_failures(redis, *, email: str, ip: str) -> None:
    """Успешный вход обнуляет счётчики: иначе редкие опечатки владельца
    за неделю сложатся в блокировку на ровном месте."""
    try:
        await redis.delete(
            FAIL_EMAIL_PREFIX + _norm_email(email),
            FAIL_IP_PREFIX + _norm_ip(ip),
        )
    except Exception:
        logger.exception("счётчики неудачных входов не сброшены")


# ─── Сессия ───


def issue_token(settings: Settings, *, email: str, role: str, twofa_done: bool) -> str:
    """Токен сессии. Поле tfa: пройден ли второй фактор — до него токен
    годится только для формы кода, но не для данных панели.

    🔴 Пустой DASHBOARD_JWT_SECRET — ConfigError: подписывать пустым ключом
    значит не подписывать вовсе, и любой соберёт себе токен владельца.
    """
    secret = (settings.dashboard_jwt_secret or "").strip()
    if not secret:
        raise ConfigError("подпись сессии не настроена: заполните DASHBOARD_JWT_SECRET")
    now = utcnow()
    payload = {
        "sub": _norm_email(email),
        "role": role,
        "tfa": bool(twofa_done),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=max(1, settings.dashboard_session_ttl_hours))).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def read_token(settings: Settings, token: str) -> dict | None:
    """Разбор токена. Истёкший, с чужой подписью или мусорный — None.

    Исключений наружу нет: на каждый такой случай ответ один — 401,
    и разбирать разницу вызывающему незачем (он бы её и показал).
    """
    secret = (settings.dashboard_jwt_secret or "").strip()
    if not secret or not token:
        return None
    try:
        return jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


# ─── Кто может открыть ───


def check_ip_allowed(settings: Settings, ip: str | None) -> bool:
    """Список адресов из настроек. Пусто — вход отовсюду: сужение
    необязательное, с мобильного интернета оно ломает работу.

    Понимаем и одиночный адрес, и подсеть: у офиса обычно подсеть.
    """
    allowed = [a.strip() for a in (settings.dashboard_allowed_ips or "").split(",") if a.strip()]
    if not allowed:
        return True
    if not ip:
        # Список задан, а адрес неизвестен — закрыто: неизвестный адрес
        # в списке офисных не значится.
        return False
    try:
        addr = ipaddress.ip_address(ip.strip())
    except ValueError:
        return False
    for item in allowed:
        try:
            if "/" in item:
                if addr in ipaddress.ip_network(item, strict=False):
                    return True
            elif addr == ipaddress.ip_address(item):
                return True
        except ValueError:
            logger.warning("в DASHBOARD_ALLOWED_IPS неразбираемое значение, пропущено")
    return False


def require_dashboard_path(settings: Settings) -> str:
    """Путь панели из настроек, вида '/p7k2m9x4qz1w'.

    🔴 Пусто — ConfigError, а не /admin по умолчанию: молчаливый запасной
    путь означает панель со всеми контактами на самом перебираемом адресе
    в интернете.

    ⚠️ Сам по себе длинный путь — не защита: он утекает в историю браузера
    и в журналы привратника. Смысл один — убрать фоновый шум автоматических
    переборщиков, которые круглые сутки ломятся в /admin и /wp-admin.
    """
    prefix = (settings.dashboard_path_prefix or "").strip()
    if not prefix.strip("/"):
        raise ConfigError("путь панели не задан: заполните DASHBOARD_PATH_PREFIX")
    return "/" + prefix.strip("/")
