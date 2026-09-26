"""Второй фактор: код из приложения-аутентификатора и резервные коды.

🔴 Пароль защищает до того момента, как его узнали. Дальше он не защищает
вообще: подобрали, подсмотрели, вытащили из дампа — и человек внутри.
Поэтому после пароля панель спрашивает шестизначный код по стандарту TOTP
(Google Authenticator, Яндекс.Ключ, 1Password — любое приложение).

🔴 В журнал не пишется ни секрет, ни код, ни резервный код — ни целиком,
ни куском, ни в тексте исключения. Журнал переживает инцидент и уезжает
наружу вместе с выгрузкой; секрет оттуда равен потерянному второму фактору.
Здесь нет ни одного logger-вызова со значением: это правило, а не привычка.

🔴 Часы на сервере должны быть синхронизированы. Разъехавшееся время —
причина «правильный код не подходит» в девяти случаях из десяти.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone

import pyotp

# Шаг TOTP по стандарту. Меняется только вместе с приложением на телефоне,
# поэтому константа, а не настройка.
STEP_SECONDS = 30

# Алфавит резервных кодов без похожих знаков: 0/O и 1/l/I человек, читающий
# бумажку в три часа ночи, путает гарантированно.
_BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


# ─── Подключение ───


def new_secret() -> str:
    """Секрет пользователя. Лежит в базе (dashboard_users.totp_secret),
    а не в настройках: телефон у каждого свой."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, *, email: str, issuer: str) -> str:
    """Строка otpauth:// для приложения. issuer — то, что человек увидит
    в списке на телефоне; пустой issuer оставил бы там безымянную строку."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer or "dashboard")


def qr_svg(uri: str) -> str:
    """QR-код строкой SVG: показывается один раз при подключении.

    SVG, а не PNG: не нужен ни base64, ни картинка на диске, и код читается
    при любом масштабе. Импорт внутри функции — библиотека тянет за собой
    обработку изображений, а нужна она один раз за всё время жизни учётки.
    """
    import io

    import qrcode
    import qrcode.image.svg

    image = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage)
    buffer = io.BytesIO()
    image.save(buffer)
    return buffer.getvalue().decode("utf-8")


# ─── Проверка кода ───


def current_step(now: datetime | None = None) -> int:
    """Номер тридцатисекундного окна. Именно он запоминается у пользователя,
    чтобы погасить использованный код."""
    moment = now or datetime.now(timezone.utc)
    return int(moment.timestamp()) // STEP_SECONDS


@dataclass(frozen=True)
class CodeCheck:
    """Исход проверки: подошёл ли код, каким шагом и почему не подошёл.

    Номер шага возвращается наружу, чтобы вызывающий записал его
    пользователю: без записи погашение кода не работает.
    Причина — для журнала вызывающего; человеку на форме показывается
    одна общая фраза (см. security.LOGIN_FAILED_MESSAGE).
    """

    ok: bool
    step: int | None
    reason: str


def _clean(code: str) -> str:
    """Приложения и люди вставляют код с пробелом посередине; сравнение
    должно на этом не спотыкаться."""
    return "".join(ch for ch in (code or "") if ch.isdigit())


def verify_code(
    secret: str,
    code: str,
    *,
    last_step: int | None,
    drift: int,
    now: datetime | None = None,
) -> CodeCheck:
    """Сверка кода с секретом в допуске ±drift шагов.

    Допуск нужен: часы телефона и сервера всегда чуть разъехаться успевают.
    Больше одного шага в каждую сторону не ставим — это удлиняет жизнь
    подсмотренного кода.

    🔴 Шаг, меньший или равный last_step, не принимается: без этого
    подсмотренный или перехваченный код работает ещё полминуты, а весь
    смысл второго фактора — в том, что он одноразовый.
    """
    if not secret:
        return CodeCheck(False, None, "секрет не подключён")
    digits = _clean(code)
    if len(digits) != 6:
        return CodeCheck(False, None, "код не из шести цифр")

    center = current_step(now)
    window = max(0, int(drift))
    try:
        totp = pyotp.TOTP(secret)
        for step in range(center - window, center + window + 1):
            expected = totp.at(step * STEP_SECONDS)
            # compare_digest, а не ==: сравнение по времени не должно
            # подсказывать, сколько первых цифр угадано.
            if hmac.compare_digest(expected, digits):
                if last_step is not None and step <= last_step:
                    return CodeCheck(False, None, "шаг уже использован")
                return CodeCheck(True, step, "ok")
    except Exception:
        # Битый секрет в базе. Текст исключения не показываем и не пишем:
        # в нём бывает само значение.
        return CodeCheck(False, None, "секрет не читается")
    return CodeCheck(False, None, "код не подошёл")


# ─── Резервные коды ───


def hash_backup_code(code: str) -> str:
    """Отпечаток резервного кода. В базе только он: дамп базы не должен
    давать готовый вход. sha256 без соли осознанно — код случайный
    и одноразовый, перебор словарём здесь не работает."""
    return hashlib.sha256(_normalize_backup(code).encode("utf-8")).hexdigest()


def _normalize_backup(code: str) -> str:
    """Регистр и дефис человек воспроизводит как придётся; отпечаток
    считается от одного и того же вида."""
    return "".join(ch for ch in (code or "").lower() if ch.isalnum())


def new_backup_codes(count: int) -> list[str]:
    """Набор одноразовых кодов вида 'abcd-efgh'.

    🔴 Без них потерянный телефон означает потерянную панель, и разбирать
    это будете вы, ночью, через сервер.
    """
    result: list[str] = []
    for _ in range(max(0, int(count))):
        raw = "".join(secrets.choice(_BACKUP_ALPHABET) for _ in range(8))
        result.append(f"{raw[:4]}-{raw[4:]}")
    return result


def spend_backup_code(stored: list[str], code: str) -> list[str] | None:
    """Потратить резервный код: None — не подошёл, иначе список отпечатков
    без потраченного.

    Использованный гасится сразу: код, срабатывающий дважды, — это уже
    не резервный код, а второй пароль, записанный на бумажке.
    """
    digits = _normalize_backup(code)
    if not digits or not stored:
        return None
    target = hash_backup_code(digits)
    left: list[str] = []
    found = False
    for item in stored:
        if not found and isinstance(item, str) and hmac.compare_digest(item, target):
            found = True
            continue
        left.append(item)
    return left if found else None
