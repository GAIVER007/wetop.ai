"""Вход в панель: пароль, второй фактор, сессия (слой 8б).

Роутер монтируется под путём из настроек (DASHBOARD_PATH_PREFIX), а не
по /admin: автоматические переборщики ломятся в /admin круглые сутки.
⚠️ Сам по себе путь не защита — работает вместе с хешем, блокировкой
и сроком сессии.

🔴 Ответ на любую неудачу входа одинаковый (security.LOGIN_FAILED_MESSAGE):
разные ответы подсказывают, что логин угадан.
🔴 Ни секрета второго фактора, ни кода, ни резервных кодов в журнале нет.
"""

from __future__ import annotations

import asyncio
import logging

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from starlette.concurrency import run_in_threadpool

from src import dependencies
from src.config import Settings
from src.dashboard import security, twofa
from src.db.base import utcnow
from src.db.models import DashboardUser

logger = logging.getLogger(__name__)

router = APIRouter()

COOKIE_NAME = "dash_session"
# Истёкшая сессия — 401, а не пустой экран: клиент сам ведёт на форму входа.
SESSION_EXPIRED = "Сессия истекла, войдите заново"
IP_DENIED = "Доступ с этого адреса закрыт"


class LoginIn(BaseModel):
    """Лишние поля отбрасываем, а не роняем запрос."""

    model_config = ConfigDict(extra="ignore")

    email: str
    password: str


class CodeIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str


class SetupIn(BaseModel):
    """Код нужен только при ПЕРЕподключении: см. twofa_setup."""

    model_config = ConfigDict(extra="ignore")

    code: str = ""


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _client_ip(request: Request) -> str:
    """Реальный адрес соединения.

    X-Forwarded-For здесь не читаем: заголовок подделывается, и счётчик
    перебора обошли бы одной строкой. За привратником адрес подставляет
    ProxyHeadersMiddleware сервера приложений — доверие настраивается там.
    """
    return request.client.host if request.client else ""


def _token_from(request: Request) -> str:
    """Сначала cookie (браузер панели), потом Authorization: Bearer (скрипты)."""
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token
    header = request.headers.get("authorization", "")
    prefix = "bearer "
    return header[len(prefix) :].strip() if header.lower().startswith(prefix) else ""


def _issued(settings: Settings, token: str, status: str) -> JSONResponse:
    """Токен в теле и в cookie: httponly — чтобы не достал скрипт со страницы,
    samesite=lax — чтобы не уехал с чужой формы, secure — только по https."""
    response = JSONResponse(status_code=200, content={"status": status, "token": token})
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        secure=True,
        max_age=max(settings.dashboard_session_ttl_hours, 1) * 3600,
    )
    return response


async def _reject(settings: Settings, *, email: str, ip: str) -> None:
    """Общий отказ: задержка, учёт попытки, одна фраза на все причины.

    Задержка делает перебор нерентабельным ещё до блокировки. Читаем её
    через модуль, а не из локального имени: тесты подменяют значение.
    """
    await asyncio.sleep(security.FAILED_DELAY_SECONDS)
    await security.register_failure(
        dependencies.get_redis(),
        dependencies.get_sessionmaker(),
        settings,
        email=email,
        ip=ip,
    )
    raise HTTPException(status_code=401, detail=security.LOGIN_FAILED_MESSAGE)


async def _guard(request: Request, email: str) -> tuple[Settings, str]:
    """Общий вход в проверку: путь панели, адрес, блокировка."""
    settings = _settings(request)
    security.require_dashboard_path(settings)
    ip = _client_ip(request)
    if not security.check_ip_allowed(settings, ip):
        raise HTTPException(status_code=403, detail=IP_DENIED)
    if await security.is_blocked(
        dependencies.get_redis(),
        email=email,
        ip=ip,
        sessionmaker=dependencies.get_sessionmaker(),
    ):
        # Та же фраза, что и на неверный пароль: факт блокировки — тоже подсказка.
        raise HTTPException(status_code=429, detail=security.LOGIN_FAILED_MESSAGE)
    return settings, ip


async def _load_user(email: str) -> DashboardUser | None:
    async with dependencies.get_sessionmaker()() as session:
        stmt = sa.select(DashboardUser).where(DashboardUser.email == email)
        return (await session.execute(stmt)).scalar_one_or_none()


@router.post("/login")
async def login(request: Request, body: LoginIn) -> JSONResponse:
    """Пароль. Несуществующая почта и неверный пароль отвечают одинаково."""
    email = body.email.strip().lower()
    settings, ip = await _guard(request, email)

    user = await _load_user(email)
    # 🔴 bcrypt считается и тогда, когда почты нет: короткое замыкание выдало бы
    # существование учётки разницей во времени ответа (~0,2 с) при побайтно
    # одинаковом теле. 🔴 И в потоке: checkpw держит цикл событий целиком,
    # а в нём же горячий путь движка — поток входов иначе «затыкает» бота.
    stored = user.password_hash if user is not None else security.DUMMY_PASSWORD_HASH
    password_ok = await run_in_threadpool(security.verify_password, body.password, stored)
    if user is None or not password_ok:
        # 🔴 Задержка и учёт попытки — вне сессии БД: секунда с занятым
        # соединением на попытку выгребает пул, и замолкает вместе с панелью
        # бот, отвечающий клиентам.
        await _reject(settings, email=email, ip=ip)

    # 🔴 Второй фактор требуется только после подтверждения первым кодом:
    # иначе человек, не успевший отсканировать QR, теряет доступ сразу.
    need_code = bool(settings.dashboard_2fa_enabled and user.totp_confirmed_at)
    async with dependencies.get_sessionmaker()() as session:
        db_user = await session.get(DashboardUser, user.id)
        db_user.failed_logins = 0
        db_user.blocked_until = None
        if not need_code:
            db_user.last_login_at = utcnow()
        role = db_user.role
        await session.commit()

    if not need_code:
        # 🔴 Счётчики гасим, только когда сессия открыта полностью. Иначе
        # верный пароль обнуляет их перед каждой попыткой кода, и второй
        # фактор перебирается без предела: вход → неверный код → вход → …
        await security.reset_failures(dependencies.get_redis(), email=email, ip=ip)
    token = security.issue_token(settings, email=email, role=role, twofa_done=not need_code)
    return _issued(settings, token, "need_code" if need_code else "ok")


@router.post("/code")
async def submit_code(request: Request, body: CodeIn) -> JSONResponse:
    """Код из приложения-аутентификатора или резервный.

    🔴 Неудачные коды считаются вместе с неудачными паролями: иначе второй
    фактор перебирается без ограничений, пока пароль уже известен.
    """
    payload = security.read_token(_settings(request), _token_from(request))
    if payload is None:
        raise HTTPException(status_code=401, detail=SESSION_EXPIRED)
    email = str(payload.get("sub") or "")
    settings, ip = await _guard(request, email)

    # Короткая сессия: отказ с задержкой не держит соединение пула (см. login).
    user = await _load_user(email)
    if user is None or not user.totp_secret:
        await _reject(settings, email=email, ip=ip)
    check = twofa.verify_code(
        user.totp_secret,
        body.code,
        last_step=user.totp_last_step,
        drift=settings.dashboard_2fa_drift_steps,
    )
    rest: list[str] | None = None
    if not check.ok:
        rest = twofa.spend_backup_code(list(user.backup_codes or []), body.code)
        if rest is None:
            await _reject(settings, email=email, ip=ip)

    async with dependencies.get_sessionmaker()() as session:
        db_user = await session.get(DashboardUser, user.id)
        if check.ok:
            # 🔴 Шаг гасится: подсмотренный код иначе работает ещё полминуты.
            db_user.totp_last_step = check.step
        else:
            db_user.backup_codes = rest
        db_user.failed_logins = 0
        db_user.blocked_until = None
        db_user.last_login_at = utcnow()
        role = db_user.role
        await session.commit()

    await security.reset_failures(dependencies.get_redis(), email=email, ip=ip)
    return _issued(settings, security.issue_token(settings, email=email, role=role, twofa_done=True), "ok")


async def current_user(request: Request) -> DashboardUser:
    """Вошедший человек. Нет токена, истёк, чужая подпись или не пройден
    второй фактор -> 401.

    🔴 Список адресов проверяется здесь, а не только на форме входа: токен
    отдаётся в теле ответа, и выданный в офисе он иначе открывает карточки
    с телефонами клиентов из любой точки интернета.
    """
    settings = _settings(request)
    if not security.check_ip_allowed(settings, _client_ip(request)):
        raise HTTPException(status_code=403, detail=IP_DENIED)
    payload = security.read_token(_settings(request), _token_from(request))
    if payload is None or not payload.get("tfa"):
        raise HTTPException(status_code=401, detail=SESSION_EXPIRED)
    user = await _load_user(str(payload.get("sub") or ""))
    if user is None:
        # Учётку удалили, а токен на руках остался.
        raise HTTPException(status_code=401, detail=SESSION_EXPIRED)
    return user


async def require_owner(user: DashboardUser = Depends(current_user)) -> DashboardUser:
    """Владелец. Оператор видит диалоги, но не правит промпт, знания и модель."""
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Действие доступно только владельцу")
    return user


def _reconnect_allowed(user: DashboardUser, code: str, settings: Settings) -> bool:
    """Годится ли код для пересоздания уже работающего второго фактора:
    код из приложения или один из резервных."""
    if user.totp_secret and twofa.verify_code(
        user.totp_secret, code, last_step=user.totp_last_step, drift=settings.dashboard_2fa_drift_steps
    ).ok:
        return True
    return twofa.spend_backup_code(list(user.backup_codes or []), code) is not None


@router.post("/2fa/setup")
async def twofa_setup(
    request: Request, body: SetupIn | None = None, user: DashboardUser = Depends(current_user)
) -> dict:
    """Подключение второго фактора: секрет и резервные коды показываются ОДИН раз.

    🔴 totp_confirmed_at остаётся пустым: фактор включится только после
    первого верного кода. В базе — секрет и ОТПЕЧАТКИ кодов, не сами коды.

    🔴 Уже подтверждённый фактор пересоздаётся только с действующим кодом:
    иначе один запрос гасит работающий фактор и старые резервные коды,
    и учётка до утра живёт на одном пароле.
    """
    settings = _settings(request)
    if user.totp_confirmed_at:
        code = (body.code if body else "") or ""
        if not code:
            raise HTTPException(
                status_code=409,
                detail="второй фактор уже подключён: подтвердите действующим кодом",
            )
        if not _reconnect_allowed(user, code, settings):
            raise HTTPException(status_code=401, detail=security.LOGIN_FAILED_MESSAGE)
    secret = twofa.new_secret()
    codes = twofa.new_backup_codes(settings.dashboard_2fa_backup_codes)
    async with dependencies.get_sessionmaker()() as session:
        db_user = await session.get(DashboardUser, user.id)
        db_user.totp_secret = secret
        db_user.backup_codes = [twofa.hash_backup_code(code) for code in codes]
        db_user.totp_confirmed_at = None
        db_user.totp_last_step = None
        await session.commit()
    uri = twofa.provisioning_uri(secret, email=user.email, issuer=settings.dashboard_2fa_issuer or "panel")
    # 🔴 В журнал — только факт: ни секрета, ни кодов.
    logger.info("второй фактор: подключение начато, пользователь %s", user.id)
    return {"status": "ok", "secret": secret, "uri": uri, "qr": twofa.qr_svg(uri), "backup_codes": codes}


@router.post("/2fa/confirm")
async def twofa_confirm(
    request: Request, body: CodeIn, user: DashboardUser = Depends(current_user)
) -> dict:
    """Подтверждение первым верным кодом. В ответе ни секрета, ни кодов."""
    settings = _settings(request)
    async with dependencies.get_sessionmaker()() as session:
        db_user = await session.get(DashboardUser, user.id)
        if not db_user.totp_secret:
            raise HTTPException(status_code=400, detail="Второй фактор не подключён")
        check = twofa.verify_code(
            db_user.totp_secret,
            body.code,
            last_step=db_user.totp_last_step,
            drift=settings.dashboard_2fa_drift_steps,
        )
        if not check.ok:
            raise HTTPException(status_code=401, detail=security.LOGIN_FAILED_MESSAGE)
        db_user.totp_last_step = check.step
        db_user.totp_confirmed_at = utcnow()
        await session.commit()
    logger.info("второй фактор: подключение подтверждено, пользователь %s", user.id)
    return {"status": "ok"}


@router.post("/logout")
async def logout() -> JSONResponse:
    """Снимает cookie. Токен в теле клиент выбрасывает сам."""
    response = JSONResponse(status_code=200, content={"status": "ok"})
    response.delete_cookie(COOKIE_NAME)
    return response
