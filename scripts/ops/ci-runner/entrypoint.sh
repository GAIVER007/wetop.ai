#!/bin/bash
# Регистрация один раз, дальше — работа. Токен регистрации живёт час, поэтому настройка сохраняется
# в томе: перезапуск контейнера новый токен НЕ требует (разбор 21.09.2026).
set -eu

: "${RUNNER_REPO_URL:?нужен адрес репозитория, например https://github.com/GAIVER007/wetop.ai}"
cd /home/runner/actions-runner

if [ ! -f .runner ]; then
  : "${RUNNER_TOKEN:?нужен токен регистрации: Settings → Actions → Runners → New self-hosted runner}"
  # Значения из .env попадают в заголовки запроса к GitHub. Не-ASCII символ в них (многоточие «…» из примера в
  # README, неразрывный пробел или кавычка из буфера обмена) даёт «Request headers must contain only ASCII
  # characters» и цикл регистрации без единого внятного слова (01.10.2026). Хвостовые пробелы и CR срезаются,
  # остальное не-ASCII — отказ сразу и словами.
  for name in RUNNER_TOKEN RUNNER_REPO_URL; do
    value="${!name}"
    value="${value%$'\r'}"
    value="${value%"${value##*[![:space:]]}"}"
    if LC_ALL=C grep -q '[^ -~]' <<<"$value"; then
      echo "ci-runner: в $name есть не-ASCII символ (многоточие, неразрывный пробел, кавычка из буфера обмена): GitHub отвечает «Request headers must contain only ASCII characters». Впишите значение заново, латиницей и без кавычек" >&2
      exit 1
    fi
    printf -v "$name" '%s' "$value"
  done
  ./config.sh --unattended --replace \
    --url "$RUNNER_REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "${RUNNER_NAME:-wetop}-$(hostname)" \
    --labels "${RUNNER_LABELS:-wetop}" \
    --work _work
fi

exec ./run.sh
