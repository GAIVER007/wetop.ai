# Миграции, которые ждут своего релиза

ADR-137, замечание ментора 02.10.2026.

Миграция «отдельного релиза» не лежит в `../migrations/`, пока её релиз не начался. Всё, что лежит в
`migrations/`, применяет `prisma migrate deploy`, проверяет `scripts/ops/check-migrations.sh` и считает новым
`scripts/ops/auto-deploy.sh`. Миграция, которую можно применять только после выкладки определённого кода
(сужение схемы, шаг contract в порядке expand/switch/contract), в общей цепочке уйдёт в базу вместе с соседними,
и прежний код на ней сломается. Так могло случиться с 039 (`seller_profile_agent_key`, SA2.5 «сузить»): её
применили отдельным шагом 30.09.2026, но до этого она лежала в общей цепочке с пометкой «ОТДЕЛЬНЫЙ РЕЛИЗ».

## Порядок

1. Миграцию готовят здесь: папка `<метка времени>_<имя>/` с `migration.sql` и `down.sql` (AGENTS.md §14).
   В первых строках `migration.sql` метка `-- 🔴 ОТДЕЛЬНЫЙ РЕЛИЗ (<документ с порядком релиза>)` и условие,
   после которого её можно применять.
2. `schema.prisma` эту миграцию не опережает: изменение схемы под неё входит в коммит релиза. Иначе проверка
   миграций (schema.prisma против базы, собранной из `migrations/`) покраснеет.
3. Релиз, по «да» владельца: одним коммитом папка переезжает в `migrations/` (`git mv`; метку времени при
   необходимости сдвигают, чтобы миграция шла после последней в цепочке), в том же коммите `schema.prisma`
   и код. Применяет миграцию владелец (AGENTS.md §15), затем выкладка: `auto-deploy.sh --migrations-applied <sha>`.
4. Выпущенную миграцию вносят в список `RELEASED_SEPARATELY` в `tests/unit/migrations-hold.test.ts`:
   с меткой «ОТДЕЛЬНЫЙ РЕЛИЗ» в `migrations/` лежат только выпущенные.

## Кто читает эту папку

Никто из инструментов: `prisma.config.ts` (`prisma/migrations`), `check-migrations.sh`,
`tests/tools/test-schema.ts` и `auto-deploy.sh` смотрят только в `migrations/`. Сторож порядка:
`tests/unit/migrations-hold.test.ts`.

Бот (`apps/ai-seller`, Alembic) держит такую границу иначе: запуск образа доходит только до 0009, а 0010 и 0011
применяются отдельно (DECISIONS.md, «граница миграций при запуске seller runtime»).

## Подготовка и применение различаются

18.10.2026 владелец отдельно разрешил подготовить Beauty-блок133-137, без production-применения. Его точный PREPARED_NOT_APPLIED manifest хранится в `../beauty-release-preparation.json`: все десять SQL проверяются по SHA-256, обязательны отдельный полный гейт, pinned production approval, backup/restore и trusted cutover runner; automatic apply запрещён. Сторож признаёт только этот полный конкретный одобренный пакет, а RELEASED_SEPARATELY остаётся списком реально применённых. Отказ auto-deploy при новых миграциях не меняется.

## Сейчас ждут

114 expense links, 115 table occupancy, 116 restaurant capacity + opening.sql,
117 beauty workload, 118 hospitality workload: пять held-папок, шесть SQL apply-файлов owner-home.
Ничего не перенесено в общую цепочку. `owner-home-release.sql` задаёт точный порядок
в одной транзакции с ON_ERROR_STOP; это не разрешение выполнять его в production.
Offline-проверка: `node tests/tools/held-release-manifest.mjs --dry-run` печатает SHA-256
runner, шести apply и пяти down в обратном порядке. Снимок: reports/held-release-manifest.json.

Beauty zapis release подготовлен в ordinary133-137, но НЕ применён в production. Ниже его исторические held-имена:

1. `20261018000131_beauty_appointment_lines`
2. `20261018000132_beauty_reviews`
3. `20261018000133_beauty_materials`
4. `20261018000134_beauty_positions`
5. `20261018000135_beauty_location_hours`

Эти номера являются held-именами, а не именами будущей ordinary chain. В текущем `main` номера 131 и 132 уже заняты customer phone normalization и customer imports. Перед release весь Beauty-блок переносится одним commit под следующими свободными последовательными именами, предварительно 133-137. Точный manifest, зависимости, backup, validation, SHA и reverse order: `docs/ops/beauty-zapis-release.md`. Все пять forward SQL транзакционные. Production application требует отдельного явного разрешения владельца.

Down допускается только для полностью пустого, никогда не наблюдавшего историю состояния:
118 → 117 → 116 (включая opening) → 115 → 114. Любая строка, включая отменённую,
и любой nonnull currency_snapshot блокирует откат. Источники и owned-таблицы блокируются
ACCESS EXCLUSIVE до guard и teardown; READ COMMITTED обновляет snapshot после ожидания.
Search path фиксируется на выбранную схему без public fallback; CASCADE не используется.
Populated/partial schema требует сохранения hooks/history и согласованного forward repair.

Локальная synthetic-репетиция НЕ доказывает production baseline, backup/restore, runtime RLS,
валидность business fixtures или конкурентную нагрузку. Она клонирует metadata без source FK/triggers;
malformed retained fixtures изолированы savepoint. Реальная проверка backup/restore остаётся блокером.

- Подготовленная `20261018000137_beauty_location_hours` (исходная held135): утверждённые часы салона и граница новой записи. Требует appointment lines и совместимого API; production применяет владелец только по отдельному разрешению и общему release manifest.
