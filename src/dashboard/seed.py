"""Первая учётка панели из настроек.

Без посева на свежей выкатке в панель не войти вообще: таблица
dashboard_users пуста, а ручки «создать первого владельца» нет и быть
не должно — её нашли бы раньше вас.

🔴 Из настроек берётся ХЕШ пароля, а не пароль: файл настроек читают агент,
бэкап и любой, кто попал на сервер.
"""

from __future__ import annotations

import logging

import sqlalchemy as sa

from src import dependencies
from src.config import Settings
from src.db.base import utcnow
from src.db.models import DashboardUser

logger = logging.getLogger(__name__)

# Понятная строка для журнала: по ней ищут, почему в панель не пускает.
NO_HASH_MESSAGE = (
    "DASHBOARD_ADMIN_EMAIL задан, а DASHBOARD_ADMIN_PASSWORD_HASH пуст: "
    "войти будет нечем, панель не подключена"
)


def admin_credentials_ok(settings: Settings) -> bool:
    """Заполнена ли пара «почта + хеш». Почта без хеша — ошибка настройки,
    и панель не подключается так же, как с пустым путём: тихий старт без
    возможности войти ищут потом полдня."""
    email = (settings.dashboard_admin_email or "").strip()
    hashed = (settings.dashboard_admin_password_hash or "").strip()
    return not email or bool(hashed)


async def ensure_admin_user(settings: Settings) -> bool:
    """Создать владельца из настроек, если записи с такой почтой ещё нет.

    Своя сессия: посев идёт из lifespan, запроса вокруг нет. Возвращает
    True, если запись создана.
    """
    email = (settings.dashboard_admin_email or "").strip().lower()
    hashed = (settings.dashboard_admin_password_hash or "").strip()
    if not email or not hashed:
        return False
    try:
        async with dependencies.get_sessionmaker()() as session:
            stmt = sa.select(DashboardUser.id).where(DashboardUser.email == email)
            if (await session.execute(stmt)).first() is not None:
                return False
            session.add(
                DashboardUser(
                    email=email,
                    password_hash=hashed,
                    role="owner",
                    backup_codes=[],
                    failed_logins=0,
                    created_at=utcnow(),
                )
            )
            await session.commit()
    except Exception:
        # База недоступна или миграции не накатаны: приложение живёт, бот
        # отвечает клиентам. Молчать нельзя — иначе вход ищут полдня.
        logger.exception("первая учётка панели не создана")
        return False
    logger.info("создана первая учётка панели из настроек")
    return True
