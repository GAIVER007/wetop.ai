#!/bin/bash
# Регистрация один раз, дальше — работа. Токен регистрации живёт час, поэтому настройка сохраняется
# в томе: перезапуск контейнера новый токен НЕ требует (разбор 21.09.2026).
set -eu

: "${RUNNER_REPO_URL:?нужен адрес репозитория, например https://github.com/GAIVER007/wetop.ai}"
cd /home/runner/actions-runner

if [ ! -f .runner ]; then
  : "${RUNNER_TOKEN:?нужен токен регистрации: Settings → Actions → Runners → New self-hosted runner}"
  ./config.sh --unattended --replace \
    --url "$RUNNER_REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "${RUNNER_NAME:-wetop}-$(hostname)" \
    --labels "${RUNNER_LABELS:-wetop}" \
    --work _work
fi

exec ./run.sh
