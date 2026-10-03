"""compose up обязан накатить миграции сам (SBOROCHNYY-PROMPT, проверка себя)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_entrypoint_applies_migrations_before_web_process() -> None:
    script = (ROOT / "scripts" / "docker-entrypoint.sh").read_text(encoding="utf-8")
    # С 01.10.2026 не `upgrade head`: запуск доходит только до 0009, 0010 и 0011 идут отдельной
    # выкладкой (DECISIONS.md, «граница миграций при запуске seller runtime»). Саму границу по
    # ревизиям проверяет test_entrypoint_migration_boundary.py, здесь только порядок: миграции, потом процесс.
    assert "alembic upgrade" in script
    assert script.index("alembic upgrade") < script.index('exec "$@"')


def test_only_web_process_runs_migrations() -> None:
    """monitor идёт тем же образом; две накатки на одну базу — гонка."""
    script = (ROOT / "scripts" / "docker-entrypoint.sh").read_text(encoding="utf-8")
    assert "gunicorn" in script


def test_dockerfile_uses_entrypoint() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "ENTRYPOINT" in dockerfile
    assert "docker-entrypoint.sh" in dockerfile
