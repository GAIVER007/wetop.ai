"""Журнал звонков: файл JSONL на смонтированном томе.

Внешнее событие (AGENTS.md §11) получает внешний ID, время получения (UTC,
ставит приложение), состояние и ошибку. Запись идемпотентна по
(call_id, состояние, ключ). Журнал не должен ронять звонок: отказ записи
возвращает False и уходит в лог, клиенту ничего не показывается.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from collections.abc import Callable
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from voice.numbers import Route
from voice.phone import mask_phone

logger = logging.getLogger(__name__)


class CallState(str, Enum):
    RECEIVED = "RECEIVED"
    ANSWERED = "ANSWERED"
    CALLBACK = "CALLBACK"
    TRANSFER = "TRANSFER"
    ENDED = "ENDED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


def _digest(key: str) -> str:
    """Ключ повтора хранится хэшем: телефон целиком в файл не попадает."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16] if key else ""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def append_private(path: Path, row: dict) -> None:
    """Дописать строку JSONL в файл с правами 0600; оборванную строку отделяем переводом строки."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as fh:
        if path.stat().st_size > 0 and not _ends_with_newline(path):
            fh.write("\n")
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def _ends_with_newline(path: Path) -> bool:
    with path.open("rb") as fh:
        fh.seek(-1, os.SEEK_END)
        return fh.read(1) == b"\n"


class CallJournal:
    def __init__(self, path: Path | str, *, now: Callable[[], datetime] = _utc_now) -> None:
        self.path = Path(path)
        self._now = now
        self._seen: set[tuple[str, str, str]] | None = None

    def _load(self) -> set[tuple[str, str, str]]:
        if self._seen is None:
            seen: set[tuple[str, str, str]] = set()
            if self.path.exists():
                for line in self.path.read_text(encoding="utf-8").splitlines():
                    try:
                        row = json.loads(line)
                        seen.add((row["call_id"], row["state"], row.get("key", "")))
                    except (ValueError, KeyError, TypeError):
                        continue
            self._seen = seen
        return self._seen

    def record(
        self,
        call_id: str,
        state: CallState,
        *,
        route: Route | None,
        caller: str | None = None,
        key: str = "",
        **fields: object,
    ) -> bool:
        """True: записано. False: повтор или сбой записи."""
        try:
            seen = self._load()
            ident = (call_id, state.value, _digest(key))
            if ident in seen:
                return False
            row = {
                **fields,
                "call_id": call_id,
                "state": state.value,
                "key": ident[2],
                "received_at": self._now().isoformat(),
                "organization_id": route.organization_id if route else None,
                "agent_id": route.agent_id if route else None,
                "caller": mask_phone(caller) if caller else None,
            }
            append_private(self.path, row)
            seen.add(ident)
            return True
        except Exception as exc:  # noqa: BLE001 - журнал не роняет звонок
            logger.warning("журнал звонков: запись не удалась (%s)", type(exc).__name__)
            return False

    @property
    def callbacks_path(self) -> Path:
        """Отдельный файл с полными номерами просьб о звонке (права 0600)."""
        return self.path.with_suffix(".callbacks.jsonl")

    def has(self, call_id: str, state: CallState, key: str = "") -> bool:
        return (call_id, state.value, _digest(key)) in self._load()

    def now_iso(self) -> str:
        return self._now().isoformat()

    def events_for(self, call_id: str) -> list[dict]:
        if not self.path.exists():
            return []
        rows = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if row.get("call_id") == call_id:
                rows.append(row)
        return rows
