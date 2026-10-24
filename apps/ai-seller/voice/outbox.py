"""Очередь на отправку событий в API платформы: по файлу на событие в каталоге на томе.

Событие внешнее: терять его нельзя (AGENTS.md §11). Поэтому оно сначала ложится на диск, и только потом уходит;
подтверждённое удаляется, отвергнутое навсегда (4xx) откладывается в `rejected/` с причиной, а не пропадает.
Воркер запускает по процессу на звонок, и каталог общий: событие занимается атомарным переименованием, второй процесс
его не увидит. Забытое упавшим процессом занятое событие возвращается через `claim_ttl_seconds`.
Файлы 0600. Сбой записи не роняет звонок: `enqueue` возвращает None и пишет в лог.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

REJECTED_DIR = "rejected"
# Просмотр очереди ограничен: при многочасовом отказе API тысячи файлов с будущим сроком не должны разбираться на каждом проходе
SCAN_LIMIT = 500


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _write_private(path: Path, data: dict) -> None:
    """Запись через временный файл и замену: читатель видит либо старое, либо новое целиком."""
    tmp = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex[:8]}")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    os.replace(tmp, path)


@dataclass
class Item:
    """Занятое событие. Закрыть его надо одним из трёх способов: ack, retry или reject."""

    _box: "Outbox"
    _claimed: Path
    _home: Path
    payload: dict
    attempts: int
    _created_at: str

    def ack(self) -> None:
        self._claimed.unlink(missing_ok=True)

    def retry(self, delay_seconds: float) -> None:
        # занятость потеряна (событие вернули в очередь по сроку и заняли заново): чужое состояние не переписываем
        if not self._claimed.exists():
            return
        data = {
            "created_at": self._created_at,
            "attempts": self.attempts + 1,
            "next_at": (self._box._now() + timedelta(seconds=delay_seconds)).isoformat(),
            "payload": self.payload,
        }
        _write_private(self._home, data)
        self._claimed.unlink(missing_ok=True)

    def reject(self, reason: str) -> None:
        self._box._to_rejected(self._home.name, self._claimed, self.payload, self.attempts, reason)


class Outbox:
    def __init__(
        self,
        directory: Path | str,
        *,
        now: Callable[[], datetime] = _utc_now,
        claim_ttl_seconds: float = 600,
    ) -> None:
        self.dir = Path(directory)
        self._now = now
        self._ttl = claim_ttl_seconds

    # --- запись ---------------------------------------------------------------------------------

    def enqueue(self, payload: dict) -> str | None:
        try:
            self.dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(self.dir, 0o700)
            # порядок по реальным часам процесса (наносекунды), а не по подменяемым `now`: старое событие идёт первым
            ident = f"{time.time_ns():020d}-{uuid.uuid4().hex[:8]}"
            _write_private(
                self.dir / f"{ident}.json",
                {"created_at": self._now().isoformat(), "attempts": 0, "next_at": None, "payload": payload},
            )
            return ident
        except Exception as exc:  # noqa: BLE001 - событие не должно ронять звонок, причина в лог без содержимого
            logger.error("очередь событий: запись не удалась (%s)", type(exc).__name__)
            return None

    # --- выдача ---------------------------------------------------------------------------------

    @staticmethod
    def _read(path: Path) -> tuple[dict, int, str, datetime | None]:
        data = json.loads(path.read_text(encoding="utf-8"))
        payload = data["payload"]
        if not isinstance(payload, dict):
            raise ValueError("payload")
        next_at = data.get("next_at")
        due = datetime.fromisoformat(next_at) if next_at else None
        return payload, int(data.get("attempts", 0)), str(data.get("created_at", "")), due

    def take_due(self) -> Item | None:
        """Самое старое событие, срок которого пришёл; None, если таких нет. Событие становится занятым."""
        if not self.dir.is_dir():
            return None
        for path in sorted(self.dir.glob("*.json"))[:SCAN_LIMIT]:
            try:
                payload, attempts, created, due = self._read(path)
            except FileNotFoundError:
                continue
            except (ValueError, KeyError, TypeError):
                # повреждённый файл не должен вставать поперёк очереди
                self._to_rejected(path.name, path, None, 0, "damaged")
                continue
            except OSError as exc:
                # временный сбой чтения (права, том): событие здоровое, трогать его нельзя
                logger.error("очередь событий: файл не прочитан (%s), пропущен", type(exc).__name__)
                continue
            if due is not None and due > self._now():
                continue
            claimed = path.with_name(f"{path.name}.{int(self._now().timestamp())}.sending")
            try:
                os.rename(path, claimed)
            except FileNotFoundError:
                continue  # событие уже занял другой процесс
            # Занятое читаем заново: пока мы смотрели список, другой процесс мог вернуть его с новым сроком и числом попыток
            try:
                payload, attempts, created, due = self._read(claimed)
            except (ValueError, KeyError, TypeError):
                self._to_rejected(path.name, claimed, None, 0, "damaged")
                continue
            except OSError as exc:
                logger.error("очередь событий: занятый файл не прочитан (%s)", type(exc).__name__)
                self._release(claimed, path)
                continue
            if due is not None and due > self._now():
                self._release(claimed, path)
                continue
            return Item(self, claimed, path, payload, attempts, created)
        return None

    @staticmethod
    def _release(claimed: Path, home: Path) -> None:
        """Вернуть занятое: если на его месте уже лежит более свежая копия, лишнюю убрать."""
        try:
            if home.exists():
                claimed.unlink(missing_ok=True)
            else:
                os.rename(claimed, home)
        except OSError:
            pass

    def recover(self) -> int:
        """Вернуть в очередь события, занятые давно и не подтверждённые (процесс упал); убрать брошенные временные файлы."""
        if not self.dir.is_dir():
            return 0
        returned = 0
        for path in self.dir.glob("*.sending"):
            try:
                home_name, _, rest = path.name.rpartition(".sending")[0].rpartition(".")
                claimed_at = int(rest)
            except ValueError:
                continue
            if self._now().timestamp() - claimed_at < self._ttl:
                continue
            home = self.dir / home_name
            if home.exists():
                # запись нового состояния успела, старая занятая копия осталась: новое не затираем
                path.unlink(missing_ok=True)
                continue
            try:
                os.rename(path, home)
                returned += 1
            except FileNotFoundError:
                continue
        wall = time.time()
        for tmp in self.dir.glob(".*.tmp-*"):
            try:
                if wall - tmp.stat().st_mtime > self._ttl:
                    tmp.unlink(missing_ok=True)
            except OSError:
                continue
        return returned

    def requeue_rejected(self) -> int:
        """Вернуть отложенные события в очередь заново (после исправления причины отказа)."""
        folder = self.dir / REJECTED_DIR
        if not folder.is_dir():
            return 0
        count = 0
        for path in sorted(folder.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                payload = data["payload"]
                if not isinstance(payload, dict) or "raw" in payload and len(payload) == 1:
                    continue
            except (OSError, ValueError, KeyError, TypeError):
                continue
            if self.enqueue(payload) is not None:
                path.unlink(missing_ok=True)
                count += 1
        return count

    # --- учёт -----------------------------------------------------------------------------------

    def pending_count(self) -> int:
        if not self.dir.is_dir():
            return 0
        return len(list(self.dir.glob("*.json"))) + len(list(self.dir.glob("*.sending")))

    def rejected_count(self) -> int:
        folder = self.dir / REJECTED_DIR
        return len(list(folder.glob("*.json"))) if folder.is_dir() else 0

    def _to_rejected(self, name: str, source: Path, payload: dict | None, attempts: int, reason: str) -> None:
        folder = self.dir / REJECTED_DIR
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        body = payload
        if body is None:
            try:
                body = {"raw": source.read_text(encoding="utf-8")[:4000]}
            except OSError:
                body = {}
        _write_private(
            folder / name,
            {"rejected_at": self._now().isoformat(), "reason": reason, "attempts": attempts, "payload": body},
        )
        source.unlink(missing_ok=True)
        # в лог только причина и имя файла: в событии могут быть телефон и заметка
        logger.error("очередь событий: событие отложено в rejected (%s, %s)", reason, name)
