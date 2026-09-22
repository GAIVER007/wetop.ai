"""Шаг 3: подписи вебхуков и секретные токены — сравнение в постоянное время,
пустой секрет никого не пускает."""

import hashlib
import hmac

from src.security.signatures import (
    sign_hmac_sha256,
    verify_hmac_sha256,
    verify_secret_token,
)

SECRET = "test-secret"
BODY = b'{"message": "hello"}'


def test_sign_matches_stdlib() -> None:
    expected = hmac.new(SECRET.encode(), BODY, hashlib.sha256).hexdigest()
    assert sign_hmac_sha256(SECRET, BODY) == expected


def test_verify_accepts_valid_and_rejects_tampered() -> None:
    signature = sign_hmac_sha256(SECRET, BODY)
    assert verify_hmac_sha256(SECRET, BODY, signature) is True
    assert verify_hmac_sha256(SECRET, BODY + b" ", signature) is False
    assert verify_hmac_sha256("other", BODY, signature) is False
    assert verify_hmac_sha256(SECRET, BODY, signature.upper()) is True


def test_verify_tolerates_garbage_signature() -> None:
    assert verify_hmac_sha256(SECRET, BODY, "") is False
    assert verify_hmac_sha256(SECRET, BODY, "не hex") is False
    assert verify_hmac_sha256(SECRET, BODY, "abc") is False


def test_secret_token() -> None:
    assert verify_secret_token("s3cret", "s3cret") is True
    assert verify_secret_token("s3cret", "S3cret") is False
    assert verify_secret_token("s3cret", None) is False
    assert verify_secret_token("s3cret", "") is False
    # Не-ASCII не роняет сравнение: compare_digest идёт по байтам.
    assert verify_secret_token("секрет", "секрет") is True
    assert verify_secret_token("s3cret", "сёкрет") is False


def test_empty_expected_never_matches() -> None:
    # «Секрет не настроен» не равно «пускаем всех».
    assert verify_secret_token("", "") is False
    assert verify_secret_token("", None) is False
    assert verify_secret_token("", "anything") is False
