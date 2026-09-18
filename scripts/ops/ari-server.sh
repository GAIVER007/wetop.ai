#!/usr/bin/env bash
# Выключатель исходящего ARI на сервере — тонкая обёртка над scripts/ops/ari.sh в режиме Docker.
#
# 18.09.2026 механика этого скрипта (всё общение с API изнутри контейнера через `compose exec`, успех по полю
# `ariStopped` в ответе самого API) слита в scripts/ops/ari.sh, который сам понимает, где он — под launchd на Mac
# или под Docker на сервере. Файл оставлен ради ссылок в документах и тестах: те же три команды.
#
#   scripts/ops/ari-server.sh stop|start|status
#
# Переменные для тестов и нестандартных стендов: COMPOSE (команда compose целиком), ARI_ENV_FILE, API_URL.
exec env ARI_MODE=docker bash "$(dirname "${BASH_SOURCE[0]}")/ari.sh" "$@"
