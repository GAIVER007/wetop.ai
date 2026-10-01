#!/usr/bin/env bash
# Перемотка ветки `release` на проверенный коммит: только по зелёным проверкам GitHub (разбор 01.10.2026,
# reports/order-2026-10-01, пункт 8; docs/deploy.md §1д).
#
# До 01.10.2026 `release` перематывали руками, и 30.09 она ушла вперёд при красных наборах в `main`. Теперь:
#   1. коммит должен быть в `origin/main` (ветка выкладки не обгоняет и не обходит main);
#   2. все проверки workflow `checks` на этом коммите завершены и зелёные: задачи из REQUIRED_CHECKS
#      (по умолчанию fast, ui, bot; `db` молчит, пока минуты Actions не восстановлены) обязательны, остальные не
#      должны быть красными;
#   3. перемотка только вперёд: `release` должна быть предком коммита, иначе это откат, его делают руками (§4);
#   4. стойка (api, web) выкладывается по этому `release` только после «да» владельца (AGENTS.md §18):
#      скрипт спрашивает подтверждение, `--yes` его пропускает (для владельца в терминале).
#
#   scripts/ops/promote-release.sh <sha|ветка> [--yes] [--dry-run]
#
# Проверки читаются через `gh api` (если есть) или curl с GITHUB_TOKEN. Токен в вывод не попадает.
# RELEASE_REPO   владелец/репозиторий (GAIVER007/wetop.ai)
# RELEASE_BRANCH ветка выкладки (release); RELEASE_BASE: ветка, из которой берут вершины (main)
# REQUIRED_CHECKS имена обязательных задач через запятую
set -euo pipefail

REPO="${RELEASE_REPO:-GAIVER007/wetop.ai}"
BRANCH="${RELEASE_BRANCH:-release}"
BASE="${RELEASE_BASE:-main}"
REQUIRED="${REQUIRED_CHECKS:-lint · typecheck · unit · главная,стойка на синтетическом API (tests/ui),ИИ-помощник и продавец · pytest (apps/ai-seller)}"
yes=0; dry=0; ref=""
for arg in "$@"; do
  case "$arg" in
    --yes) yes=1 ;;
    --dry-run) dry=1 ;;
    -*) echo "promote-release: неизвестный флаг $arg" >&2; exit 2 ;;
    *) ref="$arg" ;;
  esac
done
[ -n "$ref" ] || { echo "promote-release: укажите коммит или ветку: scripts/ops/promote-release.sh <sha> [--yes] [--dry-run]" >&2; exit 2; }

say() { printf 'promote-release: %s\n' "$*"; }

git fetch --quiet origin "$BASE" "$BRANCH"
target="$(git rev-parse --verify --quiet "${ref}^{commit}" || true)"
[ -n "$target" ] || target="$(git rev-parse --verify --quiet "origin/${ref}^{commit}" || true)"
[ -n "$target" ] || { say "не узнаю «$ref»: нет такого коммита или ветки"; exit 2; }
short="$(git rev-parse --short=8 "$target")"

git merge-base --is-ancestor "$target" "origin/$BASE" || { say "$short не в origin/$BASE: ветка выкладки берёт только вершины из $BASE"; exit 1; }
current="$(git rev-parse "origin/$BRANCH")"
if [ "$current" = "$target" ]; then say "origin/$BRANCH уже на $short"; exit 0; fi
git merge-base --is-ancestor "$current" "$target" || { say "origin/$BRANCH ($(git rev-parse --short=8 "$current")) не предок $short: это откат, он делается руками (docs/deploy.md §4)"; exit 1; }

# Проверки GitHub на этом коммите: все завершены, обязательные зелёные, остальные не красные.
# gh отдаёт по одному объекту check-run на строку (--jq по страницам), curl: одну страницу целиком.
checks_json() {
  if command -v gh >/dev/null 2>&1; then
    gh api --paginate "repos/$REPO/commits/$target/check-runs?per_page=100" --jq '.check_runs[]'
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    # Токен через --config из stdin: аргументы процесса видны всем через ps
    printf 'header = "Authorization: Bearer %s"\n' "$GITHUB_TOKEN" |
      curl -fsS --config - -H 'Accept: application/vnd.github+json' \
        "https://api.github.com/repos/$REPO/commits/$target/check-runs?per_page=100"
  else
    say 'нечем прочитать проверки: нужен gh (вошедший) или GITHUB_TOKEN в окружении'; exit 2
  fi
}
verdict="$(checks_json | REQUIRED="$REQUIRED" node -e '
  let raw = "";
  process.stdin.on("data", (c) => (raw += c)).on("end", () => {
    let runs = [];
    try {
      const whole = JSON.parse(raw);
      runs = Array.isArray(whole) ? whole : whole.check_runs ?? [];
    } catch {
      for (const line of raw.split("\n")) if (line.trim()) runs.push(JSON.parse(line));
    }
    const required = process.env.REQUIRED.split(",").map((s) => s.trim()).filter(Boolean);
    const byName = new Map();
    for (const r of runs) byName.set(r.name, r); // последняя попытка задачи стоит позже
    const problems = [];
    for (const name of required) {
      const r = byName.get(name);
      if (!r) problems.push(`обязательная «${name}» на коммите не запускалась`);
      else if (r.status !== "completed") problems.push(`«${name}» ещё идёт (${r.status})`);
      else if (r.conclusion !== "success") problems.push(`«${name}» красная (${r.conclusion})`);
    }
    for (const r of byName.values()) {
      if (required.includes(r.name)) continue;
      if (r.status === "completed" && ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion))
        problems.push(`«${r.name}» красная (${r.conclusion})`);
    }
    if (runs.length === 0) problems.push("на коммите нет ни одной проверки");
    process.stdout.write(problems.length ? "FAIL\n" + problems.join("\n") + "\n" : "OK\n");
  });
')"
if [ "$(printf '%s\n' "$verdict" | head -1)" != OK ]; then
  say "$short не перематывается: проверки не зелёные"
  printf '%s\n' "$verdict" | tail -n +2 | sed 's/^/  /'
  exit 1
fi
say "проверки на $short зелёные: $REQUIRED"

if [ "$dry" = 1 ]; then say "dry-run: origin/$BRANCH осталась на $(git rev-parse --short=8 "$current")"; exit 0; fi
if [ "$yes" != 1 ]; then
  printf 'Выложить стойку: перемотать origin/%s на %s (%s)? Нужно «да» владельца (AGENTS.md §18) [да/нет]: ' "$BRANCH" "$short" "$(git log -1 --format=%s "$target")"
  read -r answer
  case "$answer" in да|y|yes|Y|Да) ;; *) say 'отменено, origin/'"$BRANCH"' не тронута'; exit 1 ;; esac
fi
git push origin "$target:refs/heads/$BRANCH"
say "origin/$BRANCH → $short. Сервер заберёт её сам в течение двух минут (docs/deploy.md §1д); миграции в обновлении остановят выкладку до владельца"
