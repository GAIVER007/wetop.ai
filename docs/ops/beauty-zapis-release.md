# Beauty zapis release: held migrations 131-135

Дата подготовки: 18.10.2026. Этот документ описывает будущий отдельный выпуск схемы для Beauty. Он не разрешает применять SQL в production. Для production migration каждый раз требуется отдельное явное разрешение владельца по AGENTS.md §14-15, свежая резервная копия и проверка восстановления.

## Граница релиза

Текущий `main` уже содержит обычные миграции:

1. `20261018000131_customer_phone_normalized`
2. `20261018000132_customer_imports`

На read-only production-проверке 18.10.2026 deployed SHA `29fd2fda` имел применённую ordinary 131, но ordinary 132 ещё не была применена. Это наблюдение не заменяет повторный `mig status` перед выпуском. Production должна сначала последовательно применить ordinary 132 из точного release SHA, затем Beauty 133-137; Beauty-блок нельзя накатывать поверх базы с pending 132.

Поэтому текущие имена held131-135 нельзя переносить в `migrations/` без переименования. Если перед выпуском в обычной цепочке появится более новая миграция, весь блок получает следующие свободные последовательные номера с сохранением порядка зависимостей.

Предварительный manifest для текущей вершины:

| Порядок | Текущая held-папка | Будущее release-имя | Зависимости |
|---|---|---|---|
| 1 | `20261018000131_beauty_appointment_lines` | `20261018000133_beauty_appointment_lines` | ordinary 044, 109, 130 |
| 2 | `20261018000132_beauty_reviews` | `20261018000134_beauty_reviews` | Beauty appointment lines |
| 3 | `20261018000133_beauty_materials` | `20261018000135_beauty_materials` | Beauty appointment lines; ordinary 089, 090, 093 |
| 4 | `20261018000134_beauty_positions` | `20261018000136_beauty_positions` | ordinary 013, 020, 073 |
| 5 | `20261018000135_beauty_location_hours` | `20261018000137_beauty_location_hours` | Beauty appointment lines |

Ordinary employee portal migrations 128/129 уже находятся в общей цепочке. Held117 Beauty workload не входит в этот выпуск: `BEAUTY_WORKLOAD_CAPTURE` должен оставаться `false`. Включение held117 отдельно требует held116 и отдельного решения владельца. Held114, 115 и 118 также не входят в этот выпуск.

## Подготовка release commit

1. Убедиться, что merge conflicts отсутствуют, `schema.prisma` содержит одновременно Beauty-модели и актуальные модели `main`, а последняя ordinary migration всё ещё 132. Если нет, пересчитать свободные номера.
2. Переместить все пять папок через `git mv` из `migrations-hold/` в `migrations/` под итоговыми именами одного последовательного блока. Не переносить часть блока.
3. В том же commit оставить согласованные `schema.prisma`, API и writers. Добавить выпущенные имена в `RELEASED_SEPARATELY` в `tests/unit/migrations-hold.test.ts` после фактического отдельного применения.
4. Пройти полный release gate на базе, собранной из обычной цепочки migrations. Отдельно проверить fresh apply, populated backfill, RLS service/app roles и отказ каждого empty-only down при retained data.
5. Зафиксировать SHA-256 точных SQL из release commit:

```bash
shasum -a 256 \
  packages/database/prisma/migrations/20261018000133_beauty_appointment_lines/{migration.sql,down.sql} \
  packages/database/prisma/migrations/20261018000134_beauty_reviews/{migration.sql,down.sql} \
  packages/database/prisma/migrations/20261018000135_beauty_materials/{migration.sql,down.sql} \
  packages/database/prisma/migrations/20261018000136_beauty_positions/{migration.sql,down.sql} \
  packages/database/prisma/migrations/20261018000137_beauty_location_hours/{migration.sql,down.sql}
```

Сохранить вывод в release evidence. На сервере перед применением сравнить каждый файл с содержимым точного release SHA, не с изменяемой рабочей директорией:

```bash
git show "$RELEASE_SHA:packages/database/prisma/migrations/20261018000133_beauty_appointment_lines/migration.sql" | shasum -a 256
```

Повторить команду для оставшихся migration/down файлов и сверить с manifest. Не выводить connection strings или содержимое резервной копии.

## Production cutover

1. Получить отдельное явное разрешение владельца именно на применение этих пяти production migrations.
2. Зафиксировать точный release SHA и зелёный `release-checks` для него. Push или merge сами по себе не являются разрешением применять миграции.
3. Создать свежую закрытую резервную копию по `docs/ops/backups.md`. Выполнить `db-restore-check.sh` в изолированной локальной базе и сохранить имя backup, SHA release и результат проверки. Если restore-check не прошёл, остановить выпуск.
4. Включить maintenance и остановить все Beauty, public booking/site-form и stock writers. Старый API остаётся совместим с аддитивной схемой и legacy sync, но записи во время backfill запрещены.
5. Из checkout точного release SHA проверить `mig status`, затем применить обычную цепочку штатным `mig deploy`. Каждый из пяти `migration.sql` содержит собственные `BEGIN/COMMIT`; ошибка statement откатывает соответствующую миграцию. Любая ошибка останавливает cutover, новый API не запускается.
6. Выполнить validation ниже. Только после всех проверок запустить `/usr/local/sbin/wetop-auto-deploy --migrations-applied "$RELEASE_SHA"`. Этот флаг подтверждает уже выполненные миграции, а не применяет их.
7. Проверить deployed SHA, образы, health, авторизованные Beauty calendar/appointment/positions/location-hours, public site booking slots и DONE со складом. Затем снять maintenance.

## Validation до запуска нового API

Проверки выполняются без вывода клиентских данных. Сохраняются только имена объектов, статусы и агрегированные counts.

- В `_prisma_migrations` есть все пять итоговых имён без failed/rolled-back состояния; `mig status` не показывает pending.
- Ordinary `20261018000132_customer_imports` применена раньше Beauty 133-137.
- `to_regclass` находит `appointment_lines`, `employee_service_prices`, `beauty_appointment_reviews`, `beauty_review_invitations`, `beauty_service_materials`, `beauty_service_material_revisions`, `beauty_positions`, `beauty_position_permissions`, `beauty_position_assignments`, `beauty_location_hours`.
- Число appointments равно числу backfilled position 0 lines до включения multi-line writers. Нет appointment без line.
- Сумма `appointment_lines.price_minor` по appointment совпадает с `appointments.price` для backfilled legacy rows.
- Старое ограничение `appointments_no_overlap_per_employee` снято; установлены line overlap, legacy sync, status reactivation и location-hours triggers.
- FK `kitchen_stock_movements.appointment_line_id`, source CHECK и уникальный partial movement index существуют. FOOD_SERVICE stock guard продолжает принимать прежние валидные операции.
- Все RLS tables имеют FORCE RLS; `wetop_app` не пишет reviews, positions и location hours; `wetop_service` имеет только заявленные права.
- Функции guard имеют закреплённый search_path целевой схемы.
- Restricted-role smoke подтверждает: соседняя организация не видит строки, revoked assignment не возвращает legacy-доступ, OWNER path не зависит от assignment.
- Public booking replay возвращает прежний appointment, а занятость учитывает secondary lines.

## Rollback и recovery

Down scripts предназначены только для empty-only отката до первого использования новых моделей. Они не являются обещанием обычного rollback после запуска.

Dependency-safe reverse order:

1. `20261018000137_beauty_location_hours/down.sql`
2. `20261018000136_beauty_positions/down.sql`
3. `20261018000135_beauty_materials/down.sql`
4. `20261018000134_beauty_reviews/down.sql`
5. `20261018000133_beauty_appointment_lines/down.sql`

Перед down вернуть совместимый старый application build, включить maintenance и остановить writers. Каждый down сам проверяет empty-only условие и работает в транзакции. Нельзя удалять отзывы, назначения, техкарты, складские движения, часы или строки визита только ради прохождения guard.

Ручной запуск down не исправляет `_prisma_migrations`. Поэтому production down допускается только как часть отдельно утверждённого recovery plan с согласованным восстановлением migration history. Предпочтительный recovery после появления любых новых данных: остановить writers, сохранить аварийную копию, выполнить forward repair. Полное восстановление предрелизного backup заменяет всю production базу и требует отдельного решения владельца по `docs/ops/backups.md`; его нельзя выполнять автоматически.

Если любой down отказывает, не продолжать к зависимым down и не обходить guard. Зафиксировать ошибку без данных клиентов, оставить maintenance и выбрать forward repair или полное восстановление с владельцем.

## Checkpoint 19.10.2026

- `main` сейчас указывает на `91f21c`; эта вершина включена в рабочую ветку коммитом `1a5add68` с сохранением параллельных отчётов. Этот commit не является слиянием рабочей ветки в `main`.
- `release` и сервер наблюдались на `d54ae3`, автоматическая выкладка завершилась в `08:53:42Z`. Этот SHA содержит частичный UI. Полный Beauty backend не опубликован: в release tree нет новых моделей, зависящих от ordinary 132 и Beauty 133-137.
- Отдельное разрешение владельца на применение ordinary 132 и Beauty 133-137 не получено. До него миграции не применять и не считать частичную live-выкладку готовностью backend.
- Backup от 18.10.2026: 816 KiB, restore-check 138/138 таблиц и 10 005 строк. Это историческое доказательство подготовки. После разрешения и непосредственно перед cutover обязательны новая свежая резервная копия, проверка её целостности и новый restore-check.
- Integration `d134`: 67 passed, 1 optional skipped в шести файлах, включая ручную запись с конфликтом одинакового телефона и другого имени. Нагрузочный сценарий 50 000 строк не считается выполненным.
- Финальные локальные проверки: unit `468b`, 6201 passed, 4 skipped; browser `2188`, 17/17 passed (15 сохранённых сценариев карточки мастера, должности и отчёт); typecheck `0746` и lint `4bdc` без ошибок. Это не полный GitHub release gate.
- Browser RED `3483` показал «Нет данных» вместо сохранённой скидки `1 200`. Исправленный renderer подтверждён GREEN `2188`. Scope switch игнорирует запоздалый ответ старой карточки, проверка включена в эти 17 сценариев.
- Оговорка E5: начальное вычисление статуса мастера общим helper проверено, но обновление header day status сразу после сохранения недельного графика не доказано. Этот пункт не закрыт.

Cutover остаётся заблокирован двумя условиями: отдельным разрешением production migrations и финальным зелёным gate точной вершины, содержащей полный backend, schema и migrations.
