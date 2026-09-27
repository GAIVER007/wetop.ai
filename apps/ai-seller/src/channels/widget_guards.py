"""Виджет: защита входа — Origin, CORS, пределы, опознание посетителя.

Вынесено из widget.py: модуль канала режется на третьей сотне строк
(struktura.txt), а проверки входа — та часть, которую маршруты только
зовут и не правят.

🔴 Слой 0 публичной двери: всё, что приехало от браузера, проверяется
здесь и ДО того, как что-нибудь будет прочитано, записано или посчитано.
"""

from __future__ import annotations

import ipaddress
import json
import logging
import re
import secrets
import time

import sqlalchemy as sa
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src import dependencies
from src.channels.widget_identity import Visitor, anonymous, is_platform_key, read_identity
from src.config import Settings, normalize_bot_role
from src.db.models import ORG_KEY_RE_TEXT, Organization

logger = logging.getLogger(__name__)

PREFIX = "/widget"
RATE_WINDOW_SECONDS = 3600
# Ключ анонимного посетителя и идентификатор вложения: только безопасные
# символы — они уезжают в имена файлов и в ключи Redis. Ключ пользователя
# платформы под это правило не попадает: его выдаёт подпись, а в user_id
# платформы бывает и точка, и собака (почта как идентификатор).
KEY_RE = re.compile(r"^[A-Za-z0-9_:-]{1,64}$")
# Публичный ключ гостиницы из тега чата (Э4): формат проверяется до базы.
ORG_KEY_RE = re.compile(ORG_KEY_RE_TEXT)


# ─── Origin и CORS ───


def origin_allowed(origin: str, hosts: list[str], own_host: str = "") -> bool:
    """Пустой список доменов — проверка выключена: годится только для
    разработки, о чём приложение предупреждает при старте. Сравниваем
    и с целым источником, и с одним именем хоста: в настройке пишут и так,
    и так."""
    if not hosts or not origin:
        return True  # Origin не прислан: это не кросс-запрос браузера
    value = origin.strip().rstrip("/").lower()
    host = value.split("://")[-1]
    if own_host and host == own_host.strip().lower():
        return True  # свой же адрес: страница /widget/demo
    return any(e.strip().rstrip("/").lower() in (value, host) for e in hosts if e.strip())


def settings_of(request: Request) -> Settings:
    return request.app.state.settings


def check_origin(request: Request) -> None:
    """Чужому сайту не объясняем, что именно не так."""
    hosts = settings_of(request).widget_site_hosts_list
    if not origin_allowed(request.headers.get("origin", ""), hosts, request.headers.get("host", "")):
        raise HTTPException(status_code=403, detail="forbidden")


# ─── Гостиница по ключу из тега (Э4, ADR-083) ───


def seller_mode(settings: Settings) -> bool:
    """Только явное BOT_ROLE=seller: опечатка в роли сводится к помощнику,
    и двери по организациям у неё не открываются."""
    return normalize_bot_role(settings.bot_role) == "seller"


def org_hosts_allowed(origin: str, org: Organization, own_host: str = "") -> bool:
    """Домены гостиницы, а не WIDGET_SITE_HOSTS. 🔴 Пустой список доменов —
    отказ, а не «пускаем всех»: у гостиницы без сайта виджет не подключить,
    и режим разработки этой двери не касается."""
    hosts = [str(h) for h in (org.hosts or [])]
    return bool(hosts) and origin_allowed(origin, hosts, own_host)


async def organization_by_key(org_key: str) -> Organization | None:
    if not org_key or not ORG_KEY_RE.match(org_key):
        return None
    async with dependencies.get_sessionmaker()() as session:
        stmt = sa.select(Organization).where(Organization.public_key == org_key)
        return (await session.execute(stmt)).scalar_one_or_none()


async def require_org(request: Request) -> Organization | None:
    """Дверь канала: у продавца её открывает ключ гостиницы (?k=sk_…),
    и только с её доменов. Помощник — как раньше: Origin по настройке,
    ключа в теге нет, возвращаем None.

    🔴 Неизвестный ключ, чужой домен и active=false отвечают одинаково
    (403 без подробностей): так после конца срока расширения виджет
    на сайте гостиницы молча гаснет (Q-183), а чужой сайт не узнаёт,
    чем именно не подошёл.
    """
    settings = settings_of(request)
    if not seller_mode(settings):
        check_origin(request)
        return None
    org = await organization_by_key(as_str(request.query_params.get("k")))
    origin = request.headers.get("origin", "")
    if org is None or not org.active or not org_hosts_allowed(
        origin, org, request.headers.get("host", "")
    ):
        raise HTTPException(status_code=403, detail="forbidden")
    return org


class WidgetCorsMiddleware(BaseHTTPMiddleware):
    """CORS только для /widget и только для доменов платформы: виджет стоит
    на чужой странице, а открывать под него общий CORS приложения нельзя.

    🔴 Подключается в create_app самым внешним слоем. Без него виджет
    на домене платформы не работает вовсе: домен бота другой, все запросы
    кросс-доменные, и браузер отбрасывает ответы без этих заголовков.
    """

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith(PREFIX):
            return await call_next(request)
        settings: Settings = request.app.state.settings
        origin = request.headers.get("origin", "")
        allowed = bool(origin) and await self._allowed(request, settings, origin)
        if request.method == "OPTIONS" and allowed:
            response: Response = Response(status_code=204)
        else:
            response = await call_next(request)
        if allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            # Vary обязателен: без него кэш отдаст чужому сайту заголовок,
            # выписанный нашему.
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            # X-Widget-Identity и X-Widget-Visitor: признак пользователя и ключ
            # посетителя ходят заголовками, а не в адресе; без разрешения
            # браузер их просто не отправит.
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, X-Widget-Identity, X-Widget-Visitor"
            )
        return response

    @staticmethod
    async def _allowed(request: Request, settings: Settings, origin: str) -> bool:
        """У продавца CORS открывают домены гостиницы по её ключу (Э4):
        preflight несёт адрес с ?k=, тела у него нет. Сбой базы дверь
        не открывает — браузеру честнее не отдать заголовки."""
        own_host = request.headers.get("host", "")
        if not seller_mode(settings):
            return origin_allowed(origin, settings.widget_site_hosts_list, own_host)
        try:
            org = await organization_by_key(as_str(request.query_params.get("k")))
        except Exception:  # noqa: BLE001 — база недоступна
            logger.warning("widget: CORS не смог проверить ключ гостиницы", exc_info=True)
            return False
        return org is not None and bool(org.active) and org_hosts_allowed(origin, org, own_host)


# ─── Тело запроса ───


def as_str(value: object) -> str:
    """Внешние идентификаторы — строкой, на границе с чужой системой."""
    return "" if value is None else str(value).strip()


def _from_tunnel(host: str) -> bool:
    """Свои: loopback и частные сети compose — туннель cloudflared и привратник."""
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    return address.is_loopback or address.is_private


def client_ip(request: Request) -> str:
    """Адрес посетителя для лимитов и блокировок.

    🔴 За туннелем cloudflared сокет у всех посетителей один — адрес контейнера
    туннеля: лимит и блокировка после трёх «инъекций» били сразу по всем
    (аудит 26.09, С-63). CF-Connecting-IP ставит край Cloudflare; он
    учитывается только от своих — снаружи заголовком чужой адрес не выбрать.
    Так же делает платформа (apps/api/src/web-booking/client-ip.ts).
    """
    socket = request.client.host if request.client else ""
    header = (request.headers.get("cf-connecting-ip") or "").strip()
    if socket and _from_tunnel(socket) and header:
        try:
            return str(ipaddress.ip_address(header))
        except ValueError:
            return socket
    return socket


async def read_json(request: Request, max_bytes: int) -> dict:
    """🔴 Предел размера — ДО чтения: заявленный Content-Length отбиваем
    сразу, а тело без него (chunked) читаем кусками и обрываем на первом
    лишнем байте. Прочитать целиком и померить потом — значит уже принять
    переростка в память, а дверь тут публичная и без входа."""
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > max_bytes:
        raise HTTPException(status_code=413, detail="too_large")
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > max_bytes:
            raise HTTPException(status_code=413, detail="too_large")
    try:
        data = json.loads(bytes(body) or b"{}")
    except Exception:
        raise HTTPException(status_code=400, detail="bad_request") from None
    return data if isinstance(data, dict) else {}


# ─── Кто пишет ───


def visitor_from(
    settings: Settings, identity: object, raw_key: object, *, allow_new: bool
) -> Visitor:
    """Сначала подпись платформы и только потом то, что прислал браузер.

    🔴 Правило одно на все двери — и на запись, и на чтение: ключ
    пользователя платформы предсказуем ('pu:' плюс user_id), и без подписи
    по нему открывалась бы чужая переписка. Отвечаем отказом, а не молча
    выдаём новый ключ: у признака истёк срок, и браузер должен спросить
    у платформы свежий, а не терять разговор на каждой реплике.

    🔴 allow_new только у /session: если ключ выдаёт любая дверь, предел
    частоты обходится запросом без ключа — счётчик каждый раз новый.
    """
    signed = read_identity(
        settings.widget_identity_secret, as_str(identity) or None,
        now=int(time.time()), ttl_seconds=settings.widget_identity_ttl_seconds,
    )
    if signed is not None:
        return signed
    key = as_str(raw_key)
    if is_platform_key(key):
        raise HTTPException(status_code=403, detail="identity_required")
    if not key or not KEY_RE.match(key):
        if not allow_new:
            raise HTTPException(status_code=400, detail="bad_request")
        key = secrets.token_urlsafe(18)
    return anonymous(key)


# ─── Предел частоты ───


async def _over_limit(door: str, key: str, limit: int) -> bool:
    """Счётчик запросов в часовом окне. Сбой Redis дверь не закрывает:
    молчащий бот дороже лишней реплики, но это видно в журнале."""
    if limit <= 0 or not key:
        return False
    redis_key = f"widget:rate:{door}:{key}"
    try:
        redis = dependencies.get_redis()
        count = int(await redis.incr(redis_key))
        if count == 1:
            await redis.expire(redis_key, RATE_WINDOW_SECONDS)
        return count > limit
    except Exception:  # noqa: BLE001 — любой сбой Redis
        logger.warning("widget: счётчик частоты недоступен, запрос принят")
        return False


async def rate_exceeded(settings: Settings, door: str, *keys: str) -> bool:
    """🔴 Считаем и по ключу посетителя, и по его адресу: ключ выбирает сам
    браузер, и без второго счётчика предел обходится новым ключом на каждое
    сообщение — а каждое сообщение это ход с каскадом моделей, то есть
    деньги. Окно у каждой двери своё: общее сложило бы выдачу сессии
    с сообщениями и отбило бы первую же реплику.
    """
    limit = settings.widget_messages_per_hour
    for key in keys:
        if await _over_limit(door, key, limit):
            return True
    return False


# ─── Вложение ───


def sniff_type(data: bytes) -> str | None:
    """Тип по первым байтам. 🔴 Заголовку от браузера верить нельзя: его
    ставит кто угодно, а .txt с типом image/png — это не картинка."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
