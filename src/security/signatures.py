"""Подписи вебхуков и секретные заголовки.

Сравнение всегда через hmac.compare_digest: обычное == выходит раньше на
первом несовпавшем байте, и по времени ответа подпись подбирается посимвольно.
"""

import hashlib
import hmac


def sign_hmac_sha256(secret: str, body: bytes) -> str:
    """HMAC-SHA256 тела запроса в hex."""
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def verify_hmac_sha256(secret: str, body: bytes, signature: str) -> bool:
    """Проверяет hex-подпись тела. Любая ошибка формата — False, не исключение:
    сломанный заголовок от чужого — это тоже «подпись не сошлась»."""
    if not secret or not signature:
        return False
    try:
        expected = sign_hmac_sha256(secret, body)
        return hmac.compare_digest(expected.encode("ascii"), signature.strip().lower().encode("ascii"))
    except (TypeError, ValueError, UnicodeError, AttributeError):
        return False


def verify_secret_token(expected: str, provided: str | None) -> bool:
    """Сравнение секретного заголовка по байтам.

    Пустой expected -> False: «секрет не настроен» не равно «пускаем всех».
    Иначе забытая переменная в .env открывает вебхук любому, кто знает адрес.
    """
    if not expected or provided is None:
        return False
    try:
        return hmac.compare_digest(expected.encode("utf-8"), provided.encode("utf-8"))
    except (TypeError, AttributeError, UnicodeError):
        return False
