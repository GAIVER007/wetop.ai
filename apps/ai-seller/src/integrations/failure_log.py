"""Как писать в журнал отказ внешней системы.

Различие важнее, чем кажется: `ProviderUnavailable` объявлен в интерфейсе,
то есть обрыв связи с чужой системой — штатное событие, а не дефект.
Трассировка на каждый такой случай топит в журнале настоящие ошибки,
а разбор инцидента начинается именно с них.

Сигнал оператору при этом даёт не журнал, а алерт: журнал читают разработчики.
"""

import logging

from src.integrations.providers import ProviderUnavailable


def log_provider_failure(logger: logging.Logger, what: str, exc: BaseException, **fields) -> None:
    """Ожидаемая недоступность — предупреждение с кодом, дефект — трассировка."""
    tail = "".join(f", {name}=%s" for name in fields)
    values = tuple(fields.values())
    if isinstance(exc, ProviderUnavailable):
        logger.warning(f"{what}: внешняя система недоступна (%s){tail}", exc, *values)
    else:
        logger.exception(f"{what}: сбой внешней системы{tail}", *values)
