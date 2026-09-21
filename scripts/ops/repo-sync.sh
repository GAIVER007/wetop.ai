#!/usr/bin/env bash
# Связь рабочей папки с репозиторием GAIVER007/wetop.ai. Одна команда отвечает: та ли это папка, отстала ли
# она от GitHub, в ТОЙ ли папке launchd держит API, стойку и синхронизацию Exely, на месте ли .env,
# зависимости и сборка стойки — и чинит то, что чинится без человека.
#
# 16.09.2026: папка проекта на Mac переименована («Pms Lux» → «WETOP»). Путь к папке вшит в каждый plist
# launchd абсолютно (install.sh, ключ WorkingDirectory): после переименования launchd не может сделать chdir
# и молча не поднимает ни одну службу — раз в 15 с. 15.09.2026 та же папка отставала от `main` на 62 коммита,
# и API работал на старом коде. Ни то ни другое не видно ни в стойке, ни в журнале — только отсюда.
#
#   scripts/ops/repo-sync.sh                    проверить и напечатать, что делать (ничего не меняет)
#   scripts/ops/repo-sync.sh --pull             подтянуть origin/main: только fast-forward и только чистое дерево
#   scripts/ops/repo-sync.sh --relink           перевести службы launchd на ЭТУ папку (uninstall.sh + install.sh)
#   scripts/ops/repo-sync.sh --from "<папка>"   перенести из старой папки то, чего нет в git: .env,
#                                               project-input/*, design/reference/exely, .claude/settings.local.json;
#                                               то, что здесь уже есть, не перезаписывается
#   scripts/ops/repo-sync.sh --fix              = --pull --relink, плюс: npm install / npm ci и клиент Prisma, если
#                                               зависимости устарели или нативные модули не той платформы; пересборка
#                                               стойки, если она старше кода; возврат webhook Channex на постоянный
#                                               адрес; перезапуск api и web через launchctl kickstart
#   scripts/ops/repo-sync.sh --dir "<папка>"    проверять не текущую папку, а указанную
#
# Код выхода: 0 — всё сходится; 1 — есть что сделать (строки со стрелкой); 2 — папка не связана с репозиторием.
# Содержимое .env не читается и не печатается (SECURITY.md §3): только «есть» или «нет».
set -u

EXPECT_REMOTE="${EXPECT_REMOTE:-GAIVER007/wetop.ai}"
BRANCH="${BRANCH:-main}"
API_URL="${API_URL:-http://127.0.0.1:3001}"
restart_api=0; restart_web=0
PULL=0; RELINK=0; FIX=0; FROM=""; DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --pull) PULL=1 ;;
    --relink) RELINK=1 ;;
    --fix) PULL=1; RELINK=1; FIX=1 ;;
    --from) shift; FROM="${1:-}" ;;
    --from=*) FROM="${1#--from=}" ;;
    --dir) shift; DIR="${1:-}" ;;
    --dir=*) DIR="${1#--dir=}" ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    # zsh без INTERACTIVE_COMMENTS отдаёт «# комментарий» из строки команды скрипту как аргументы (Mac, 16.09.2026)
    \#*) break ;;
    *) echo "неизвестно: $1 (есть --pull, --relink, --from <папка>, --fix, --dir <папка>)"; exit 2 ;;
  esac
  shift
done

todo=0
need() { todo=$((todo + 1)); printf '  → %s\n' "$1"; }
ok()   { printf '  ✓ %s\n' "$1"; }
bad()  { printf '  ✗ %s\n' "$1"; }
info() { printf '  · %s\n' "$1"; }
lower() { printf '%s' "$1" | tr 'A-Z' 'a-z'; }
realdir() { (cd "$1" 2>/dev/null && pwd -P); }

# ---------- 1. Папка и remote ----------
if [ -n "$DIR" ]; then
  cd "$DIR" 2>/dev/null || { echo "✗ нет папки: $DIR"; exit 2; }
fi
if ! ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "✗ $(pwd): папка не под git — это не репозиторий проекта."
  echo "  Клон: git clone https://github.com/$EXPECT_REMOTE.git"
  exit 2
fi
cd "$ROOT" || exit 2
ROOT_P="$(pwd -P)"
url="$(git remote get-url origin 2>/dev/null || true)"
expect_lc="$(lower "$EXPECT_REMOTE")"
case "$(lower "$url")" in
  *"$expect_lc"*) ;;
  "")
    echo "✗ $ROOT: у папки нет remote origin — с GitHub она не связана."
    echo "  git remote add origin https://github.com/$EXPECT_REMOTE.git && git fetch origin $BRANCH"
    exit 2 ;;
  *)
    echo "✗ $ROOT: origin указывает на $url, а не на github.com/$EXPECT_REMOTE."
    echo "  Это чужой репозиторий; ничего не делаю. Поправить: git remote set-url origin https://github.com/$EXPECT_REMOTE.git"
    exit 2 ;;
esac
echo "Папка: $ROOT"
ok "origin → $url"

# ---------- 2. Git: отставание, локальные коммиты, правки ----------
if ! git fetch --quiet origin "$BRANCH" 2>/dev/null; then
  bad "не удалось получить origin/$BRANCH с GitHub (сеть или доступ) — сравниваю с последним известным"
fi
if ! git rev-parse --verify -q "origin/$BRANCH" >/dev/null 2>&1; then
  bad "в папке нет origin/$BRANCH: git fetch origin $BRANCH"
  need "получить origin/$BRANCH: git fetch origin $BRANCH"
  echo; echo "Итог: пунктов к исполнению — $todo."; exit 1
fi
head_short="$(git rev-parse --short HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
ahead="$(git rev-list --count "origin/$BRANCH..HEAD")"
behind="$(git rev-list --count "HEAD..origin/$BRANCH")"
# Файлы, которые переписывает сборка: считать их работой для человека нельзя, а прятать — врать.
# `next build`, `next dev` и UI-тесты (distDir `.next-ui`) пишут в next-env.d.ts разные строки, и файл
# «изменён» после любого из них (17.09.2026: пункт к исполнению на полностью чистой папке).
GENERATED_RE='^apps/web/next-env\.d\.ts$'
dirty_paths() { git status --porcelain --untracked-files=no | sed 's/^...//'; }
generated_dirty="$(dirty_paths | grep -E "$GENERATED_RE" || true)"
modified="$(dirty_paths | grep -vE "$GENERATED_RE" | grep -c . || true)"
untracked="$(git status --porcelain --untracked-files=normal | grep -c '^??' || true)"
echo "Git: ветка $branch, коммит $head_short; origin/$BRANCH $(git rev-parse --short "origin/$BRANCH")"
[ "$branch" != "$BRANCH" ] && bad "ветка $branch — стойка работает с $BRANCH (git checkout $BRANCH)"
pulled=0
if [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
  bad "ветки разошлись: отстаёт от origin/$BRANCH на $behind, впереди origin/$BRANCH на $ahead"
  need "разобрать руками: git log --oneline origin/$BRANCH...HEAD; как сливать — решает владелец"
elif [ "$behind" -gt 0 ]; then
  bad "отстаёт от origin/$BRANCH на $behind — службы работают на старом коде"
  if [ "$PULL" -eq 1 ]; then
    if [ "$modified" -gt 0 ]; then
      need "--pull не трогает дерево с незакоммиченными правками: закоммитить своими файлами или убрать (git stash)"
    elif [ "$branch" != "$BRANCH" ]; then
      need "--pull только на $BRANCH: git checkout $BRANCH, затем снова --pull"
    else
      # сгенерированные сборкой файлы возвращаем: иначе fast-forward отменится из-за файла, который
      # всё равно перепишется следующей сборкой
      [ -n "$generated_dirty" ] && printf '%s\n' "$generated_dirty" | while IFS= read -r f; do
        [ -n "$f" ] && git checkout -- "$f" 2>/dev/null
      done
      generated_dirty=""
    fi
    if [ "$modified" -eq 0 ] && [ "$branch" = "$BRANCH" ] && git merge --ff-only --quiet "origin/$BRANCH" >/dev/null 2>&1; then
      ok "подтянул origin/$BRANCH: $head_short → $(git rev-parse --short HEAD)"
      pulled=1; restart_api=1; restart_web=1
    elif [ "$modified" -eq 0 ] && [ "$branch" = "$BRANCH" ]; then
      need "fast-forward не удался: git merge --ff-only origin/$BRANCH и смотреть, что мешает"
    fi
  else
    need "подтянуть: scripts/ops/repo-sync.sh --pull"
  fi
elif [ "$ahead" -gt 0 ]; then
  bad "впереди origin/$BRANCH на $ahead — на GitHub этих коммитов нет"
  need "отправить: git push -u origin $BRANCH (запускает владелец)"
else
  ok "совпадает с origin/$BRANCH"
fi
if [ "$modified" -gt 0 ]; then
  bad "незакоммиченных правок: $modified"
  dirty_paths | grep -vE "$GENERATED_RE" | head -10 | sed 's/^/      /'
  [ "$pulled" -eq 1 ] || [ "$behind" -eq 0 ] && need "закоммитить своими файлами (явным списком, не git add -A) или убрать (git stash)"
fi
if [ -n "$generated_dirty" ]; then
  info "переписан сборкой, к работе не относится: $(printf '%s' "$generated_dirty" | tr '\n' ' ')— вернуть: git checkout -- $(printf '%s' "$generated_dirty" | tr '\n' ' ')"
fi
[ "$untracked" -gt 0 ] && info "неотслеживаемых файлов: $untracked (git status)"

# ---------- 3. Вторая копия репозитория рядом ----------
parent="$(realdir "$ROOT/..")"
for d in "$parent"/*/; do
  d="${d%/}"
  [ -d "$d/.git" ] || continue
  [ "$(realdir "$d")" = "$ROOT_P" ] && continue
  case "$(lower "$(git -C "$d" remote get-url origin 2>/dev/null || true)")" in
    *"$expect_lc"*)
      bad "ещё одна копия репозитория рядом: $d ($(git -C "$d" log -1 --format='%h от %cd' --date=short 2>/dev/null || echo 'без коммитов'))"
      need "оставить одну папку: службы launchd, .env, тесты и синхронизация Exely живут в одной (AGENTS.md §17)" ;;
  esac
done

# ---------- 4. Службы launchd: в какой папке они держат PMS ----------
AGENTS="${LAUNCH_AGENTS:-$HOME/Library/LaunchAgents}"
DOMAIN_CONFIG="$HOME/.cloudflared/wetop.yml"
UID_N="$(id -u)"
stale=(); here=(); any=0; quick=0; domain_installed=0
plist_workdir() {
  sed -n 's#.*<key>WorkingDirectory</key><string>\([^<]*\)</string>.*#\1#p' "$1" | head -1 |
    sed -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g'
}
for n in api web tunnel domain awake exely-sync; do
  f="$AGENTS/kz.luxx.pms.$n.plist"
  [ -f "$f" ] || continue
  any=1
  wd="$(plist_workdir "$f")"
  loaded=""
  launchctl print "gui/$UID_N/kz.luxx.pms.$n" >/dev/null 2>&1 && loaded=" (загружена)"
  [ "$n" = domain ] && domain_installed=1
  # Служба exely-sync снята 19.09.2026 вместе с автосинхронизацией из Exely (ADR-052), и install.sh такого
  # имени больше не знает. На машинах, где она стояла, plist остаётся лежать. Прогон 20.09.2026: он попадал
  # в список на перевод, install.sh падал на неизвестном имени — и вместе с ним не переводились api и web,
  # а значит не перезапускался API. Поэтому такой plist не переводим, а снимаем.
  if [ "$n" = exely-sync ]; then
    if [ "$RELINK" -eq 1 ]; then
      bash "$ROOT/scripts/ops/launchd/uninstall.sh" exely-sync 2>&1 | sed 's/^/      /'
      ok "служба exely-sync снята: автосинхронизации из Exely больше нет (ADR-052)"
    else
      bad "служба exely-sync$loaded осталась от снятой автосинхронизации Exely (ADR-052)"
      need "снять: scripts/ops/launchd/uninstall.sh exely-sync (--relink снимет сам)"
    fi
    continue
  fi
  # Быстрый туннель не запускается ни на одной машине, пока в Channex стоит постоянный адрес (отчёт 77c8085,
  # 16.09.2026): он уводит webhook на одноразовый адрес, который умирает вместе с ним. Вечером 16.09 --relink
  # переустановил его на втором компьютере разработчика, где wetop.yml нет, и адрес снова был перебит.
  # Переустанавливать быстрый туннель на новую папку — не чинить, а ломать; осознанный запуск — руками.
  if [ "$n" = tunnel ]; then
    quick=1
    bad "служба tunnel$loaded — быстрый туннель: с 16.09.2026 не запускается ни на одной машине, пока в Channex постоянный адрес"
    continue
  fi
  if [ -n "$wd" ] && [ "$(realdir "$wd")" = "$ROOT_P" ]; then
    here+=("$n")
  else
    stale+=("$n")
    if [ -d "$wd" ]; then where="другая папка"; else where="такой папки больше нет, launchd не может её открыть"; fi
    bad "служба $n$loaded держит PMS в «${wd:-?}» — $where"
  fi
done
if [ "$any" -eq 0 ]; then
  info "служб launchd нет; на машине стойки их ставит scripts/ops/launchd/install.sh"
fi
if [ "$quick" -eq 1 ]; then
  if [ "$RELINK" -eq 1 ]; then
    bash "$ROOT/scripts/ops/launchd/uninstall.sh" tunnel 2>&1 | sed 's/^/      /'
    ok "быстрый туннель снят"
  else
    need "снять быстрый туннель: scripts/ops/launchd/uninstall.sh tunnel (--relink снимет сам; осознанно — ALLOW_QUICK_TUNNEL=1 scripts/ops/channex-tunnel.sh)"
  fi
fi
if [ -f "$DOMAIN_CONFIG" ] && [ "$domain_installed" -eq 0 ]; then
  bad "постоянный туннель wetop.ai (domain) не установлен, хотя $DOMAIN_CONFIG есть — без него app.wetop.ai и api.wetop.ai молчат"
  need "поставить постоянный туннель: scripts/ops/launchd/install.sh domain"
fi
if [ ${#stale[@]} -gt 0 ]; then
  if [ "$RELINK" -eq 1 ]; then
    echo "  → перевожу службы на эту папку: ${stale[*]}"
    bash "$ROOT/scripts/ops/launchd/uninstall.sh" ${stale[@]+"${stale[@]}"} 2>&1 | sed 's/^/      /'
    bash "$ROOT/scripts/ops/launchd/install.sh" ${stale[@]+"${stale[@]}"} 2>&1 | sed 's/^/      /'
    for n in ${stale[@]+"${stale[@]}"}; do
      f="$AGENTS/kz.luxx.pms.$n.plist"
      if [ -f "$f" ] && [ "$(realdir "$(plist_workdir "$f")")" = "$ROOT_P" ]; then
        ok "служба $n теперь в этой папке"
        here+=("$n")
      else
        need "служба $n не переведена — смотреть вывод install.sh выше и ~/Library/Logs/pms-lux/$n.log"
      fi
    done
  else
    need "перевести службы на эту папку: scripts/ops/repo-sync.sh --relink"
  fi
fi
[ ${#here[@]} -gt 0 ] && ok "службы launchd в этой папке: ${here[*]}"
if [ "$pulled" -eq 1 ] && [ ${#here[@]} -gt 0 ] && [ "$FIX" -eq 0 ]; then
  need "код обновился — перезапустить API: launchctl kickstart -k gui/$UID_N/kz.luxx.pms.api"
  need "стойка на production-сборке: npm run build -w apps/web && launchctl kickstart -k gui/$UID_N/kz.luxx.pms.web"
fi

# ---------- 5. То, чего нет в git: .env, выгрузки, личные настройки ----------
LOCAL_ONLY=".env .claude/settings.local.json project-input/exely project-input/exely-screens project-input/forms project-input/interviews design/reference/exely"
if [ -n "$FROM" ]; then
  if [ ! -d "$FROM" ]; then
    bad "--from: нет папки $FROM"
    need "указать существующую старую папку: --from \"<папка>\""
  elif [ "$(realdir "$FROM")" = "$ROOT_P" ]; then
    bad "--from: это та же папка"
  else
    FROM_P="$(realdir "$FROM")"
    copied=0
    for rel in $LOCAL_ONLY; do
      src="$FROM_P/$rel"
      if [ -f "$src" ]; then
        if [ -e "$ROOT/$rel" ]; then
          info "$rel уже есть здесь — оставил как есть"
        else
          mkdir -p "$(dirname "$ROOT/$rel")"
          cp -p "$src" "$ROOT/$rel" && { ok "перенёс $rel"; copied=$((copied + 1)); }
        fi
      elif [ -d "$src" ]; then
        n=0
        while IFS= read -r file; do
          relf="${file#"$FROM_P"/}"
          [ -e "$ROOT/$relf" ] && continue
          mkdir -p "$(dirname "$ROOT/$relf")"
          cp -p "$file" "$ROOT/$relf" && n=$((n + 1))
        done < <(find "$src" -type f ! -name .DS_Store)
        if [ "$n" -gt 0 ]; then ok "перенёс $rel: файлов $n"; copied=$((copied + n)); fi
      fi
    done
    [ "$copied" -eq 0 ] && info "из $FROM переносить нечего: всё уже здесь"
  fi
fi
if [ -f "$ROOT/.env" ]; then
  ok ".env на месте (содержимое не читаю; проверка ключей — npx tsx scripts/imports/src/cli-check-env.ts)"
else
  bad ".env нет — без ключей не работают API, синхронизация Exely и Channex"
  need "вписать ключи по .env.example (владелец) или перенести из старой папки: scripts/ops/repo-sync.sh --from \"<папка>\""
fi
for rel in project-input/exely project-input/exely-screens design/reference/exely; do
  [ -d "$ROOT/$rel" ] || continue
  cnt="$(find "$ROOT/$rel" -type f ! -name README.md ! -name .gitkeep ! -name .DS_Store | wc -l | tr -d ' ')"
  if [ "$cnt" -gt 0 ]; then info "$rel: файлов $cnt (не в git)"; else info "$rel: пусто (не в git; --from перенесёт из старой папки)"; fi
done

# ---------- 6. Зависимости, клиент Prisma, сборка стойки ----------
install_deps() {
  if (cd "$ROOT" && npm install --no-audit --no-fund); then ok "npm install выполнен"; restart_api=1; else need "npm install упал — смотреть вывод"; fi
}
if [ ! -d "$ROOT/node_modules" ]; then
  bad "node_modules нет"
  if [ "$FIX" -eq 1 ]; then install_deps; else need "npm install"; fi
elif [ "$ROOT/package-lock.json" -nt "$ROOT/node_modules/.package-lock.json" ]; then
  bad "package-lock.json новее установленных зависимостей"
  if [ "$FIX" -eq 1 ]; then install_deps; else need "npm install"; fi
else
  ok "зависимости соответствуют package-lock.json"
fi
# Нативные модули под эту платформу. esbuild нужен tsx, то есть API и скриптам; swc — сборке стойки. Ночь на
# 17.09.2026: после npm install на ноутбуке esbuild остался под другую платформу, API упал 101 раз подряд, а
# status.sh показывал только «spawn scheduled». Проверка — попробовать загрузить модуль тем же node.
if [ -d "$ROOT/node_modules" ] && command -v node >/dev/null 2>&1; then
  if [ -d "$ROOT/node_modules/esbuild" ] && ! (cd "$ROOT" && node -e "require('esbuild')" >/dev/null 2>&1); then
    bad "esbuild не запускается на этой платформе — tsx, а с ним API и скрипты, падают на старте"
    if [ "$FIX" -eq 1 ]; then
      if (cd "$ROOT" && npm ci); then
        ok "npm ci выполнен: зависимости ровно по package-lock.json"
        if [ -d "$ROOT/packages/database" ]; then
          (cd "$ROOT" && npm run generate -w @pms/database >/dev/null) && ok "клиент Prisma сгенерирован" || need "npm run generate -w @pms/database упал"
        fi
        restart_api=1
      else
        need "npm ci упал — смотреть вывод"
      fi
    else
      need "переустановить зависимости ровно по package-lock.json: npm ci, затем клиент Prisma и перезапуск API (--fix сделает сам)"
    fi
  fi
  if [ "$(uname -s)" = Darwin ]; then
    swc="@next/swc-darwin-$(uname -m | sed 's/x86_64/x64/')"
    if [ -d "$ROOT/node_modules/$swc" ] && ! (cd "$ROOT" && node -e "require('$swc')" >/dev/null 2>&1); then
      bad "$swc не загружается (подпись или платформа) — next build без него не работает"
      need "переустановить: rm -rf node_modules/$swc && npm install"
    fi
  fi
fi
if [ -d "$ROOT/packages/database" ] && [ -d "$ROOT/node_modules" ]; then
  if [ -d "$ROOT/packages/database/src/generated" ]; then
    ok "клиент Prisma сгенерирован"
  else
    bad "клиента Prisma нет — API и typecheck не соберутся"
    if [ "$FIX" -eq 1 ]; then
      (cd "$ROOT" && npm run generate -w @pms/database >/dev/null) && ok "клиент Prisma сгенерирован" || need "npm run generate -w @pms/database упал"
    else
      need "npm run generate -w @pms/database"
    fi
  fi
fi
if [ -d "$ROOT/apps/web" ]; then
  build_id="$ROOT/apps/web/.next/BUILD_ID"
  if [ ! -f "$build_id" ]; then
    info "production-сборки стойки нет — служба web соберёт её при старте (scripts/ops/launchd/web-start.mjs)"
  elif [ -n "$(find "$ROOT/apps/web/src" "$ROOT/packages" -type f ! -path '*/node_modules/*' ! -path '*/generated/*' -newer "$build_id" -print 2>/dev/null | head -1)" ]; then
    bad "сборка стойки старше кода"
    if [ "$FIX" -eq 1 ]; then
      if (cd "$ROOT" && npm run build -w apps/web); then ok "стойка пересобрана"; restart_web=1; else need "сборка стойки упала — смотреть вывод"; fi
    else
      need "пересобрать стойку: npm run build -w apps/web && launchctl kickstart -k gui/$UID_N/kz.luxx.pms.web"
    fi
  else
    ok "сборка стойки не старше кода"
  fi
fi

# ---------- 7. Webhook Channex: адрес в Channex против постоянного ----------
# 16–17.09.2026: в Channex дважды оставался адрес мёртвого быстрого туннеля, сторож исчерпывал попытки, брони
# шли только опросом ленты. Возврат — тот же вызов, что кнопка «Зарегистрировать webhook» на /channels.
status_body="$(curl -s -m 10 "$API_URL/channels/channex/webhook/status" 2>/dev/null || true)"
if printf '%s' "$status_body" | grep -q '"registered":'; then
  wh_field() { printf '%s' "$status_body" | grep -o -E "\"$1\":\"[^\"]*\"" | head -1 | sed -E "s/^\"$1\":\"(.*)\"$/\1/"; }
  wh_expected="$(wh_field expectedUrl)"
  wh_current="$(wh_field callbackUrl)"
  if [ -n "$wh_expected" ] && [ "$wh_current" != "$wh_expected" ]; then
    bad "в Channex записан webhook «${wh_current:-нет}», а постоянный адрес — $wh_expected: брони доходят только опросом ленты"
    if [ "$FIX" -eq 1 ]; then
      reg="$(curl -s -m 60 -X POST -H 'content-type: application/json' -d "{\"callbackUrl\":\"$wh_expected\"}" "$API_URL/channels/channex/webhook/register" 2>/dev/null || true)"
      if printf '%s' "$reg" | grep -q -F "\"callbackUrl\":\"$wh_expected\""; then
        ok "webhook перерегистрирован на $wh_expected"
      else
        need "перерегистрация webhook не прошла (${reg:-нет ответа}) — кнопка «Зарегистрировать webhook» на /channels"
      fi
    else
      need "вернуть webhook на постоянный адрес: scripts/ops/repo-sync.sh --fix (или кнопка на /channels)"
    fi
  elif [ -n "$wh_expected" ]; then
    ok "webhook Channex на постоянном адресе $wh_expected"
  else
    info "постоянный адрес webhook (PUBLIC_API_URL) не задан — адрес в Channex не сверяю"
  fi
else
  info "API на $API_URL не отвечает — адрес webhook в Channex не проверен"
fi

# ---------- 8. Перезапуск служб на новом коде (--fix) ----------
restart_service() {
  local f="$AGENTS/kz.luxx.pms.$1.plist"
  if [ ! -f "$f" ] || [ "$(realdir "$(plist_workdir "$f")")" != "$ROOT_P" ]; then
    info "служба $1 не в этой папке — не перезапускаю"
    return
  fi
  if launchctl kickstart -k "gui/$UID_N/kz.luxx.pms.$1" >/dev/null 2>&1; then
    if [ "$1" = api ]; then ok "API перезапущен на новом коде"; else ok "стойка перезапущена на новой сборке"; fi
  else
    need "перезапустить $1: launchctl kickstart -k gui/$UID_N/kz.luxx.pms.$1"
  fi
}
if [ "$FIX" -eq 1 ] && command -v launchctl >/dev/null 2>&1; then
  [ "$restart_api" -eq 1 ] && restart_service api
  [ "$restart_web" -eq 1 ] && restart_service web
fi

# ---------- Итог ----------
echo
if [ "$todo" -eq 0 ]; then
  echo "Итог: папка связана с github.com/$EXPECT_REMOTE, совпадает с origin/$BRANCH, службы и файлы на месте — делать нечего."
  exit 0
fi
echo "Итог: пунктов к исполнению — $todo (строки со стрелкой выше)."
exit 1
