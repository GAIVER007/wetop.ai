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


@lru_cache
def get_settings() -> Settings:
    """Один объект на процесс. Тесты вызывают get_settings.cache_clear()."""
    return Settings()
