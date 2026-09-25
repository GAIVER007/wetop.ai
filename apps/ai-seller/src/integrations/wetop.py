"""[КЛИЕНТ] Провайдер WETOP: наличие, расчёт, бронь.

Наличие и цену продавец читает дверью котировки GET /bot/availability
(Q-166 в объёме чтения — ADR-085): узкий ключ SELLER_QUOTE_KEY, организация
в запросе, JSON — тот же, что у публичного виджета. Бронь из чата не
включена — заявка администратору до базы в РК (Q-166б, ADR-086); POST /w/book
здесь на тот день. Разбор мягкий: незнакомое тело даёт «не знаю» с пометкой
в журнал, а не выдуманное число мест и не выдуманную сумму. Сам разбор —
в wetop_parse.py, чтобы этот файл читался целиком.

🔴 В другом проекте этот файл выбрасывается целиком — ядро лежит
в providers.py. Ни адреса, ни ключа в коде нет: только из Settings.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

import httpx

from src.config import Settings
from src.integrations.providers import (
    Availability,
    Incident,
    LeadRef,
    ProviderUnavailable,
    Quote,
)
from src.integrations.wetop_parse import (
    NAME_KEYS, as_int, body_reason, categories, currency, free_units, has_error,
    parse_health, parse_incident, per_night_minor, pick, sellable, total_minor)

logger = logging.getLogger(__name__)

# Адреса помощника у платформы (ТЗ интеграции, П4) и заголовок узкого ключа:
# платформа читает служебные ключи из x-wetop-service-key (auth.guard.ts).
PATH_ERRORS = "/assistant/errors"
PATH_GUARD_STATUS = "/guard/status"
KEY_HEADER = "x-wetop-service-key"

# Дверь котировки продавца (ADR-085, подробности в шапке файла) и бронь.
PATH_AVAILABILITY = "/bot/availability"
PATH_BOOK = "/w/book"

# Порог «мест мало». Число остатка наружу не уходит — только признак.
FEW_LEFT = 2
# Пределы публичного контракта WETOP: год вперёд, 30 ночей, 500 знаков
# комментария, телефон от 10 цифр.
MAX_AHEAD_DAYS = 365
MAX_NIGHTS = 30
MAX_COMMENT_CHARS = 500
MIN_PHONE_DIGITS = 10


def _dates_problem(arrival: date, departure: date) -> str | None:
    """Проверка окна дат до запроса: незачем ходить наружу с заведомым отказом."""
    if departure <= arrival:
        return "выезд не позже заезда"
    nights = (departure - arrival).days
    if nights > MAX_NIGHTS:
        return "больше 30 ночей"
    ahead = (arrival - date.today()).days
    if ahead < 0:
        return "заезд в прошлом"
    if ahead > MAX_AHEAD_DAYS:
        return "заезд дальше года"
    return None


class WetopProviders:
    """Наличие, расчёт и бронь в WETOP. Реализует AvailabilityProvider
    и LeadSink; статусов заказов и базы клиентов у объекта нет."""

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self._base_url = settings.integration_base_url.rstrip("/")
        self._api_key = settings.integration_api_key
        self._timeout = settings.integration_timeout_seconds
        # Клиент общий на процесс: соединения дорогие, свой плодить незачем.
        self._http = http_client

    async def _request(
        self, method: str, path: str, *, params: dict | None = None, json: dict | None = None
    ) -> dict:
        """Запрос к WETOP. Любой отказ — ProviderUnavailable с коротким кодом.

        🔴 Ключ уходит заголовком, а не параметром адреса: адреса пишутся
        в журналы прокси целиком. Заголовок — тот, из которого платформа
        читает служебные ключи (x-wetop-service-key, auth.guard.ts).
        """
        headers = {KEY_HEADER: self._api_key}
        try:
            response = await self._http.request(
                method,
                f"{self._base_url}{path}",
                params=params,
                json=json,
                headers=headers,
                timeout=self._timeout,
            )
        except httpx.TimeoutException:
            logger.warning("wetop %s: отказ timeout", path)
            raise ProviderUnavailable("timeout") from None
        except Exception as exc:  # noqa: BLE001 — текст исключения несёт адрес
            logger.warning("wetop %s: отказ connection (%s)", path, type(exc).__name__)
            raise ProviderUnavailable("connection") from None

        try:
            body = response.json()
        except ValueError:
            body = None
        # Отказ по телу: код 200 с непустой ошибкой внутри — тоже отказ.
        if response.status_code >= 400 or not isinstance(body, dict):
            reason = body_reason(body, response.status_code)
            logger.warning("wetop %s: отказ %s", path, reason)
            raise ProviderUnavailable(reason)
        if has_error(body):
            reason = body_reason(body, response.status_code)
            logger.warning("wetop %s: отказ в теле %s", path, reason)
            raise ProviderUnavailable(reason)
        return body

    async def _availability(self, arrival: date, departure: date, guests: int) -> dict:
        """Остаток и сумму отдаёт один адрес, поэтому запрос общий.

        Организация — из хода (ставит движок): продавец спрашивает про СВОЮ
        гостиницу. Поле гостей у платформы зовётся adults — контракт виджета.
        """
        from src.dependencies import get_current_organization_id

        params: dict = {
            "arrival": arrival.isoformat(),
            "departure": departure.isoformat(),
            "adults": guests,
        }
        organization = get_current_organization_id()
        if organization:
            params["organization"] = organization
        return await self._request("GET", PATH_AVAILABILITY, params=params)

    async def check(
        self, arrival: date, departure: date, guests: int, category: str | None
    ) -> Availability:
        """Наличие признаком. Число свободных мест наружу не отдаётся никогда."""
        problem = _dates_problem(arrival, departure)
        if problem is not None:
            return Availability("unknown", problem)

        body = await self._availability(arrival, departure, guests)
        counts = free_units(categories(body, category))
        if not counts:
            # Связь есть, поля не узнали — честное «не знаю», а не «мест нет».
            logger.warning("wetop: в ответе о наличии не найдено поле остатка")
            return Availability("unknown", "ответ не разобран")

        free = sum(counts)
        if free <= 0:
            return Availability("no")
        if free <= FEW_LEFT:
            return Availability("few")
        return Availability("yes")

    async def quote(
        self, arrival: date, departure: date, guests: int, category: str
    ) -> Quote | None:
        """Расчёт как его вернул WETOP. 🔴 Бот сумму не считает: только берёт.

        Нет суммы в объявленных единицах или нет валюты — ответа нет:
        половина цены хуже отсутствия цены, потому что звучит как цена.
        """
        if _dates_problem(arrival, departure) is not None:
            return None

        body = await self._availability(arrival, departure, guests)
        items = categories(body, category)
        if not items:
            logger.info("wetop: категория в ответе о наличии не найдена")
            return None

        item = items[0]
        if not sellable(item):
            # Закрыта ограничением или не вмещает гостей: цена по ней —
            # обещание, которое стойка не выполнит.
            logger.info("wetop: категория закрыта или не вмещает гостей, цену не называем")
            return None
        total = total_minor(item)
        money = currency(item, body)
        if total is None or money is None:
            return None
        return Quote(
            total_minor=total,
            currency=money,
            nights=(departure - arrival).days,
            category_name=str(pick(item, NAME_KEYS) or category),
            per_night_minor=per_night_minor(item),
        )

    async def create_lead(self, natural_key: str, payload: dict) -> LeadRef:
        """Бронь в WETOP по натуральному ключу.

        🔴 Не хватило данных — отказ, а не выдуманная запись: кто не записал
        заявку, не говорит «записал». Вызывающий поднимет алерт и повторит.
        """
        extra = payload.get("extra") if isinstance(payload.get("extra"), dict) else {}
        source = {**extra, **{k: v for k, v in payload.items() if k != "extra"}}

        arrival = source.get("arrival")
        departure = source.get("departure")
        category = source.get("category")
        digits = "".join(ch for ch in str(source.get("phone") or "") if ch.isdigit())
        name = str(source.get("name") or "").strip()

        missing = [
            field
            for field, value in (
                ("arrival", arrival),
                ("departure", departure),
                ("category", category),
                ("name", name),
            )
            if not value
        ]
        if missing or len(digits) < MIN_PHONE_DIGITS:
            # В журнал имена полей, а не значения: там контакты гостя.
            logger.warning("wetop: для брони не хватает данных (%s)", ",".join(missing) or "phone")
            raise ProviderUnavailable("incomplete_payload")

        first, _, last = name.partition(" ")
        comment = f"бот, диалог {source.get('conversation_id', '-')}, ключ {natural_key}"
        body = await self._request(
            "POST",
            PATH_BOOK,
            json={
                "arrival": str(arrival),
                "departure": str(departure),
                "guests": as_int(source.get("guests")) or 1,
                "category": str(category),
                "first_name": first,
                "last_name": last.strip(),
                "phone": digits,
                "email": str(source.get("email") or ""),
                "comment": comment[:MAX_COMMENT_CHARS],
            },
        )

        # 🔴 Внешний идентификатор строкой — приводим здесь, на границе.
        raw_id = pick(body, ("id", "number", "reservation_id", "booking_number"))
        if raw_id is None:
            # Бронь могла создаться, но подтверждения нет: «записал» сказать
            # нельзя, отдаём отказ — разбирается оператор по алерту.
            logger.error("wetop: бронь без идентификатора в ответе")
            raise ProviderUnavailable("no_external_id")
        return LeadRef(external_id=str(raw_id), created=True)

    # ─── Помощник платформы (ТЗ интеграции, Б1 поверх П4) ───

    async def recent_for_user(
        self, *, user_id: str | None, org_id: str | None, since: datetime, limit: int
    ) -> list[Incident]:
        """Ошибки, которые видел этот человек. Спрашиваем только о подписанном:
        userId и organizationId обязательны и в контракте платформы."""
        if not user_id or not org_id:
            return []
        body = await self._request(
            "GET",
            PATH_ERRORS,
            params={
                "userId": user_id,
                "organizationId": org_id,
                "since": since.isoformat(),
                "limit": limit,
            },
        )
        # Обёртка «items», а не «errors»: поле errors проверка тела считает
        # признаком отказа, и каждый удачный ответ читался бы как сбой.
        items = body.get("items")
        if not isinstance(items, list):
            raise ProviderUnavailable("bad_body")
        out: list[Incident] = []
        for item in items:
            incident = parse_incident(item)
            if incident is None:
                # Кривая запись не роняет ответ: остальные ошибки человеку нужнее.
                logger.warning("wetop %s: запись без времени или текста пропущена", PATH_ERRORS)
                continue
            out.append(incident)
        return out[:limit]

    async def search(self, *, text: str, since: datetime, limit: int) -> list[Incident]:
        """Поиска по журналу у платформы нет: честно пусто, а не догадка."""
        return []

    async def status(self) -> HealthReport:
        """Состояние из сторожа платформы. 🔴 Берём только «в порядке или нет»
        и короткий список сбоев: в ответе сторожа есть адреса получателей
        оповещений, и пользователю помощника они уходить не должны."""
        return parse_health(await self._request("GET", PATH_GUARD_STATUS))

