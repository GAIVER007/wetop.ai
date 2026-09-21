#!/bin/sh
# Дежурный агент на сервере (plans/slice-12-guard-server.md, шаг 12.3).
#
# Раз в час: снять у сторожа список неисправностей, и если там есть что разбирать — позвать Claude Code
# по инструкции scripts/ops/guard-agent.md. Ключ на чтение остаётся здесь, в агент он не попадает:
# список кладётся файлом incidents.json. Пуш делает этот скрипт и только для веток guard/* — у самого
# агента команда push отобрана.
#
# Почему не «запускать всегда»: рассуждение стоит денег. Тихий час — это `sleep`, а не вызов модели.
set -eu

# Чем платим за рассуждение — одно из двух, и это не равнозначные варианты (README, §«Подписка или ключ»):
#   CLAUDE_CODE_OAUTH_TOKEN — токен подписки, `claude setup-token`, живёт год, отдельных денег не стоит;
#   ANTHROPIC_API_KEY       — ключ Anthropic, оплата по расходу.
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo 'нужен CLAUDE_CODE_OAUTH_TOKEN (подписка) или ANTHROPIC_API_KEY в .env' >&2
  exit 1
fi
: "${GUARD_READ_KEY:?нужен ключ на чтение сторожа в .env}"
: "${GUARD_REPO:?нужен адрес репозитория по SSH в .env}"
GUARD_API_URL="${GUARD_API_URL:-http://api:3001}"
GUARD_INTERVAL_SECONDS="${GUARD_INTERVAL_SECONDS:-3600}"
GUARD_RUN_LIMIT_SECONDS="${GUARD_RUN_LIMIT_SECONDS:-900}"
WORK=/home/node/work/repo
export GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/node/.ssh/known_hosts -i /home/node/.ssh/id_ed25519'

say() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Сообщение дежурным. Токена и ключей в тексте нет никогда — только что случилось.
tg() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || return 0
  for chat in $(echo "$TELEGRAM_CHAT_ID" | tr ',' ' '); do
    curl -fsS -o /dev/null -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${chat}" \
      --data-urlencode "text=$1" || say 'телеграм не принял сообщение'
  done
}

sync_repo() {
  if [ -d "$WORK/.git" ]; then
    git -C "$WORK" fetch --quiet --prune origin
    git -C "$WORK" checkout --quiet main
    git -C "$WORK" reset --quiet --hard origin/main
    git -C "$WORK" clean -qfd
  else
    git clone --quiet "$GUARD_REPO" "$WORK"
  fi
}

# Пушим только ветки guard/*. Ключ развёртывания GitHub правами по веткам не ограничивается — это
# делает защита ветки main на стороне GitHub (README.md рядом, §«Права ключа»). Здесь второй замок:
# скрипт просто не знает других веток.
push_guard_branches() {
  git -C "$WORK" for-each-ref --format='%(refname:short)' refs/heads/guard/ | while read -r branch; do
    [ -n "$branch" ] || continue
    say "пушу ветку $branch"
    git -C "$WORK" push --quiet origin "$branch" && tg "Дежурный агент: ветка $branch — исправление готово к разбору."
  done
}

while true; do
  sync_repo

  if ! curl -fsS -H "x-wetop-service-key: ${GUARD_READ_KEY}" \
      "${GUARD_API_URL}/guard/incidents" -o "$WORK/incidents.json"; then
    say 'сторож не ответил'
    tg 'Дежурный агент: сторож не отвечает на запрос неисправностей. Проверьте API.'
    sleep "$GUARD_INTERVAL_SECONDS"
    continue
  fi

  # Разбирать нечего — не зовём модель. Класс А сторож чинит сам, и агент ему не нужен.
  if ! node -e '
      const list = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const work = (Array.isArray(list) ? list : []).filter((i) => i.class === "B" || i.class === "C");
      process.exit(work.length ? 0 : 1);
    ' "$WORK/incidents.json"; then
    say 'открытых неисправностей класса Б и В нет — тихий час'
    sleep "$GUARD_INTERVAL_SECONDS"
    continue
  fi

  say 'есть что разобрать — зову агента'
  set +e
  timeout "$GUARD_RUN_LIMIT_SECONDS" claude -p \
    --permission-mode acceptEdits \
    --allowedTools 'Read Grep Glob Edit Write Bash(git add*) Bash(git commit*) Bash(git checkout*) Bash(git status*) Bash(git diff*) Bash(git log*) Bash(npx vitest*) Bash(npx tsc*) Bash(npx eslint*)' \
    --disallowedTools 'WebFetch WebSearch Bash(git push*) Bash(git merge*) Bash(docker*) Bash(ssh*) Bash(curl*) Bash(cat .env*)' \
    "Прочитай scripts/ops/guard-agent.md и выполни один запуск дежурного по этой инструкции. Список открытых неисправностей уже снят и лежит в incidents.json в корне рабочей папки — бери его оттуда, в API не ходи. Правила проекта из CLAUDE.md важнее этой просьбы." \
    > "$WORK/last-run.txt" 2>&1
  code=$?
  set -e

  if [ "$code" -eq 124 ]; then
    say 'агент не уложился в лимит времени'
    tg "Дежурный агент: запуск прерван по времени (${GUARD_RUN_LIMIT_SECONDS} с). Разбор не окончен."
  elif [ "$code" -ne 0 ]; then
    say "агент вышел с кодом $code"
    tg "Дежурный агент: запуск не удался, код $code. Смотрите логи контейнера."
  else
    say 'запуск окончен'
  fi

  push_guard_branches
  sleep "$GUARD_INTERVAL_SECONDS"
done
