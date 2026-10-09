"""Безопасное чтение страницы чужого сайта для гостевого мастера (ТЗ-O2a, `plans/guest-onboarding-orchestration`).

Сюда приходит адрес, который ввёл **незнакомый человек без входа**, и бот сходит по нему в интернет со своего сервера.
Значит, любой адрес — потенциальная атака на то, что видно изнутри: база, служебные порты, метаданные облака.
Защита построена на трёх правилах, и каждое держит свой тест:

1. Проверяются **адреса, а не имена**: имя резолвится, и ВСЕ полученные адреса должны быть публичными (иначе отказ целиком).
   Числовые записи вроде `0x7f000001` и `127.1` отбрасываются ещё до DNS: системный резолвер понимает их как 127.0.0.1.
2. Соединяемся **ровно с тем адресом, который проверили** (закрепление): в URL запроса стоит IP, имя уходит в `Host` и SNI.
   Второго обращения к DNS нет, поэтому ребайндинг («на проверке публичный, на подключении 127.0.0.1») не работает.
3. Каждый редирект проходит все проверки заново, переходов не больше трёх; ответ режется по реальным байтам, а не по
   заголовку, сжатое читается с потолком на выход (бомба-архив), всё вместе укладывается в один общий срок.

Здесь нет ни модели, ни записи в базу: только «адрес → очищенный текст». Разбор текста моделью, маска ПД и проверка
на инъекции делаются выше (срез O2b). Ссылки на соседние страницы того же сайта тоже не собираются: они идут отдельным
коммитом после зелёных тестов безопасности (П6).
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import zlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx

MAX_BYTES = 2 * 1024 * 1024
MAX_TEXT = 100_000
MAX_REDIRECTS = 3
TOTAL_TIMEOUT = 10.0
ALLOWED_PORTS = {80, 443}
HTML_TYPES = {"text/html", "application/xhtml+xml"}
USER_AGENT = "WETOP-SiteReader/1.0 (+https://wetop.ai)"

Resolver = Callable[[str, int], Awaitable[list[str]]]

_REDIRECTS = {301, 302, 303, 307, 308}
_INTERNAL_SUFFIXES = (".localhost", ".local", ".internal", ".home.arpa", ".lan", ".intranet", ".corp")
# 0x7f000001, 2130706433, 127.1, 0177.0.0.1: системный резолвер читает их как адрес, а это не имя
_NUMERIC_HOST = re.compile(r"(0x[0-9a-f]*|[0-9]+)(\.(0x[0-9a-f]*|[0-9]+))*")
_BLOCKED = [
    ipaddress.ip_network(net)
    for net in (
        "0.0.0.0/8", "100.64.0.0/10", "169.254.0.0/16", "192.0.0.0/24", "192.0.2.0/24", "198.18.0.0/15",
        "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
        "::/96", "100::/64", "2001::/32", "2001:db8::/32", "5f00::/16", "fc00::/7", "fe80::/10", "ff00::/8",
    )
]
_NAT64 = ipaddress.ip_network("64:ff9b::/96")
_SIXTOFOUR = ipaddress.ip_network("2002::/16")


class FetchError(Exception):
    """Отказ с кодом для вызывающего.

    Коды: scheme, host, port, dns, address, connect, redirect, status, content_type, too_large, timeout, empty.
    """

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class FetchedPage:
    url: str
    text: str
    truncated: bool


def _public(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Публичный ли адрес. Адреса, в которые зашит IPv4 (mapped, NAT64, 6to4), проверяются по зашитому."""
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return _public(ip.ipv4_mapped)
        if ip in _NAT64:
            return _public(ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF))
        if ip in _SIXTOFOUR:
            return _public(ipaddress.IPv4Address((int(ip) >> 80) & 0xFFFFFFFF))
    return ip.is_global and not any(ip in net for net in _BLOCKED)


async def system_resolver(host: str, port: int) -> list[str]:
    infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(str(info[4][0]) for info in infos))


@dataclass(frozen=True)
class _Target:
    scheme: str
    host: str  # ASCII (punycode), без точки на конце
    port: int | None  # только явный
    path: str
    ip_literal: bool


def _parse(url: str) -> _Target:
    try:
        parts = urlsplit(url.strip())
        port = parts.port
    except ValueError as exc:
        raise FetchError("port", "Некорректный адрес сайта") from exc
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise FetchError("scheme", "Нужен адрес, начинающийся с http:// или https://")
    if parts.username is not None or parts.password is not None:
        raise FetchError("host", "Адрес с логином и паролем не принимаем")
    if port is not None and port not in ALLOWED_PORTS:
        raise FetchError("port", "Сайт на нестандартном порту читать нельзя")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host or "%" in host:
        raise FetchError("host", "В адресе нет имени сайта")
    try:
        ipaddress.ip_address(host)
        literal = True
    except ValueError:
        literal = False
    if not literal:
        if _NUMERIC_HOST.fullmatch(host) or "." not in host or host == "localhost" or host.endswith(_INTERNAL_SUFFIXES):
            raise FetchError("host", "Внутренние адреса читать нельзя")
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise FetchError("host", "Некорректное имя сайта") from exc
    path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
    return _Target(scheme, host, port, path, literal)


async def _checked_address(target: _Target, resolver: Resolver) -> str:
    """Один раз спрашиваем DNS и пускаем дальше только публичные адреса; возвращаем тот, с которым соединимся."""
    port = target.port or (443 if target.scheme == "https" else 80)
    if target.ip_literal:
        answer = [target.host]
    else:
        try:
            answer = await resolver(target.host, port)
        except OSError as exc:
            raise FetchError("dns", "Не удалось найти сайт по адресу") from exc
    if not answer:
        raise FetchError("dns", "Не удалось найти сайт по адресу")
    for raw in answer:
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError as exc:
            raise FetchError("address", "Адрес сайта не публичный") from exc
        if not _public(ip):
            raise FetchError("address", "Адрес сайта не публичный")
    return answer[0]


class _Text(HTMLParser):
    """Видимый текст: без скриптов и стилей, блоки разделены переводом строки."""

    _SKIP = {"script", "style", "noscript", "template", "svg", "iframe", "object"}
    _BLOCK = {"p", "div", "br", "li", "ul", "ol", "tr", "table", "section", "article", "header", "footer", "nav",
              "h1", "h2", "h3", "h4", "h5", "h6", "title", "form", "main", "aside", "blockquote", "pre", "hr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP:
            self._skip += 1
        elif tag in self._BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP:
            self._skip = max(0, self._skip - 1)
        elif tag in self._BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _Text()
    parser.feed(html)
    parser.close()
    text = re.sub(r"[ \t\r\f\v ]+", " ", "".join(parser.parts))
    return re.sub(r"\s*\n\s*", "\n", text).strip()


async def _read_body(response: httpx.Response) -> bytes:
    """Тело по реальным байтам. Сжатое распаковываем сами с потолком на выход: готовая распаковка httpx не ограничена."""
    declared = response.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_BYTES:
        raise FetchError("too_large", "Страница слишком большая")
    encoding = response.headers.get("content-encoding", "identity").strip().lower()
    if encoding in ("", "identity"):
        inflater = None
    elif encoding in ("gzip", "x-gzip"):
        inflater = zlib.decompressobj(31)
    elif encoding == "deflate":
        inflater = zlib.decompressobj(15)  # ponytail: только zlib-обёртка, сырой deflate редкость; br и zstd не заказываем
    else:
        raise FetchError("content_type", "Неподдерживаемое сжатие страницы")
    out = bytearray()
    try:
        async for chunk in response.aiter_raw():
            data = chunk
            while data:
                if inflater is None:
                    out += data
                    break
                part = inflater.decompress(data, MAX_BYTES + 1 - len(out))
                out += part
                if len(out) > MAX_BYTES:
                    break
                tail = inflater.unconsumed_tail
                if not part and tail == data:
                    break
                data = tail
            if len(out) > MAX_BYTES:
                raise FetchError("too_large", "Страница слишком большая")
    except zlib.error as exc:
        raise FetchError("content_type", "Страница повреждена") from exc
    return bytes(out)


def _decode(body: bytes, content_type: str) -> str:
    match = re.search(r"charset=([\w\-]+)", content_type, re.I)
    try:
        return body.decode(match.group(1) if match else "utf-8", errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


async def _fetch(url: str, resolver: Resolver, transport: httpx.AsyncBaseTransport | None, timeout: float) -> FetchedPage:
    # trust_env=False: прокси из окружения сервера не должен стать обходом проверки адреса
    async with httpx.AsyncClient(transport=transport, follow_redirects=False, trust_env=False,
                                 timeout=httpx.Timeout(timeout)) as client:
        current = url
        for hop in range(MAX_REDIRECTS + 1):
            target = _parse(current)
            ip = await _checked_address(target, resolver)
            pinned = f"{target.scheme}://{f'[{ip}]' if ':' in ip else ip}" + (f":{target.port}" if target.port else "")
            default = 443 if target.scheme == "https" else 80
            host_header = target.host + (f":{target.port}" if target.port and target.port != default else "")
            extensions = {"sni_hostname": target.host} if target.scheme == "https" and not target.ip_literal else {}
            request = client.build_request(
                "GET", pinned + target.path, extensions=extensions,
                headers={"Host": host_header, "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml",
                         "Accept-Encoding": "identity"},
            )
            response = await client.send(request, stream=True)
            try:
                if response.status_code in _REDIRECTS:
                    location = response.headers.get("location")
                    if not location or hop == MAX_REDIRECTS:
                        raise FetchError("redirect", "Слишком много переходов или переход без адреса")
                    current = urljoin(current, location)
                    continue
                if not 200 <= response.status_code < 300:
                    raise FetchError("status", f"Сайт ответил кодом {response.status_code}")
                content_type = response.headers.get("content-type", "")
                if content_type.split(";")[0].strip().lower() not in HTML_TYPES:
                    raise FetchError("content_type", "Это не веб-страница")
                text = html_to_text(_decode(await _read_body(response), content_type))
            finally:
                await response.aclose()
            if not text:
                raise FetchError("empty", "На странице нет текста")
            return FetchedPage(current, text[:MAX_TEXT], len(text) > MAX_TEXT)
    raise FetchError("redirect", "Слишком много переходов")  # недостижимо: последний переход отказывает выше


async def fetch_page(
    url: str,
    *,
    resolver: Resolver = system_resolver,
    transport: httpx.AsyncBaseTransport | None = None,
    timeout: float = TOTAL_TIMEOUT,
) -> FetchedPage:
    """Адрес → очищенный текст страницы или `FetchError`. `resolver` и `transport` подменяются только в тестах."""
    try:
        async with asyncio.timeout(timeout):
            return await _fetch(url, resolver, transport, timeout)
    except TimeoutError as exc:
        raise FetchError("timeout", "Сайт отвечает слишком долго") from exc
    except httpx.HTTPError as exc:
        raise FetchError("connect", "Не удалось открыть сайт: нет соединения или сертификат не подходит") from exc
