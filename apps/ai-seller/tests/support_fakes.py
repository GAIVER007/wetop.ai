"""Подмены для роли помощника платформы: журнал происшествий, состояние
платформы, временный справочник ошибок.

Сети и сервисов здесь нет. Фейки считают вызовы и запоминают АРГУМЕНТЫ:
🔴 главное свойство этой роли — пользователь видит только свои происшествия,
а доказать это можно единственным способом — посмотреть, с каким user_id
и org_id инструмент пошёл к провайдеру.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from src.channels.widget_identity import PLATFORM_PREFIX, Visitor
from src.db.base import utcnow
from src.integrations.providers import (
    HealthReport,
    Incident,
    Providers,
    ProviderUnavailable,
)

# Вымышленные пользователь и организация: боевых данных в тестах не бывает.
USER_ID = "42"
ORG_ID = "7"
OTHER_USER_ID = "99"
USER_EMAIL = "manager@example.com"

# ─── Образец справочника ───

# Тексты взяты такими, какими их отдаёт платформа: кодов у неё нет.
SAMPLE_CATALOG = """# Справочник ошибок (тестовый образец)

## Не сохраняется бронь: «adults — целое ≥ 1»
- **Код:**
- **Раздел:** Брони
- **Что видит человек:** сообщение «adults — целое ≥ 1» при сохранении брони
- **Причина:** в поле «Гостей» пусто или ноль
- **Что делать:** укажите хотя бы одного взрослого и сохраните снова
- **Состояние:** ожидаемое поведение

## Не создаётся тариф: «categoryCodes: непустой список кодов категорий»
- **Код:**
- **Раздел:** Тарифы
- **Что видит человек:** сообщение «categoryCodes: непустой список кодов категорий»
- **Причина:** не выбрана ни одна категория размещения
- **Что делать:** отметьте хотя бы одну категорию и сохраните
- **Состояние:** ожидаемое поведение

## Отчёт за месяц открывается пустым
- **Код:** RPT-EMPTY
- **Раздел:** Отчёты
- **Что видит человек:** таблица отчёта пустая, ошибок нет
- **Причина:** известный дефект выборки за месяц с переходом через год
- **Что делать:** выгрузите отчёт по двум половинам периода, мы чиним
- **Состояние:** известный дефект
"""

# Запись без обязательных полей: разборщик обязан её пропустить, а не
# подставить пустую причину — пустая причина хуже отсутствия записи.
# Метка в содержимом нужна тесту журнала: в предупреждении её быть не должно.
CONTENT_MARKER = "СОДЕРЖИМОЕ-ЗАПИСИ-В-ЖУРНАЛ-НЕ-ИДЁТ"
BROKEN_TITLE = "Запись без причины"
BROKEN_ENTRY = f"""
## {BROKEN_TITLE}
- **Раздел:** Брони
- **Что видит человек:** {CONTENT_MARKER}
"""


def write_catalog(directory: Path, text: str = SAMPLE_CATALOG, name: str = "errors.md") -> Path:
    """Временный справочник. Возвращает путь: кэш в модуле ключуется по нему."""
    path = Path(directory) / name
    path.write_text(text, encoding="utf-8")
    return path


# ─── Посетители ───


def signed_visitor(
    *, user_id: str = USER_ID, org_id: str | None = ORG_ID, email: str = USER_EMAIL
) -> Visitor:
    """Пользователь платформы с подписанным признаком."""
    return Visitor(
        key=PLATFORM_PREFIX + user_id,
        user_id=user_id,
        email=email,
        org_id=org_id,
        role="manager",
        signed=True,
    )


def anon_visitor(key: str = "anon-1") -> Visitor:
    """Аноним: подписи нет, значит журнала платформы он не увидит."""
    return Visitor(key=key, signed=False)


# ─── Происшествия ───


def incident(
    *,
    minutes_ago: int = 5,
    kind: str = "error",
    summary: str = "не сохранилась бронь",
    section: str | None = "Брони",
    ref: str | None = None,
) -> Incident:
    """Одно происшествие. 🔴 summary — человеческая строка: ни трассировки,
    ни имён таблиц, ни чужих данных здесь нет и в бою быть не должно."""
    return Incident(
        at=utcnow() - timedelta(minutes=minutes_ago),
        kind=kind,
        summary=summary,
        section=section,
        ref=ref,
    )


@dataclass
class FakeIncidents:
    """Журнал происшествий платформы.

    items — что вернуть; raise_on — имена методов, которые изображают
    недоступность (ProviderUnavailable); calls — имя метода и его аргументы,
    по ним проверяется, что поиск шёл по СВОЕМУ пользователю.
    """

    items: list[Incident] = field(default_factory=list)
    raise_on: set[str] = field(default_factory=set)
    calls: list[tuple[str, dict]] = field(default_factory=list)

    def _record(self, name: str, arguments: dict) -> None:
        self.calls.append((name, arguments))
        if name in self.raise_on:
            raise ProviderUnavailable(f"{name}: журнал платформы недоступен")

    @property
    def names(self) -> list[str]:
        return [name for name, _ in self.calls]

    def count(self, name: str) -> int:
        return self.names.count(name)

    def args_of(self, name: str) -> list[dict]:
        return [arguments for called, arguments in self.calls if called == name]

    async def recent_for_user(
        self, *, user_id: str | None, org_id: str | None, since: datetime, limit: int
    ) -> list[Incident]:
        self._record(
            "recent_for_user",
            {"user_id": user_id, "org_id": org_id, "since": since, "limit": limit},
        )
        # Предел соблюдает настоящий провайдер (это SQL), поэтому и фейк
        # его соблюдает: иначе тест проверял бы не то, что бывает в бою.
        return list(self.items)[: int(limit)]

    async def search(self, *, text: str, since: datetime, limit: int) -> list[Incident]:
        self._record("search", {"text": text, "since": since, "limit": limit})
        return list(self.items)[: int(limit)]


@dataclass
class FakeHealth:
    """Состояние платформы. fail — изображает недоступность самой проверки."""

    ok: bool = True
    degraded: list[str] = field(default_factory=list)
    fail: bool = False
    calls: int = 0

    async def status(self) -> HealthReport:
        self.calls += 1
        if self.fail:
            raise ProviderUnavailable("проверка состояния недоступна")
        return HealthReport(ok=self.ok, degraded=list(self.degraded), checked_at=utcnow())


def support_providers(
    *, incidents: Any = None, health: Any = None, mode: str = "fake"
) -> Providers:
    """Набор провайдеров для роли помощника. Незаполненные слоты — None:
    инструмент обязан ответить «не знаю», а не поймать AttributeError."""
    return Providers(
        orders=None,
        customers=None,
        availability=None,
        leads=None,
        mode=mode,
        incidents=incidents,
        health=health,
    )


# ─── Настройки и вызов инструмента ───


def support_settings(*, catalog: Path | str | None = None, **overrides: Any):
    """Настройки для роли помощника. Справочник — из временной папки теста:
    боевой data/errors.md правит владелец, тесты на него не опираются."""
    from src.config import Settings

    if catalog is not None:
        overrides["errors_catalog_path"] = str(catalog)
    overrides.setdefault("bot_role", "support")
    return Settings(**overrides)


async def call_tool(registry: Any, name: str, **arguments: Any) -> str:
    """Вызов через диспетчер реестра — тем же путём, каким его делает модель.

    🔴 Именно так проверяется правило шага 7: инструмент отдаёт СТРОКУ-признак,
    а не исключение. Диспетчер чужое исключение проглотил бы и подменил своим
    текстом, поэтому ответы сверяются дословно.
    """
    import json

    from tests.integration_fakes import tool_call

    messages = await registry.dispatch(
        [tool_call("c1", name, json.dumps(arguments, ensure_ascii=False))]
    )
    return messages[0]["content"]


# ─── Счётчик чтений с диска ───


@pytest.fixture
def open_counter(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    """Считает открытия файлов НА ЧТЕНИЕ по пути: так проверяется кэш
    справочника. Записи самого теста не считаются."""
    import io
    import os

    counts: dict[str, int] = {}
    real_open = io.open

    def counting_open(file, *args, **kwargs):
        mode = args[0] if args else kwargs.get("mode", "r")
        if isinstance(file, (str, os.PathLike)) and "r" in mode and "+" not in mode:
            key = str(Path(file).resolve())
            counts[key] = counts.get(key, 0) + 1
        return real_open(file, *args, **kwargs)

    monkeypatch.setattr(io, "open", counting_open)
    return counts
