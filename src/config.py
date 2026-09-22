"""Единый источник настроек.

Все переменные из env.example, одним объектом через pydantic-settings.
Больше настройки нигде не читаются: os.environ в других модулях запрещён,
иначе через полгода не найти, откуда взялось значение.
"""

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
    llm_model: str = ""
    llm_model_fallback: str = ""
    llm_model_emergency: str = ""
    llm_allowed_models: str = ""
    llm_timeout_seconds: int = 30
    llm_max_tokens: int = 1024

    # ─── Защита ───
    injection_strike_limit: int = 3
    injection_strike_window_seconds: int = 3600
    ip_block_ttl_seconds: int = 3600
    sla_seconds: int = 300
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
    dashboard_2fa_code_max_attempts: int = 5

    # ─── Алерты ───
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_from: str = ""
    alert_email_to: str = ""
    alert_telegram_bot_token: str = ""
    alert_telegram_chat_id: str = ""
    alert_telegram_chat_id_personal: str = ""
    alert_retry_window_hours: int = 24
    alert_retry_interval_seconds: int = 60
    alert_dedup_sla_minutes: int = 10
    alert_dedup_hot_lead_hours: int = 24
    alert_heartbeat_enabled: bool = True
    alert_heartbeat_hour: int = 9

    # ─── Канал ───
    channel_telegram_bot_token: str = ""
    channel_telegram_bot_username: str = ""
    channel_telegram_webhook_secret: str = ""

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

    # ─── Служебное ───
    # Полный URL переопределяет сборку из POSTGRES_*: тестам нужен sqlite.
    database_url: str | None = None
    # Пусто — подробная проверка живости закрыта.
    internal_health_key: str = ""

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
    def pii_allowlist_phones_list(self) -> list[str]:
        """PII_ALLOWLIST_PHONES через запятую: от каждого номера остаются только
        цифры, чтобы сравнение не зависело от того, как номер записан."""
        digits = ["".join(ch for ch in p if ch.isdigit()) for p in self.pii_allowlist_phones.split(",")]
        return [d for d in digits if d]

    @property
    def pii_allowlist_emails_list(self) -> list[str]:
        """PII_ALLOWLIST_EMAILS через запятую, в нижнем регистре."""
        return [e.strip().lower() for e in self.pii_allowlist_emails.split(",") if e.strip()]


@lru_cache
def get_settings() -> Settings:
    """Один объект на процесс. Тесты вызывают get_settings.cache_clear()."""
    return Settings()
