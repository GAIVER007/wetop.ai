"""Безопасный загрузчик сайтов гостевого мастера (ТЗ-O2a): таблица атак и один путь успеха.

Сеть не нужна: транспорт `httpx.MockTransport`, DNS подставной. Главное, что доказывают тесты, не «вернулся текст», а
**куда пошло соединение**: запрос к внутреннему адресу не должен дойти до транспорта ни при каких хитростях адреса,
редиректа и DNS.
"""

from __future__ import annotations

import asyncio
import gzip

import httpx
import pytest

from src.site.wizard_fetch import MAX_BYTES, MAX_TEXT, FetchError, fetch_page

PUBLIC = "93.184.216.34"
HTML = b"<html><head><title>Hostel</title><style>.x{}</style></head><body><script>evil()</script><p>Hello</p></body></html>"


def R(status: int = 200, *, headers: dict[str, str] | None = None, content: bytes = b"") -> httpx.Response:
    """Ответ-поток, как от настоящего транспорта: готовый `httpx.Response(content=...)` уже «прочитан»."""
    return httpx.Response(status, headers=headers, stream=httpx.ByteStream(content))


def resolver_for(mapping: dict[str, list[str]], calls: list[str] | None = None):
    async def resolve(host: str, port: int) -> list[str]:
        if calls is not None:
            calls.append(host)
        if host not in mapping:
            raise OSError("no such host")
        return mapping[host]

    return resolve


class Net:
    """Подставной транспорт: помнит, к каким адресам дошли запросы."""

    def __init__(self, handler=None):
        self.requests: list[httpx.Request] = []
        self._handler = handler or (lambda r: R(200, headers={"content-type": "text/html; charset=utf-8"}, content=HTML))

    def transport(self) -> httpx.MockTransport:
        def run(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            return self._handler(request)

        return httpx.MockTransport(run)

    @property
    def hosts(self) -> list[str]:
        return [r.url.host for r in self.requests]


async def fetch(url: str, net: Net, mapping: dict[str, list[str]] | None = None, **kw):
    return await fetch_page(
        url,
        resolver=resolver_for(mapping if mapping is not None else {"shop.example": [PUBLIC]}),
        transport=net.transport(),
        **kw,
    )


# ─── успех ───


async def test_public_page_returns_clean_text_and_connects_to_the_checked_ip():
    net = Net()
    page = await fetch("https://shop.example/menu?a=1", net)
    assert "Hello" in page.text and "Hostel" in page.text
    assert "evil" not in page.text and ".x" not in page.text
    assert page.url == "https://shop.example/menu?a=1"
    # соединение идёт на проверенный адрес, а имя уходит в Host и SNI (иначе ребайндинг)
    request = net.requests[0]
    assert request.url.host == PUBLIC
    assert request.headers["host"] == "shop.example"
    assert request.extensions.get("sni_hostname") == "shop.example"


async def test_text_is_cut_at_the_limit():
    body = b"<html><body><p>" + b"a" * (MAX_TEXT + 5000) + b"</p></body></html>"
    net = Net(lambda r: R(200, headers={"content-type": "text/html"}, content=body))
    page = await fetch("https://shop.example/", net)
    assert len(page.text) == MAX_TEXT and page.truncated is True


# ─── адреса, схемы, порты ───


@pytest.mark.parametrize(
    "url,code",
    [
        ("http://localhost/", "host"),
        ("http://localhost./", "host"),
        ("http://admin.localhost/", "host"),
        ("http://intranet/", "host"),
        ("http://router.local/", "host"),
        ("http://0x7f000001/", "host"),
        ("http://2130706433/", "host"),
        ("http://127.1/", "host"),
        ("http://0177.0.0.1/", "host"),
        ("http://127.0.0.1/", "address"),
        ("http://10.0.0.5/", "address"),
        ("http://192.168.1.1/", "address"),
        ("http://172.16.0.1/", "address"),
        ("http://100.64.0.1/", "address"),
        ("http://169.254.169.254/latest/meta-data/", "address"),
        ("http://0.0.0.0/", "address"),
        ("http://[::1]/", "address"),
        ("http://[fe80::1]/", "address"),
        ("http://[fc00::1]/", "address"),
        ("http://[::ffff:127.0.0.1]/", "address"),
        ("http://shop.example:8080/", "port"),
        ("https://shop.example:22/", "port"),
        ("ftp://shop.example/", "scheme"),
        ("file:///etc/passwd", "scheme"),
        ("javascript:alert(1)", "scheme"),
        ("//shop.example/", "scheme"),
        ("http://user:pass@shop.example/", "host"),
        ("http://evil@127.0.0.1/", "host"),
        ("", "scheme"),
    ],
)
async def test_forbidden_targets_never_reach_the_network(url: str, code: str):
    net = Net()
    with pytest.raises(FetchError) as caught:
        await fetch(url, net)
    assert caught.value.code == code
    assert net.requests == []


@pytest.mark.parametrize(
    "answer",
    [
        ["127.0.0.1"],
        ["::ffff:127.0.0.1"],
        ["64:ff9b::7f00:1"],  # NAT64 с зашитым 127.0.0.1
        ["2002:7f00:1::1"],  # 6to4 с зашитым 127.0.0.1
        ["2001:0:4136:e378:8000:63bf:80ff:fffe"],  # Teredo
        ["224.0.0.1"],
        ["fd00:ec2::254"],  # метаданные облака по IPv6
        [PUBLIC, "10.0.0.1"],  # хоть один внутренний адрес в ответе: отказ целиком
    ],
)
async def test_dns_answer_with_internal_address_is_refused(answer: list[str]):
    net = Net()
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net, {"shop.example": answer})
    assert caught.value.code == "address"
    assert net.requests == []


async def test_dns_failure_is_a_clean_error():
    net = Net()
    with pytest.raises(FetchError) as caught:
        await fetch("https://nowhere.example/", net, {})
    assert caught.value.code == "dns"


# ─── редиректы ───


async def test_redirect_to_internal_address_is_stopped_at_the_second_hop():
    net = Net(lambda r: R(302, headers={"location": "http://10.0.0.1/admin"}))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "address"
    assert net.hosts == [PUBLIC]  # внутренний адрес в транспорт не попал


async def test_redirect_to_localhost_name_is_refused():
    net = Net(lambda r: R(301, headers={"location": "http://localhost:8000/"}))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code in {"host", "port"}
    assert len(net.requests) == 1


async def test_relative_redirect_is_followed_and_checked_again():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            return R(302, headers={"location": "/menu"})
        return R(200, headers={"content-type": "text/html"}, content=HTML)

    net = Net(handler)
    page = await fetch("https://shop.example/", net)
    assert page.url == "https://shop.example/menu" and len(net.requests) == 2


async def test_more_than_three_redirects_is_refused():
    net = Net(lambda r: R(302, headers={"location": "https://shop.example/next"}))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "redirect"
    assert len(net.requests) == 4  # первый запрос и три перехода


async def test_redirect_without_location_is_refused():
    net = Net(lambda r: R(302))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "redirect"


# ─── DNS-ребайндинг ───


async def test_second_resolution_returning_loopback_changes_nothing():
    """Домен отдаёт публичный адрес на первый вопрос и 127.0.0.1 на второй: загрузчик спрашивает один раз на переход
    и соединяется ровно с тем, что проверил."""
    answers = iter([[PUBLIC], ["127.0.0.1"], ["127.0.0.1"]])
    asked: list[str] = []

    async def resolve(host: str, port: int) -> list[str]:
        asked.append(host)
        return next(answers)

    net = Net()
    page = await fetch_page("https://shop.example/", resolver=resolve, transport=net.transport())
    assert page.text
    assert asked == ["shop.example"]
    assert net.hosts == [PUBLIC]


async def test_rebinding_on_a_redirect_hop_is_caught_by_the_new_check():
    answers = {"a.example": [PUBLIC], "b.example": ["127.0.0.1"]}
    net = Net(lambda r: R(302, headers={"location": "https://b.example/"}))
    with pytest.raises(FetchError) as caught:
        await fetch("https://a.example/", net, answers)
    assert caught.value.code == "address"
    assert net.hosts == [PUBLIC]


# ─── размер, тип, статус, время ───


async def test_body_over_limit_is_cut_without_trusting_content_length():
    body = b"x" * (MAX_BYTES + 3 * 65536)  # заголовка длины нет: режем по фактическим байтам
    net = Net(lambda r: R(200, headers={"content-type": "text/html"}, content=body))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "too_large"


async def test_declared_huge_length_is_refused_early():
    net = Net(lambda r: R(200, headers={"content-type": "text/html", "content-length": str(MAX_BYTES * 5)}, content=b"x"))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "too_large"


async def test_compressed_bomb_is_counted_after_decompression():
    bomb = gzip.compress(b"x" * (MAX_BYTES + 100_000))
    assert len(bomb) < 20_000  # на проводе мелочь, распакованным больше предела
    net = Net(lambda r: R(200, headers={"content-type": "text/html", "content-encoding": "gzip"}, content=bomb))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "too_large"


@pytest.mark.parametrize("ctype", ["application/pdf", "image/png", "application/json", "text/plain", ""])
async def test_only_html_is_accepted(ctype: str):
    headers = {"content-type": ctype} if ctype else {}
    net = Net(lambda r: R(200, headers=headers, content=b"%PDF-1.7"))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "content_type"


async def test_xhtml_content_type_is_accepted():
    net = Net(lambda r: R(200, headers={"content-type": "application/xhtml+xml"}, content=HTML))
    assert (await fetch("https://shop.example/", net)).text


@pytest.mark.parametrize("status", [403, 404, 500])
async def test_error_status_is_refused(status: int):
    net = Net(lambda r: R(status, headers={"content-type": "text/html"}, content=HTML))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "status"


async def test_slow_server_hits_the_total_deadline():
    class Slow(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
            await asyncio.sleep(2)
            return R(200, headers={"content-type": "text/html"}, content=HTML)

    with pytest.raises(FetchError) as caught:
        await fetch_page("https://shop.example/", resolver=resolver_for({"shop.example": [PUBLIC]}), transport=Slow(), timeout=0.2)
    assert caught.value.code == "timeout"


async def test_page_without_text_is_a_clean_error():
    net = Net(lambda r: R(200, headers={"content-type": "text/html"}, content=b"<html><script>x()</script></html>"))
    with pytest.raises(FetchError) as caught:
        await fetch("https://shop.example/", net)
    assert caught.value.code == "empty"


async def test_connection_or_tls_failure_is_its_own_code():
    """Просроченный сертификат и обрыв соединения: отказ «connect», а не «dns» (нашлось живой проверкой)."""

    class Broken(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("certificate verify failed")

    with pytest.raises(FetchError) as caught:
        await fetch_page("https://shop.example/", resolver=resolver_for({"shop.example": [PUBLIC]}), transport=Broken())
    assert caught.value.code == "connect"
