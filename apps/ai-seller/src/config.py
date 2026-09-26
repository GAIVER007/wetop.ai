"""Единый источник настроек.

Все переменные из env.example, одним объектом через pydantic-settings.
Больше настройки нигде не читаются: os.environ в других модулях запрещён,
иначе через полгода не найти, откуда взялось значение.
"""

import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Имена полей — переменные env.example в нижнем регистре."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        # Пустое значение в .env (как в env.example: «POSTGRES_PORT=»)
        # считается незаданным и не ломает разбор чисел и bool.
        env_ignore_empty=True,
    )

    # ─── Приложение ───
    app_env: str = "development"
    debug: bool = False
    public_base_url: str = ""
    cors_origins: str = ""

    # ─── База данных ───
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_db: str = ""
    postgres_user: str = ""
    postgres_password: str = ""

    # ─── Redis ───
    redis_url: str = ""

    # ─── Журнал ───
    log_level: str = "info"
    log_max_size_mb: int = 100
    log_keep_files: int = 5

    # ─── Согласие на обработку данных ───
    consent_gate_enabled: bool = False
    consent_policy_url: str = ""
    consent_policy_version: str = ""
    consent_button_text: str = ""

    # ─── Модели ───
    llm_api_key: str = ""
    llm_base_url: str = ""
    # С2: секрет хранилища ключей партнёров (Fernet, base64url 32 байта).
    # Пуст — ключи партнёров не принимаются, ходы идут ключом платформы.
    llm_keys_secret: str = ""
    # С3: адрес Graph API для WhatsApp Cloud (в тестах подменяется).
    whatsapp_graph_base_url: str = "https://graph.facebook.com/v20.0"
    llm_model: str = ""
    llm_model_fallback: str = ""
    llm_model_emergency: str = ""
    llm_allowed_models: str = ""
    llm_timeout_seconds: int = 30
    llm_max_tokens: int = 1024
    llm_temperature: float = 0.2
    # Сколько последних реплик истории уходит модели: чистый текст, не объекты.
    llm_history_turns: int = 20
    # Промпт — данные заказчика, лежит на томе ./data, а не в коде.
    prompt_path: str = "data/system_prompt.md"

    # ─── Защита ───
    injection_strike_limit: int = 3
    injection_strike_window_seconds: int = 3600
    ip_block_ttl_seconds: int = 3600
    sla_seconds: int = 300
    # Сколько времени сторож ещё считает молчание нарушением срока.
    # За пределами окна диалог из выборки выпадает: после долгого простоя
    # тысяча старых диалогов иначе занимает предел и вытесняет свежие.
    # 🔴 Это политика владельца, а не константа: увеличить — видеть дольше.
    sla_lookback_hours: int = 24
    # Сторож смотрит и на собственное здоровье бота: это видно из базы
    # и тихо ломается — в журнале ничего, а сообщения не уходят.
    watch_outbox_stuck_minutes: int = 30
    watch_outbox_stuck_limit: int = 5
    watch_needs_human_limit: int = 10
    pii_allowlist_phones: str = ""
    pii_allowlist_emails: str = ""
    # Слой 0: предел длины входа и окно дедупа двойной доставки от канала.
    guard_max_input_chars: int = 4000
    guard_dedup_ttl_seconds: int = 60
    # Слой 3: сколько последних реплик смотрим и сколько попаданий в словарь
    # считаем крещендо.
    guard_crescendo_window: int = 10
    guard_crescendo_hits: int = 3

    # ─── Панель оператора ───
    dashboard_jwt_secret: str = ""
    dashboard_admin_email: str = ""
    dashboard_admin_password_hash: str = ""
    dashboard_session_ttl_hours: int = 12
    dashboard_path_prefix: str = ""
    dashboard_login_max_attempts: int = 5
    dashboard_login_window_seconds: int = 900
    dashboard_login_block_seconds: int = 900
    dashboard_login_alert_after: int = 3
    dashboard_allowed_ips: str = ""
    dashboard_2fa_enabled: bool = True
    dashboard_2fa_issuer: str = ""
    dashboard_2fa_drift_steps: int = 1
    dashboard_2fa_backup_codes: int = 8
    # Отдельного предела для кодов нет: неудачные коды считаются вместе
    # с неудачными паролями, предел один — dashboard_login_max_attempts.

    # ─── Алерты ───
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_from: str = ""
    alert_email_to: str = ""
    alert_telegram_bot_token: str = ""
    alert_telegram_chat_id: str = ""
    # Осталось от шага 7 и не читается: строка в мессенджер пишется одна,
    # на alert_telegram_chat_id.
    alert_telegram_chat_id_personal: str = ""
    alert_retry_window_hours: int = 24
    alert_retry_interval_seconds: int = 60
    alert_dedup_sla_minutes: int = 10
    alert_dedup_hot_lead_hours: int = 24
    alert_heartbeat_enabled: bool = True
    alert_heartbeat_hour: int = 9
    # 🔴 Второй рубеж поверх дедупа: предел однотипных алертов в час.
    # Дедуп ловит повтор ОДНОГО инцидента, а ключ вида 'llm_down:{диалог}'
    # у каждого диалога свой — массовый отказ даёт шторм (на живом прогоне
    # 334 сообщения за две минуты). Здесь он обрезается.
    alert_rate_limit_per_hour: int = 10
    # Адрес Bot API бота АЛЕРТОВ — настройка, не константа: прокси и тесты
    # подменяют его. Клиентского бота в проекте нет, эта настройка своя.
    alert_telegram_api_base: str = "https://api.telegram.org"
    # Запасные адреса Bot API для бота алертов, через запятую. Пусто —
    # берётся ALERT_TELEGRAM_API_BASE. 🔴 Перебор идёт по порядку:
    # мёртвый адрес первым съедает окно таймаута раньше живого.
    alert_telegram_api_bases: str = ""

    # ─── Канал: виджет на сайте платформы ───
    # Домены платформы через запятую. Пусто — проверка Origin выключена,
    # это годится только для разработки (при старте уходит предупреждение).
    widget_site_hosts: str = ""
    # Общий секрет с платформой: ею подписан признак пользователя. Пусто —
    # подписанные признаки не принимаются вовсе, все посетители анонимные.
    widget_identity_secret: str = ""
    # Равен сроку сессии платформы: виджет читает подпись один раз при загрузке,
    # а приложение ходит между экранами без перезагрузки.
    widget_identity_ttl_seconds: int = 43200
    # Сколько живёт ключ посетителя в браузере: 30 суток.
    widget_session_ttl_hours: int = 720
    widget_messages_per_hour: int = 60
    # Предел тела запроса; проверяется по Content-Length ДО чтения.
    widget_max_body_bytes: int = 64 * 1024
    widget_attachments_enabled: bool = True
    widget_attachment_max_mb: int = 5
    widget_attachment_dir: str = "data/attachments"
    # Что принимаем: снимок экрана — это картинка.
    widget_attachment_types: str = "image/png,image/jpeg,image/webp"
    # Долгий опрос: браузер висит на запросе до ответа или до этого срока.
    widget_poll_timeout_seconds: int = 25

    # ─── База знаний ───
    kb_chunk_chars: int = 900
    kb_chunk_overlap: int = 150
    kb_chunk_min_chars: int = 80
    # Предел проверяется ДО чтения файла, по заявленному размеру.
    kb_max_file_mb: int = 10
    kb_embed_model: str = "intfloat/multilingual-e5-small"
    # Должна совпадать с VECTOR(384) в схеме: смена модели = смена числа
    # и переиндексация всего (см. models.EMBEDDING_DIM).
    kb_embed_dim: int = 384
    kb_embed_cache_ttl_seconds: int = 604800
    # Прогрев на старте выключают только тесты.
    kb_embed_warmup: bool = True
    kb_top_k: int = 5

    # ─── Внешняя система ───
    # Режим выбирается настройкой, а не правкой кода: stub | wetop.
    # Неизвестное значение фабрика сводит к stub с предупреждением
    # в журнал: молчаливый выбор реализации искать потом негде.
    integration_mode: str = "stub"
    integration_base_url: str = ""
    integration_api_key: str = ""
    integration_timeout_seconds: int = 10

    # ─── Правка настроек на лету ───
    # Белый список имён, которые панель меняет без перезапуска (см.
    # runtime_settings.py). 🔴 Системного промпта здесь нет и быть не может:
    # его источник правды — файл на томе, а не ключ в Redis.
    runtime_settings_allowed: str = (
        "llm_model,sla_seconds,alert_heartbeat_enabled,guard_max_input_chars"
    )

    # ─── Роль бота ───
    # support — помощник платформы, seller — продавец. От роли зависят
    # инструменты, промпт и сбор контакта, поэтому это настройка, а не
    # правка кода. Незнакомое значение сводит к support normalize_bot_role.
    bot_role: str = "support"
    # Справочник ошибок и папка документации платформы — ДАННЫЕ на томе,
    # их правит владелец без выкатки.
    errors_catalog_path: str = "data/errors.md"
    knowledge_dir: str = "data/knowledge"
    # Окно и предел происшествий пользователя. 🔴 Это политика владельца,
    # а не константы: шире окно — больше чужого шума, длиннее список —
    # человек в нём утонет.
    support_incident_window_hours: int = 24
    support_max_incidents: int = 5

    # ─── Бэкап ───
    # Сколько суток храним дампы (scripts/backup.sh).
    backup_keep_days: int = 14

    # ─── Служебное ───
    # Полный URL переопределяет сборку из POSTGRES_*: тестам нужен sqlite.
    database_url: str | None = None
    # Пусто — подробная проверка живости закрыта.
    internal_health_key: str = ""
    # Служебный вход платформы в панель бота (ТЗ интеграции, Б5): раздел
    # «ИИ-продавец» управляет ботом с сервера. Пусто — вход закрыт.
    seller_service_key: str = ""
    # Судья прогона качества ответов (eval/run.py): ДРУГАЯ модель, не из каскада.
    # Та же модель оценивает себя снисходительно. Нужен только для прогона.
    eval_judge_model: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        """URL для SQLAlchemy: явный DATABASE_URL или сборка из POSTGRES_*."""
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        """CORS_ORIGINS через запятую; пустые элементы отбрасываются."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_models(self) -> list[str]:
        """Каскад: основная, запасная, аварийная — без пустых и без дублей,
        порядок сохранён. Дубль в каскаде — это повтор той же модели под видом
        запасной ступени."""
        result: list[str] = []
        for name in (self.llm_model, self.llm_model_fallback, self.llm_model_emergency):
            name = name.strip()
            if name and name not in result:
                result.append(name)
        return result

    @property
    def alert_telegram_api_base_list(self) -> list[str]:
        """Адреса Bot API для бота алертов, в порядке перебора.

        🔴 Порядок сохраняется дословно: в инциденте рабочий адрес стоял
        последним, и перебор упирался в таймаут раньше, чем доходил до живого.
        Список пуст — остаётся один адрес ALERT_TELEGRAM_API_BASE, чтобы
        алерты не замолчали из-за незаполненной настройки.
        """
        bases = [b.strip() for b in self.alert_telegram_api_bases.split(",") if b.strip()]
        return bases or [self.alert_telegram_api_base]

    @property
    def alert_email_to_list(self) -> list[str]:
        """ALERT_EMAIL_TO через запятую: на каждый адрес — своя строка outbox."""
        return [e.strip() for e in self.alert_email_to.split(",") if e.strip()]

    @property
    def runtime_settings_allowed_list(self) -> list[str]:
        """Белый список правки на лету. Имени нет в списке — правка отклоняется."""
        return [n.strip() for n in self.runtime_settings_allowed.split(",") if n.strip()]

    @property
    def widget_site_hosts_list(self) -> list[str]:
        """Домены платформы, которым разрешён виджет (Origin и CORS).

        Пустой список означает «проверка выключена», а не «запрещено всем»:
        иначе разработка без домена вообще не поднимается. В бою пусто быть
        не должно, о чём приложение предупреждает при старте.
        """
        return [h.strip() for h in self.widget_site_hosts.split(",") if h.strip()]

    @property
    def widget_attachment_types_list(self) -> list[str]:
        """Разрешённые типы вложений, в нижнем регистре."""
        return [t.strip().lower() for t in self.widget_attachment_types.split(",") if t.strip()]

    @property
    def pii_allowlist_phones_list(self) -> list[str]:
        """PII_ALLOWLIST_PHONES через запятую: от каждого номера остаются только
        цифры, чтобы сравнение не зависело от того, как номер записан."""
        digits = ["".join(ch for ch in p if ch.isdigit()) for p in self.pii_allowlist_phones.split(",")]
        return [d for d in digits if d]

    @property
    def pii_allowlist_emails_list(self) -> list[str]:
        """PII_ALLOWLIST_EMAILS через запятую, в нижнем регистре."""
        return [e.strip().lower() for e in self.pii_allowlist_emails.split(",") if e.strip()]


# Роли бота. Список здесь, а не в канале: канал только спрашивает.
BOT_ROLES: tuple[str, ...] = ("support", "seller")


def normalize_bot_role(value: str | None) -> str:
    """BOT_ROLE в одну из известных ролей.

    🔴 Незнакомое значение не роняет запуск, а сводится к support: опечатка
    в .env оставила бы пользователей без ответа вовсе. Но не молча — иначе
    потом не найти, почему бот ведёт себя не так.
    """
    role = (value or "").strip().lower()
    if role in BOT_ROLES:
        return role
    logging.getLogger(__name__).warning(
        "неизвестная роль бота %r, работаем помощником платформы (support)", value
    )
    return "support"


@lru_cache
def get_settings() -> Settings:
    """Один объект на процесс. Тесты вызывают get_settings.cache_clear()."""
    return Settings()
