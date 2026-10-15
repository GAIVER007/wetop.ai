#!/usr/bin/env bash
# Убирает снимки (PNG/JPG/WEBP) из папок reports/ по закрытым срезам.
# Разборы README.md и прочие тексты остаются: они весят килобайты и служат доказательством.
#
# Составлено 02.10.2026. Запускать из корня репозитория:
#   bash reports/supabase-cleanup-2026-10-02/prune-screenshots.sh --dry-run   # посмотреть
#   bash reports/supabase-cleanup-2026-10-02/prune-screenshots.sh             # удалить
#
# ВАЖНО: из истории git снимки при этом не исчезнут, папка .git останется около 291 МБ.
# Уменьшится только рабочая копия. Чтобы убрать их из истории, нужна перезапись
# истории общей ветки, а это отдельное решение владельца.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Срезы, снимки которых ещё нужны: владелец их не принял, они ждут взгляда.
KEEP=(
  top-menu-2026-10-02                 # текущий срез, за владельцем взгляд на снимки
  property-settings-set4-2026-09-29   # за владельцем снимки SET4
  website-web2-2026-09-28             # ждёт визуального да по WEB2
  website-web3-2026-09-28             # ждёт визуального да по WEB3
  website-web4-2026-09-28             # ждёт визуального да по WEB4
  chessboard-v2-pr6-2026-09-28        # ждёт визуального да по PR 6
  integrations-int2-2026-09-28        # снимки стоп-гейта INT2
  platform-p3-branches-2026-10-01     # решение по двум экранам филиалов
  supabase-cleanup-2026-10-02         # эта папка
)

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

total=0

for dir in reports/*/; do
  name="$(basename "$dir")"
  skip=0
  for k in "${KEEP[@]}"; do
    [[ "$name" == "$k" ]] && skip=1 && break
  done
  if (( skip )); then
    echo "оставляю   $name"
    continue
  fi

  mapfile -t shots < <(find "$dir" -type f \( -iname '*.png' -o -iname '*.jpg' \
    -o -iname '*.jpeg' -o -iname '*.webp' \) -print)
  (( ${#shots[@]} == 0 )) && continue

  size=$(du -ch "${shots[@]}" 2>/dev/null | tail -1 | cut -f1)
  echo "убираю     $name: ${#shots[@]} шт., $size"
  total=$(( total + ${#shots[@]} ))

  if (( DRY == 0 )); then
    git rm -q --ignore-unmatch "${shots[@]}" 2>/dev/null || rm -f "${shots[@]}"
  fi
done

echo
if (( DRY )); then
  echo "Это пробный прогон. Снимков под удаление: $total. Ничего не изменено."
else
  echo "Удалено снимков: $total. Проверьте 'git status', затем коммит."
fi
