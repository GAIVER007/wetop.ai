"""Отчёт о расходе модели по гостиницам за месяц (plans/seller-cost-controls-2026-09-26.md, п. 3).

Запуск на сервере, в контейнере продавца:
    docker compose exec app python -m src.jobs.usage_report --month 2026-09

По каждой гостинице: диалоги и ответы бота за месяц, токены — всего, вход,
из него кэш, выход — и оценка стоимости по ценам LLM_PRICES. Зачем: цена
ИИ-продавца строится от расхода гостиницы за месяц (ментор 26.09).

Чего в отчёте нет и почему:
- помощника платформы (диалоги без организации) — он не продавец гостиницы;
- реплик гостя и сотрудника — модель их не порождала;
- текста переписки, имён, телефонов, id гостей — отчёт уходит людям
  и в таблицы, персональные данные ему не нужны.

Месяц — по времени Казахстана (UTC+5), как сутки дневного предела.
Ответы до обновления продавца (миграция 0005) несут только сумму токенов:
в «Токенов» они входят, в стоимость — нет, и отчёт называет их число.

🔴 Отчёт читает все гостиницы разом: запускать под тем пользователем базы,
которым ходит продавец (владелец таблиц). Под непривилегированным
пользователем политики RLS оставят только строки без организации.
Это разовая команда, а не фоновая задача monitor: в default_jobs её нет.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
import uuid
from dataclasses import dataclass, field

import sqlalchemy as sa

from src.ai.budget import LOCAL_TZ, local_month_bounds
from src.config import get_settings
from src.db.base import MessageRole, utcnow
from src.db.models import Conversation, Message, Organization, OrganizationLlmKey
from src.dependencies import close_resources, get_sessionmaker

_MONTH_RE = re.compile(r"^(\d{4})-(\d{2})$")
_PER_TOKENS = 1_000_000  # цены в LLM_PRICES — за миллион токенов


@dataclass(frozen=True)
class ModelPrice:
    """Цена модели за 1 млн токенов: вход без кэша, кэшированный вход, выход."""

    input: float
    cached: float
    output: float


def parse_prices(text: str) -> tuple[dict[str, ModelPrice], list[str]]:
    """LLM_PRICES -> (цены по модели, неразобранные записи).

    Неразобранная запись не роняет отчёт, а называется в нём: молча
    выброшенная цена превратила бы стоимость в неполную без объяснения.
    """
    prices: dict[str, ModelPrice] = {}
    errors: list[str] = []
    for entry in (e.strip() for e in (text or "").split(",")):
        if not entry:
            continue
        name, sep, values = entry.partition("=")
        parts = values.split("/")
        try:
            if not sep or not name.strip() or len(parts) != 3:
                raise ValueError(entry)
            price = ModelPrice(*(float(p) for p in parts))
            if min(price.input, price.cached, price.output) < 0:
                raise ValueError(entry)
        except ValueError:
            errors.append(entry)
            continue
        prices[name.strip()] = price
    return prices, errors


def parse_month(text: str) -> tuple[int, int]:
    """«ГГГГ-ММ» -> (год, месяц)."""
    match = _MONTH_RE.match(text.strip())
    if not match or not 1 <= int(match.group(2)) <= 12:
        raise ValueError(f"месяц нужен в виде ГГГГ-ММ, получено {text!r}")
    return int(match.group(1)), int(match.group(2))


@dataclass
class OrgUsage:
    """Строка отчёта: одна гостиница (или итог)."""

    organization_id: uuid.UUID | None
    name: str
    own_key: bool = False
    conversations: int = 0
    replies: int = 0
    tokens: int = 0
    input: int = 0
    cached: int = 0
    cached_known: bool = False  # хоть один ответ сообщил кэшированную часть
    output: int = 0
    unsplit_replies: int = 0  # ответы с суммой токенов, но без разбивки
    cost: float | None = None
    cost_partial: bool = False  # часть токенов оценить нечем

    def absorb(self, other: OrgUsage) -> None:
        for name in ("conversations", "replies", "tokens", "input", "cached", "output", "unsplit_replies"):
            setattr(self, name, getattr(self, name) + getattr(other, name))
        self.cached_known = self.cached_known or other.cached_known
        if other.cost is not None:
            self.cost = (self.cost or 0.0) + other.cost
        self.cost_partial = self.cost_partial or other.cost_partial


@dataclass
class UsageReport:
    year: int
    month: int
    rows: list[OrgUsage]
    total: OrgUsage
    unpriced_models: set[str] = field(default_factory=set)
    priced: bool = False  # цены вообще заданы


async def collect(session, *, month: tuple[int, int], prices: dict[str, ModelPrice]) -> UsageReport:
    """Расход за местный месяц по гостиницам. Считает база: сумма и счёт —
    в SQL, в код приходят только итоги по гостинице и модели."""
    year, mon = month
    start, end = local_month_bounds(year, mon)
    bot_replies = (
        Conversation.organization_id.is_not(None),
        Message.role == MessageRole.ASSISTANT,
        Message.created_at >= start,
        Message.created_at < end,
    )
    unsplit = sa.case((sa.and_(Message.tokens_input.is_(None), Message.tokens_used.is_not(None)), 1), else_=0)
    per_model = (
        sa.select(
            Conversation.organization_id,
            Message.llm_model,
            sa.func.count(Message.id),
            sa.func.sum(Message.tokens_used),
            sa.func.sum(Message.tokens_input),
            sa.func.sum(Message.tokens_cached),
            sa.func.count(Message.tokens_cached),
            sa.func.sum(Message.tokens_output),
            sa.func.sum(unsplit),
        )
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(*bot_replies)
        .group_by(Conversation.organization_id, Message.llm_model)
    )
    conversations = (
        sa.select(Conversation.organization_id, sa.func.count(sa.distinct(Message.conversation_id)))
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(*bot_replies)
        .group_by(Conversation.organization_id)
    )
    names = dict((await session.execute(sa.select(Organization.id, Organization.name))).all())
    own_keys = set((await session.execute(sa.select(OrganizationLlmKey.organization_id))).scalars())

    rows: dict[uuid.UUID, OrgUsage] = {}
    unpriced: set[str] = set()
    for org, model, replies, tokens, inp, cached, cached_rows, out, unsplit_n in (
        await session.execute(per_model)
    ).all():
        row = rows.setdefault(org, OrgUsage(org, names.get(org, "—"), own_key=org in own_keys))
        tokens, inp, cached, out = int(tokens or 0), int(inp or 0), int(cached or 0), int(out or 0)
        row.replies += int(replies)
        row.tokens += tokens
        row.input += inp
        row.cached += cached
        row.cached_known = row.cached_known or cached_rows > 0
        row.output += out
        row.unsplit_replies += int(unsplit_n or 0)
        price = prices.get(model) if model else None
        if price is not None and inp + out > 0:
            row.cost = (row.cost or 0.0) + (
                (inp - cached) * price.input + cached * price.cached + out * price.output
            ) / _PER_TOKENS
        if model and price is None and tokens > 0:
            unpriced.add(model)
        if tokens > 0 and (price is None or unsplit_n):
            row.cost_partial = True
    for org, count in (await session.execute(conversations)).all():
        if org in rows:
            rows[org].conversations = int(count)

    ordered = sorted(rows.values(), key=lambda r: (-r.tokens, r.name))
    total = OrgUsage(None, "Итого")
    for row in ordered:
        total.absorb(row)
    return UsageReport(year, mon, ordered, total, unpriced_models=unpriced, priced=bool(prices))


# ─── Печать ───


def _n(value: int) -> str:
    return f"{value:,}".replace(",", " ")


def _cost(row: OrgUsage) -> str:
    if row.cost is None:
        return "—"
    text = "<0.01" if 0 < row.cost < 0.005 else f"{row.cost:.2f}"
    return text + ("*" if row.cost_partial else "")


def _cached(row: OrgUsage) -> str:
    if not row.cached_known:
        return "—"
    share = f" ({round(100 * row.cached / row.input)}%)" if row.input else ""
    return _n(row.cached) + share


def _cells(row: OrgUsage) -> list[str]:
    if row.organization_id is None:
        hotel, key = row.name, ""
    else:
        hotel, key = f"{row.name[:28]} ({str(row.organization_id)[:8]})", "свой" if row.own_key else "платформы"
    return [hotel, key, _n(row.conversations), _n(row.replies), _n(row.tokens), _n(row.input),
            _cached(row), _n(row.output), _cost(row)]


_HEAD = ["Гостиница", "Ключ сейчас", "Диалогов", "Ответов", "Токенов", "Вход", "Из него кэш", "Выход", "Стоимость"]


def render(report: UsageReport, *, price_errors: list[str] | None = None) -> str:
    """Таблица и сноски. Только цифры и названия гостиниц — ни слова из переписки."""
    lines = [f"Расход модели ИИ-продавца за {report.year}-{report.month:02d} (месяц по времени Казахстана, UTC+5)", ""]
    if not report.rows:
        lines.append("Ответов бота гостиницам за этот месяц нет.")
    else:
        table = [_HEAD, *(_cells(r) for r in report.rows), _cells(report.total)]
        widths = [max(len(line[i]) for line in table) for i in range(len(_HEAD))]

        def fmt(cells: list[str]) -> str:
            return "  ".join(c.ljust(w) if i < 2 else c.rjust(w) for i, (c, w) in enumerate(zip(cells, widths)))

        lines += [fmt(table[0]), *(fmt(c) for c in table[1:-1]), "-" * len(fmt(table[0])), fmt(table[-1])]
    lines.append("")
    if report.priced:
        lines.append("Стоимость — по ценам LLM_PRICES за 1 млн токенов: вход без кэша, кэш и выход — каждый по своей "
                     "цене, в валюте этих цен. «*» — стоимость неполная, причина ниже.")
    else:
        lines.append("LLM_PRICES пуст — стоимость не считалась, только токены.")
    if report.priced and report.unpriced_models:
        lines.append(f"Нет цены в LLM_PRICES: {', '.join(sorted(report.unpriced_models))} — "
                     "их токены в стоимость не вошли.")
    if price_errors:
        lines.append(f"Не разобраны записи LLM_PRICES: {', '.join(price_errors)} — нужен вид модель=вход/кэш/выход.")
    if report.total.unsplit_replies:
        lines.append(f"Ответов без разбивки (до обновления продавца): {_n(report.total.unsplit_replies)} — "
                     "в «Токенов» вошли, в стоимость нет.")
    lines.append("«Ключ сейчас: свой» — гостиница платит модели своим ключом (окно «Модель»); признак на сегодня, "
                 "а не на весь месяц. Помощник платформы в отчёт не входит.")
    return "\n".join(lines)


# ─── Команда ───


def _month_arg(text: str) -> tuple[int, int]:
    try:
        return parse_month(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


async def _report_text(month: tuple[int, int], prices: dict[str, ModelPrice], errors: list[str]) -> str:
    try:
        async with get_sessionmaker()() as session:
            report = await collect(session, month=month, prices=prices)
    finally:
        await close_resources()
    return render(report, price_errors=errors)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m src.jobs.usage_report", description="Расход модели ИИ-продавца по гостиницам за месяц"
    )
    parser.add_argument("--month", type=_month_arg, default=None,
                        help="месяц ГГГГ-ММ; по умолчанию текущий по времени Казахстана")
    args = parser.parse_args(argv)
    now = utcnow().astimezone(LOCAL_TZ)
    month = args.month or (now.year, now.month)
    prices, errors = parse_prices(get_settings().llm_prices)
    print(asyncio.run(_report_text(month, prices, errors)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
