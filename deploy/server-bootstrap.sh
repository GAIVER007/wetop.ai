#!/usr/bin/env bash
# Первичная настройка сервера одной командой (plans/server-kz-2026-09-17.md, docs/ops/server-setup-2026-09-18.md §2).
#
#   sudo bash deploy/server-bootstrap.sh [--branch <ветка>] [--skip-docker]
#
# Делает на чистом Ubuntu 24.04 и переживает повторный запуск без вреда:
#   1) пакеты: ca-certificates, curl, git, openssh-client;
#   2) Docker и Compose из официального репозитория Docker (Compose не старше 2.24 — deploy/compose.yml
#      использует необязательный env_file); --skip-docker пропускает этот шаг (тест в контейнере без демона);
#   3) пользователь системы (PMS_USER, по умолчанию pms) в группе docker — контейнеры и так идут от node,
#      но и хозяин файлов пусть будет обычным, не root;
#   4) ключ доступа к репозиторию ТОЛЬКО на чтение (deploy key), свой у сервера, а не личный ключ владельца
#      (SECURITY.md §4: репозиторий приватный);
#   5) клон нужной ветки в ~pms/wetop и папка под ключ туннеля.
#
# Если репозиторий ещё недоступен (ключ не добавлен в GitHub), скрипт печатает публичный ключ и выходит с кодом 3:
# добавить ключ в GitHub → Settings → Deploy keys (без «Allow write access») и запустить ту же команду снова.
#
# Переменные: PMS_USER (pms), PMS_HOME (/home/$PMS_USER), REPO_URL (git@github.com:GAIVER007/wetop.ai.git).
# Секретов скрипт не трогает: .env владелец копирует сам после него (см. вывод в конце).
set -euo pipefail

PMS_USER="${PMS_USER:-pms}"
PMS_HOME="${PMS_HOME:-/home/$PMS_USER}"
REPO_URL="${REPO_URL:-git@github.com:GAIVER007/wetop.ai.git}"
BRANCH="main"
SKIP_DOCKER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --skip-docker) SKIP_DOCKER=1; shift ;;
    *) echo "неизвестный аргумент: $1 (есть --branch <ветка>, --skip-docker)" >&2; exit 2 ;;
  esac
done

say() { printf '\n== %s\n' "$*"; }
# cd /: команда идёт от имени pms из каталога, который ему читаем. Иначе запуск из домашней папки
# администратора (750 на Ubuntu 21.04+) валит git ещё на поиске репозитория, stderr тут глушится,
# и наружу выходит ложное «репозиторий недоступен, ключ не добавлен» (разбор: кандидат №2.9, 09.10.2026)
as_user() { (cd / && runuser -u "$PMS_USER" -- "$@"); }

[ "$(id -u)" -eq 0 ] || { echo "запускать от root: sudo bash $0" >&2; exit 2; }

# --- 1. пакеты --------------------------------------------------------------------------------------
say "пакеты"
export DEBIAN_FRONTEND=noninteractive
PKGS=(ca-certificates curl git openssh-client)
missing=()
for p in "${PKGS[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
if [ ${#missing[@]} -eq 0 ]; then
  echo "${PKGS[*]} — уже стоят"
else
  apt-get update -qq >/dev/null
  apt-get install -y -qq "${missing[@]}" >/dev/null
  echo "поставлены: ${missing[*]}"
fi

# --- 2. Docker --------------------------------------------------------------------------------------
if [ "$SKIP_DOCKER" -eq 1 ]; then
  say "Docker пропущен (--skip-docker)"
elif docker compose version >/dev/null 2>&1; then
  say "Docker уже стоит: $(docker compose version)"
else
  say "Docker из официального репозитория"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq >/dev/null
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null 2>&1 || true
  echo "поставлен: $(docker compose version)"
fi

# --- 3. пользователь системы ------------------------------------------------------------------------
say "пользователь $PMS_USER"
if id -u "$PMS_USER" >/dev/null 2>&1; then
  echo "уже есть"
else
  adduser --disabled-password --gecos '' --home "$PMS_HOME" "$PMS_USER" >/dev/null
  echo "создан, дом $PMS_HOME"
fi
if getent group docker >/dev/null 2>&1; then
  usermod -aG docker "$PMS_USER"
  echo "в группе docker"
fi

# --- 4. ключ доступа к репозиторию, только на чтение ------------------------------------------------
say "ключ доступа к репозиторию"
SSH_DIR="$PMS_HOME/.ssh"
KEY="$SSH_DIR/wetop-deploy"
as_user mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
if [ -f "$KEY" ]; then
  echo "уже есть: $KEY"
else
  as_user ssh-keygen -q -t ed25519 -N '' -f "$KEY" -C "wetop server $(hostname)"
  echo "создан: $KEY"
fi
CONFIG="$SSH_DIR/config"
if [ -f "$CONFIG" ] && grep -q '^Host github.com$' "$CONFIG"; then
  echo "ssh config уже настроен"
else
  as_user sh -c "printf 'Host github.com\n  IdentityFile ~/.ssh/wetop-deploy\n  IdentitiesOnly yes\n' >> '$CONFIG'"
  chmod 600 "$CONFIG"
  echo "ssh config: github.com → $KEY"
fi

# --- 5. репозиторий ---------------------------------------------------------------------------------
say "репозиторий $REPO_URL, ветка $BRANCH"
if ! as_user git ls-remote --quiet --exit-code "$REPO_URL" HEAD >/dev/null 2>&1; then
  cat <<EOF

Репозиторий пока недоступен с этого сервера — ключ ещё не добавлен в GitHub.

Публичный ключ сервера (Deploy key, только чтение):

$(cat "$KEY.pub")

Добавить: GitHub → репозиторий → Settings → Deploy keys → Add deploy key,
галочку «Allow write access» НЕ ставить. Потом запустить эту же команду ещё раз.
EOF
  exit 3
fi

TARGET="$PMS_HOME/wetop"
if [ -d "$TARGET/.git" ]; then
  echo "репозиторий уже на месте: $TARGET (обновление — git pull, docs/deploy.md §1а)"
else
  as_user git clone --quiet --branch "$BRANCH" "$REPO_URL" "$TARGET"
  echo "склонирован в $TARGET"
fi
as_user mkdir -p "$TARGET/deploy/cloudflared"
chmod 700 "$TARGET/deploy/cloudflared"

cat <<EOF

== готово. Дальше — docs/ops/server-setup-2026-09-18.md §2.4 и §3:
   1. с Mac:   scp ~/.env $PMS_USER@<IP-сервера>:$TARGET/.env
   2. здесь:   chmod 600 $TARGET/.env
               в .env заменить DATABASE_URL на строку управляемой базы ps.kz;
               DATABASE_SCHEMA не задавать, PII_STORAGE пока не трогать
               (один файл в корне клона: его читают и хост, и compose через ../.env)
   3. здесь:   cd $TARGET && npm ci && npx tsx scripts/imports/src/cli-check-env.ts
   Ключ и конфиг туннеля — только на шаге 4 плана, папка: $TARGET/deploy/cloudflared/
EOF
