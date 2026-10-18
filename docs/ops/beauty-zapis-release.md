# Beauty zapis release: prepared ordinary133-137, production NOT applied

## Подтверждённая подготовка, 18.10.2026

Владелец явно разрешил: «Подготовить отдельный релиз пяти Beauty-миграций и согласовать схему с SQL. Production-БД не менять до зелёного гейта, проверенного бэкапа и точного допуска.» Первичное перемещение блока в ordinary133-137 сохранило SHA-256 всех десяти up/down SQL. Это историческое происхождение первоначального кандидата; последующее исправление одного отката описано ниже. Имёна held131-135 ниже сохраняются как происхождение. `schema.prisma` приведена к существующим SQL defaults, именам FK/индексов и referential actions, без новых бизнес-правил.

### Исправление точного отката 135 после CI

Полный CI `39159530856` обнаружил, что исходный `135/down.sql` не возвращает `search_path` двух kitchen trigger-функций и точный текст `kitchen_stock_guard()` к состоянию ordinary089/093. Исправлен только этот down-файл: восстановлены исходный текст и schema-aware `search_path`. Все пять `migration.sql` и четыре остальных `down.sql` сохранили исходные байты. Новых правил денег, доступа, склада или автоматического применения нет; retained-data отказы, блокировки и транзакция сохранены.

SHA-256 `135/down.sql`: `57ef11ff0477a9f067abd3ea9bc17508889c87e39aba72b5c4ab4806646fb844` → `86e6e1b6d2af3113f38ee6146f280d1a53da9cdf85074ea9a37a30eb014c8291`. Manifest обновляет ровно один down-хеш, строгая проверка всех десяти файлов не ослаблена.

Реальный RED `2026-10-18T20-31-55Z-integration-290d` воспроизвёл потерю точных function definitions/proconfig. После исправления GREEN `2026-10-18T20-32-56Z-integration-5b90`: 9/9, включая fresh141, Prisma diff0, FORCE RLS, пять retained-data отказов и полный reverse с сохранением legacy appointment. Guard GREEN `2026-10-18T20-33-02Z-unit-2afa`: 52/52. Это подготовка исправленного кандидата, не полный новый CI и не production-применение.

`packages/database/prisma/beauty-release-preparation.json` имеет отдельное состояние PREPARED_NOT_APPLIED. Это не разрешение production migration. Сторож допускает только полный конкретный одобренный пятифайловый блок с проверкой всех десяти SHA и обязательностью полного гейта, точного production-допуска, backup/restore и доверенного cutover runner. Повреждённый manifest, неполный/дублированный/чужой блок или иной SQL отказывает. Исторический RELEASED_SEPARATELY не дополнен: применения в production не было. Условие отказа auto-deploy при новых миграциях не менялось. Остальные held114-118 не перенесены.

Локальные доказательства: `tests/integration/beauty-release-schema.test.ts` на отдельно созданной owned БД проверяет fresh141, populated legacy backfill, Prisma diff0, FORCE RLS десяти таблиц, соседнего tenant, пять retained-data отказов down и dependency-safe reverse без потери старой записи. Это не заменяет полный release-checks, live mig status, настоящий backup/restore или production-допуск.


Дата подготовки: 18.10.2026. Этот документ описывает будущий отдельный выпуск схемы для Beauty. Он не разрешает применять SQL в production. Для production migration каждый раз требуется отдельное явное разрешение владельца по AGENTS.md §14-15, свежая резервная копия и проверка восстановления.

## Граница релиза

Текущий `main` уже содержит обычные миграции:

1. `20261018000131_customer_phone_normalized`
2. `20261018000132_customer_imports`

На read-only production-проверке 18.10.2026 deployed SHA `29fd2fda` имел применённую ordinary 131, но ordinary 132 ещё не была применена. Это наблюдение не заменяет повторный `mig status` перед выпуском. Production должна сначала последовательно применить ordinary 132 из точного release SHA, затем Beauty 133-137; Beauty-блок нельзя накатывать поверх базы с pending 132.

Поэтому текущие имена held131-135 нельзя переносить в `migrations/` без переименования. Если перед выпуском в обычной цепочке появится более новая миграция, весь блок получает следующие свободные последовательные номера с сохранением порядка зависимостей.

Предварительный manifest для текущей вершины:

| Порядок | Исходная held-папка | Подготовленное ordinary-имя | Зависимости |
|---|---|---|---|
| 1 | `20261018000131_beauty_appointment_lines` | `20261018000133_beauty_appointment_lines` | ordinary 044, 109, 130 |
| 2 | `20261018000132_beauty_reviews` | `20261018000134_beauty_reviews` | Beauty appointment lines |
| 3 | `20261018000133_beauty_materials` | `20261018000135_beauty_materials` | Beauty appointment lines; ordinary 089, 090, 093 |
| 4 | `20261018000134_beauty_positions` | `20261018000136_beauty_positions` | ordinary 013, 020, 073 |
| 5 | `20261018000135_beauty_location_hours` | `20261018000137_beauty_location_hours` | Beauty appointment lines |

Ordinary employee portal migrations 128/129 уже находятся в общей цепочке. Held117 Beauty workload не входит в этот выпуск: `BEAUTY_WORKLOAD_CAPTURE` должен оставаться `false`. Включение held117 отдельно требует held116 и отдельного решения владельца. Held114, 115 и 118 также не входят в этот выпуск.

## Подготовка release commit

1. Убедиться, что merge conflicts отсутствуют, `schema.prisma` содержит одновременно Beauty-модели и актуальные модели `main`, а последняя ordinary migration до этого блока всё ещё 132. Подготовленный блок заканчивается137. Если появились другие новые миграции, пересчитать свободные номера.
2. Переместить все пять папок через `git mv` из `migrations-hold/` в `migrations/` под итоговыми именами одного последовательного блока. Не переносить часть блока.
3. В том же commit оставить согласованные `schema.prisma`, API и writers и точный PREPARED_NOT_APPLIED manifest. В `RELEASED_SEPARATELY` добавлять имена только после фактического отдельного production-применения; подготовка не считается применением.
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
