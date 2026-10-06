#!/bin/bash
# Регистрация один раз, дальше — работа. Токен регистрации живёт час, поэтому настройка сохраняется
# в томе: перезапуск контейнера новый токен НЕ требует (разбор 21.09.2026).
set -eu

: "${RUNNER_REPO_URL:?нужен адрес репозитория, например https://github.com/GAIVER007/wetop.ai}"
cd "${RUNNER_HOME:-/home/runner/actions-runner}"

if [ ! -f .runner ]; then
  : "${RUNNER_TOKEN:?нужен токен регистрации: Settings → Actions → Runners → New self-hosted runner}"
  # Оба значения уходят в заголовки запроса к GitHub. Не-ASCII в них (например «…» из образца строки в README)
  # рвёт регистрацию сообщением «Request headers must contain only ASCII characters», и раннер не подключается
  # вовсе: так проверки простояли в очереди с 21.09 по 03.10.2026. Поэтому проверка здесь, со словами, что не так.
  if ! printf '%s' "$RUNNER_TOKEN" | LC_ALL=C grep -Eq '^[A-Za-z0-9]{20,}$'; then
    echo "RUNNER_TOKEN в .env раннера не похож на токен регистрации: нужны только латинские буквы и цифры, без пробелов, кавычек и «…». Скопируйте значение после --token со страницы New self-hosted runner" >&2
    exit 64
  fi
  if ! printf '%s' "$RUNNER_REPO_URL" | LC_ALL=C grep -Eq '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'; then
    echo "RUNNER_REPO_URL в .env раннера: нужен адрес вида https://github.com/GAIVER007/wetop.ai" >&2
    exit 64
  fi
  ./config.sh --unattended --replace \
    --url "$RUNNER_REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "${RUNNER_NAME:-wetop}-$(hostname)" \
    --labels "${RUNNER_LABELS:-wetop}" \
    --work _work
fi

exec ./run.sh
