#!/bin/bash
# Хук раннера перед каждой задачей (ACTIONS_RUNNER_HOOK_JOB_STARTED, задаётся в Dockerfile).
#
# Задачи из запроса на слияние из чужого форка раннер не выполняет: он стоит на боевом сервере (ADR-137,
# замечание ментора 02.10.2026). Условие `if:` в checks.yml от этого не защищает: для pull_request GitHub
# берёт файл проверок из самого запроса, и автор форка его просто уберёт. Этот файл лежит в образе раннера,
# запрос на слияние его не меняет. Ненулевой код: GitHub задачу не запускает и помечает проваленной
# (docs.github.com, «Running scripts before or after a job»), и обязательная проверка не даёт слить запрос.
# Пропуск задачи через `if:` был бы хуже: пропущенная задача для обязательной проверки считается успешной.
set -eu

event="${GITHUB_EVENT_PATH:-}"
if [ -z "$event" ] || [ ! -r "$event" ]; then
  echo "WETOP: нет файла события GitHub (GITHUB_EVENT_PATH), задачу не выполняю" >&2
  exit 1
fi

# Непонятное событие (битый JSON) или нет jq: задача не выполняется, а не проходит молча.
if ! kind=$(jq -r 'if has("pull_request") then "pull_request" else "other" end' "$event"); then
  echo "WETOP: файл события GitHub не разобран (jq), задачу не выполняю" >&2
  exit 1
fi

if [ "$kind" = "pull_request" ]; then
  head=$(jq -r '.pull_request.head.repo.full_name // ""' "$event")
  base=$(jq -r '.pull_request.base.repo.full_name // ""' "$event")
  # Пустое имя: форк уже удалён, чей это код, не проверить. Тоже отказ.
  if [ -z "$head" ] || [ "$head" != "$base" ]; then
    echo "WETOP: запрос на слияние из форка ${head:-(форк удалён)} в ${base:-?}: свой раннер чужой код не выполняет" >&2
    echo "WETOP: ветку нужно положить в сам репозиторий (scripts/ops/ci-runner/README.md, «Безопасность»)" >&2
    exit 1
  fi
fi

echo "WETOP: задача из самого репозитория, раннер её выполняет"
