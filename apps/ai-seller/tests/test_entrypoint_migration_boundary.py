"""A normal runtime rollout must not silently run the separate 0010 contraction."""
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_entrypoint(tmp_path, revision):
    commands = tmp_path / 'commands'
    alembic = tmp_path / 'alembic'
    alembic.write_text('#!/bin/sh\nif [ "$1" = current ]; then echo "$QA_REVISION"; else echo "$*" >> "$QA_COMMANDS"; fi\n')
    gunicorn = tmp_path / 'gunicorn'
    gunicorn.write_text('#!/bin/sh\necho started >> "$QA_COMMANDS"\n')
    for executable in (alembic, gunicorn):
        executable.chmod(0o755)
    result = subprocess.run(['sh', str(ROOT / 'scripts/docker-entrypoint.sh'), 'gunicorn'],
        env={**os.environ, 'PATH': f'{tmp_path}:{os.environ["PATH"]}',
             'QA_COMMANDS': str(commands), 'QA_REVISION': revision}, capture_output=True, text=True)
    return result, commands.read_text().splitlines() if commands.exists() else []


def test_runtime_rollout_stops_at_expand_revision(tmp_path):
    result, commands = run_entrypoint(tmp_path, '0004')
    assert result.returncode == 0
    assert commands == ['upgrade 0009', 'started']


def test_already_contracted_database_is_not_downgraded(tmp_path):
    result, commands = run_entrypoint(tmp_path, '0010 (head)')
    assert result.returncode == 0
    assert commands == ['started']


def test_unknown_future_revision_refuses_to_start(tmp_path):
    result, commands = run_entrypoint(tmp_path, '0011 (head)')
    assert result.returncode != 0
    assert commands == []
