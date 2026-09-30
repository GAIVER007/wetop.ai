"""Канал «виджет на сайте платформы»: приём, долгий опрос, вложения.

Канал ничего не знает о движке: превращает запрос браузера в IncomingMessage
и отдаёт Engine. Отправитель, фоновые ходы и боевая сборка — в widget_runner,
работа с базой — в widget_store, проверки входа — в widget_guards; здесь
только двери наружу. Открыты они без входа, но только с доменов платформы
(Origin и CORS) и под IpBlockMiddleware, которому префикс '/widget' отдан.

🔴 Канал с ВЫТЯГИВАНИЕМ: браузер сам спрашивает новые сообщения, и очередь
исходящих ему не нужна — сообщение доставлено ровно тогда, когда записано
в историю и видно опросом. Это единственное осознанное отступление от
правила «исходящие через outbox»: outbox сторожит доставку наружу, а наружу
здесь ничего не уходит.

🔴 На приём отвечаем сразу, ход идёт фоновой задачей: ход с каскадом моделей
длится до минуты, браузер столько не ждёт. Ответ он узнает следующим опросом.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from starlette.concurrency import run_in_threadpool
# UploadFile берётся у starlette, а не у fastapi: разбор формы кладёт
# в неё именно starlette-объект, и проверка на класс fastapi его не узнаёт.
from starlette.datastructures import UploadFile

from src import dependencies
from src.ai.engine_types import IncomingMessage
from src.channels.consent_gate import consent_required, consent_screen, grant_consent
from src.channels.widget_guards import (
    KEY_RE,
    WidgetCorsMiddleware,
    as_str,
    client_ip,
    origin_allowed,
    RateLimitUnavailable,
    rate_exceeded,
    read_json,
    require_agent,
    settings_of,
    sniff_type,
    visitor_from,
)
from src.channels.widget_identity import current_visitor, key_tail
from src.channels.widget_runner import WidgetRunner, WidgetSender, build_runner, get_runner
from src.channels.widget_store import (
    CHANNEL,
    conversation_for_key,
    ensure_conversation,
    load_messages,
    new_flag_key,
)
from src.db.base import utcnow

logger = logging.getLogger(__name__)

# Снаружи канал — один модуль: отправитель, сборка и проверки входа
# переэкспортируются.
__all__ = ["CHANNEL", "PREFIX", "WidgetCorsMiddleware", "WidgetRunner", "WidgetSender",
           "build_runner", "get_runner", "origin_allowed", "router", "sniff_type"]

PREFIX = "/widget"

# Признак пользователя платформы ходит заголовком, а не в адресе:
# адреса пишут в журналы привратника, а там персональным данным не место.
IDENTITY_HEADER = "X-Widget-Identity"
# Ключ посетителя — тоже заголовком: у анонима он единственный пропуск
# к переписке, у пользователя платформы в нём user_id.
VISITOR_HEADER = "X-Widget-Visitor"
POLL_STEP_SECONDS = 0.5
# Раз в столько секунд опрос всё равно заглядывает в базу: отметка могла
# не дойти (сбой Redis), а молчать из-за этого нельзя.
POLL_DB_EVERY_SECONDS = 5.0
# Запас на заголовки multipart поверх самого файла.
FORM_OVERHEAD_BYTES = 8 * 1024
WIDGET_JS_PATH = Path(__file__).resolve().parent.parent / "site" / "widget.js"
DEMO_PAGE_PATH = WIDGET_JS_PATH.parent / "demo.html"

router = APIRouter(prefix=PREFIX)


def _read_site_file(path: Path) -> str:
    """Файл виджета с диска. Не прочитан — 500 и запись в журнал: клиенту
    текста ошибки не показываем."""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        logger.exception("widget: файл %s не прочитан", path.name)
        raise HTTPException(status_code=500, detail="error") from None


@router.get("/widget.js")
async def widget_script() -> Response:
    """Скрипт виджета. Кэш на час: он меняется с выкаткой, не чаще.
    Настройки в нём не зашиты — срок жизни ключа приходит ответом /session,
    поэтому один и тот же файл годится всем и кэшируется публично."""
    return Response(content=_read_site_file(WIDGET_JS_PATH), media_type="application/javascript",
                    headers={"Cache-Control": "public, max-age=3600"})


@router.get("/demo")
async def demo_page() -> HTMLResponse:
    """Виджет на адресе самого бота: проверить, не вставляя на сайт."""
    return HTMLResponse(content=_read_site_file(DEMO_PAGE_PATH),
                        headers={"X-Robots-Tag": "noindex, nofollow"})


@router.post("/session")
async def open_session(request: Request) -> Response:
    """Начало разговора: ключ посетителя, его диалог и признак пользователя.
    У продавца дверь открывает ключ АГЕНТА из тега (SA2.5, require_agent)."""
    agent = await require_agent(request)
    settings = settings_of(request)
    data = await read_json(request, settings.widget_max_body_bytes)
    visitor = visitor_from(settings, data.get("identity"), data.get("visitor_key"), allow_new=True)
    # 🔴 Предел и на выдачу ключей: без него цикл «сессия → одно сообщение»
    # обходит предел сообщений, а каждая сессия — это строки в базе.
    if await rate_exceeded(settings, "session", client_ip(request)):
        return JSONResponse(status_code=429, content={"status": "too_many"})
    async with dependencies.get_sessionmaker()() as session:
        conversation = await ensure_conversation(
            session, visitor, agent
        )
        needs_consent = await consent_required(session, settings, conversation.client_id)
    # 🔴 Ни токена, ни почты: только признак и хвост ключа.
    logger.info("widget: сессия, %s, ключ …%s",
                "подписан" if visitor.signed else "аноним", key_tail(visitor.key))
    return JSONResponse(content={
        "visitor_key": visitor.key, "signed": visitor.signed,
        "display_name": visitor.display_name,
        # Срок жизни ключа в браузере задаёт настройка, а не константа
        # в скрипте: иначе правка в окружении ничего не меняет.
        "session_ttl_hours": settings.widget_session_ttl_hours,
        "consent_required": needs_consent,
    })


@router.post("/consent")
async def accept_consent(request: Request) -> Response:
    """Кнопка «Согласен» (слой 0б).

    🔴 Без этой двери гейт согласия — тупик: движок показывает экран на
    каждое сообщение, а записать согласие нечем, и бот не отвечает никогда.
    Кнопку рисовал удалённый канал; здесь её место.
    """
    agent = await require_agent(request)
    settings = settings_of(request)
    data = await read_json(request, settings.widget_max_body_bytes)
    visitor = visitor_from(settings, data.get("identity"), data.get("visitor_key"), allow_new=False)
    if await rate_exceeded(settings, "consent", visitor.key, client_ip(request)):
        return JSONResponse(status_code=429, content={"status": "too_many"})
    # Доказательством идёт дословно тот текст, который видел человек.
    shown = consent_screen(settings).text
    async with dependencies.get_sessionmaker()() as session:
        conversation = await ensure_conversation(
            session, visitor, agent
        )
        await grant_consent(session, settings, conversation.client_id,
                            method=CHANNEL, shown_text=shown)
    return JSONResponse(content={"status": "ok"})


@router.post("/message")
async def post_message(request: Request) -> Response:
    """Приём реплики. Ответ отдаётся сразу, ход идёт фоном."""
    agent = await require_agent(request)
    settings = settings_of(request)
    data = await read_json(request, settings.widget_max_body_bytes)
    visitor = visitor_from(settings, data.get("identity"), data.get("visitor_key"), allow_new=False)
    text = as_str(data.get("text"))
    if not text:
        raise HTTPException(status_code=400, detail="bad_request")
    if len(text) > settings.widget_max_message_chars:
        # Как и переросток тела: 413 до хода, реплика в историю не ложится.
        return JSONResponse(status_code=413, content={"status": "too_long"})
    attachment = as_str(data.get("attachment_id"))
    if attachment and KEY_RE.match(attachment):
        # Картинку модель на этом шаге не смотрит: ссылка нужна оператору,
        # разбор снимков делается отдельно.
        text = f"{text}\n[вложение: {attachment}]"
    try:
        exceeded = await rate_exceeded(settings, "message", visitor.key, client_ip(request), fail_closed=True)
    except RateLimitUnavailable:
        # Счётчика нет — хода к модели тоже нет: браузер повторит позже (решение владельца 30.09.2026).
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    if exceeded:
        # Тело нейтральное: пределов и причин чужому не объясняем.
        return JSONResponse(status_code=429, content={"status": "too_many"})
    incoming = IncomingMessage(
        channel=CHANNEL, external_id=visitor.key, text=text, received_at=utcnow(),
        client_name=visitor.display_name, ip=client_ip(request) or None,
        organization_id=str(agent.organization_id) if agent is not None else None,
        agent_id=str(agent.id) if agent is not None else None,
    )
    # 🔴 Кто спрашивает — знает канал, а не движок. Ставим до submit:
    # create_task копирует контекст, и инструменты помощника увидят именно
    # этого посетителя. Снимается значение после хода, в runner.
    current_visitor.set(visitor)
    if get_runner(request.app).submit(incoming) is None:
        # Ходов уже столько, сколько процесс тянет. Честный отказ: браузер
        # повторит, а молча потерять реплику клиента нельзя.
        return JSONResponse(status_code=429, content={"status": "too_many"})
    return JSONResponse(status_code=200, content={"status": "accepted"})


async def _wait_for_flag(key: str, deadline: float) -> None:
    """Спим короткими шагами: будит отметка из WidgetSender, но не дольше
    POLL_DB_EVERY_SECONDS — отметка могла не дойти, а молчать из-за сбоя
    Redis нельзя.

    🔴 Сбой Redis не возвращает нас в базу немедленно: иначе каждый висящий
    опрос ходил бы в неё раз в полсекунды вместо пяти, и нагрузка вырастала
    бы в десять раз ровно в тот момент, когда один узел уже упал.
    """
    stop = min(deadline, time.monotonic() + POLL_DB_EVERY_SECONDS)
    alive = True
    while time.monotonic() < stop:
        await asyncio.sleep(POLL_STEP_SECONDS)
        if not alive:
            continue  # досыпаем окно: в базу вернёмся по расписанию
        try:
            if await dependencies.get_redis().delete(new_flag_key(key)):
                return
        except Exception:  # noqa: BLE001 — любой сбой Redis
            alive = False


def _visitor_key(request: Request) -> str:
    """Ключ посетителя для опроса и вложения — из заголовка.

    🔴 Переходный период: widget.js до 26.09.2026 клал ключ в адрес, а вкладка
    платформы держит старый скрипт до перезагрузки. Такой вход принимаем,
    но пишем в журнал — без самого ключа. Двое суток этой строки в журнале
    нет — приём из адреса убрать вместе с тестом
    test_a_key_in_the_url_still_works_but_is_logged.
    """
    key = request.headers.get(VISITOR_HEADER, "")
    if key:
        return key
    legacy = request.query_params.get("visitor_key", "")
    if legacy:
        logger.warning("widget: ключ посетителя пришёл в адресе — старый widget.js")
    return legacy


@router.get("/messages")
async def poll_messages(request: Request, after: str = "") -> dict:
    """Долгий опрос: держим запрос до нового сообщения или до предела времени.
    Пустой список по таймауту — не ошибка, браузер спросит снова.

    🔴 Ключ проходит ту же проверку, что и на приёме: читать чужое нельзя
    там, где писать уже нельзя, а ключ пользователя платформы предсказуем.

    🔴 Признак пользователя и ключ посетителя приходят заголовками
    X-Widget-Identity и X-Widget-Visitor, а не параметрами адреса: в признаке
    идентификатор и почта, ключ анонима — пропуск к переписке, а адреса
    целиком оседают в журналах привратника, в истории браузера и в Referer.
    """
    agent = await require_agent(request)
    settings = settings_of(request)
    identity = request.headers.get(IDENTITY_HEADER, "")
    visitor = visitor_from(settings, identity, _visitor_key(request), allow_new=False)
    deadline = time.monotonic() + max(0, settings.widget_poll_timeout_seconds)
    while True:
        messages, mode = await load_messages(
            dependencies.get_sessionmaker(), visitor.key, as_str(after),
            agent,
        )
        if messages or time.monotonic() >= deadline:
            return {"messages": messages, "mode": mode}
        await _wait_for_flag(visitor.key, deadline)


@router.post("/attachment")
async def upload_attachment(request: Request) -> Response:
    """Снимок экрана от посетителя. Имя файла из запроса не используется.

    Признак пользователя и ключ посетителя — заголовками, как и на опросе:
    в адресе им не место.
    """
    agent = await require_agent(request)
    settings = settings_of(request)
    if not settings.widget_attachments_enabled:
        # Выключено — двери нет: лишний маршрут не объявляем даже отказом.
        raise HTTPException(status_code=404, detail="not_found")
    identity = request.headers.get(IDENTITY_HEADER, "")
    visitor = visitor_from(settings, identity, _visitor_key(request), allow_new=False)
    max_bytes = settings.widget_attachment_max_mb * 1024 * 1024
    declared = request.headers.get("content-length", "")
    # 🔴 Предел ДО чтения. Без внятного Content-Length разбирать нечего:
    # multipart кладёт файловую часть в SpooledTemporaryFile без предела,
    # и после первого мегабайта она уже на диске, а дверь публичная.
    if not declared.isdigit():
        raise HTTPException(status_code=411, detail="length_required")
    if int(declared) > max_bytes + FORM_OVERHEAD_BYTES:
        raise HTTPException(status_code=413, detail="too_large")
    if await rate_exceeded(settings, "attach", visitor.key, client_ip(request)):
        return JSONResponse(status_code=429, content={"status": "too_many"})
    # Диск открыт только знакомому посетителю: у незнакомого нет диалога,
    # а значит и снимок класть не к чему.
    async with dependencies.get_sessionmaker()() as session:
        if await conversation_for_key(
            session, visitor.key, agent
        ) is None:
            raise HTTPException(status_code=403, detail="forbidden")
    allowed = settings.widget_attachment_types_list
    async with request.form() as form:
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise HTTPException(status_code=400, detail="bad_request")
        if upload.size is not None and upload.size > max_bytes:
            raise HTTPException(status_code=413, detail="too_large")
        if (upload.content_type or "").split(";")[0].strip() not in allowed:
            raise HTTPException(status_code=415, detail="unsupported")
        data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="too_large")
    if sniff_type(data) not in allowed:
        raise HTTPException(status_code=415, detail="unsupported")
    attachment_id = secrets.token_hex(16)
    root = Path(settings.widget_attachment_dir)
    # У продавца — подпапка гостиницы: её доля считается отдельно (ревизия 26.09).
    # Имя — UUID организации из двери, а не что-то из запроса.
    org_folder = str(agent.organization_id) if agent is not None else None
    directory = root / org_folder if org_folder else root
    room = await run_in_threadpool(
        _make_room,
        root,
        settings.widget_attachment_dir_max_mb * 1024 * 1024,
        settings.widget_attachment_keep_days,
        len(data),
        org_folder=org_folder,
        org_max_bytes=settings.widget_attachment_org_max_mb * 1024 * 1024,
    )
    if not room:
        logger.warning("widget: папка вложений полна, снимок не принят")
        raise HTTPException(status_code=507, detail="storage_full")
    try:
        await run_in_threadpool(directory.mkdir, parents=True, exist_ok=True)
        # 🔴 Имя и расширение из запроса не берём: в них приезжает '../'.
        await run_in_threadpool((directory / attachment_id).write_bytes, data)
    except OSError:
        logger.exception("widget: вложение не сохранено")
        raise HTTPException(status_code=500, detail="error") from None
    return JSONResponse(content={"attachment_id": attachment_id})


def _make_room(
    directory: Path,
    max_bytes: int,
    keep_days: int,
    incoming: int,
    *,
    org_folder: str | None = None,
    org_max_bytes: int = 0,
) -> bool:
    """Место под новое вложение: старше срока — удаляются, остальное считается.

    🔴 Папка на том же диске, что база; файлы никто не удалял, и с одного адреса
    набегало ~7 ГБ в сутки (аудит 26.09, С-62). Сверх предела — отказ, а не
    заполненный диск у платформы.

    Предел папки общий на всех, поэтому у продавца у каждой гостиницы ещё и своя
    доля в подпапке org_folder: посетители одной гостиницы упираются в её долю,
    а не забивают папку остальным (ревизия 26.09). org_max_bytes <= 0 — без доли.
    """
    if not directory.exists():
        within_share = org_folder is None or org_max_bytes <= 0 or incoming <= org_max_bytes
        return incoming <= max_bytes and within_share
    cutoff = time.time() - keep_days * 86_400
    total = 0
    share = 0
    for path in directory.iterdir():
        try:
            if path.is_dir():
                size = sum(_live_size(inner, cutoff) for inner in path.iterdir())
                total += size
                if path.name == org_folder:
                    share = size
            else:
                total += _live_size(path, cutoff)
        except OSError:
            continue
    if org_folder is not None and org_max_bytes > 0 and share + incoming > org_max_bytes:
        return False
    return total + incoming <= max_bytes


def _live_size(path: Path, cutoff: float) -> int:
    """Размер файла; старше срока — удаляется и не считается. Не файл — ноль."""
    try:
        info = path.stat()
        if not path.is_file():
            return 0
        if info.st_mtime < cutoff:
            path.unlink(missing_ok=True)
            return 0
        return info.st_size
    except OSError:
        return 0
