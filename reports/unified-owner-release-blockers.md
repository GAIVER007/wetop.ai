# Release-readiness audit: обязательная очередь до публикации

## Actual full-unit failures and bounded remediation, 16.10.2026

- Full unit RED: `tests/runs/logs/2026-10-16T11-31-48Z-unit-763b.log`, 5169 passed, 6 failed, 7 skipped, 5182 total. This remains the latest full-unit result; no full-green claim.
- Fixed five failures: explicit EXPECTED inventory for the 10 actual added routes (the reported estimate of 11 was not the actual diff), three server-read flags passed through the existing web env allowlist with default OFF, semantic separate metadata/date markup instead of three dot separators, static chart overflow CSS, approved max-width 960 breakpoint. No authorization changes, regenerated inventory, baseline inflation or design exceptions.
- Targeted evidence: `tests/runs/logs/2026-10-16T11-40-02Z-unit-03ff.log`, 76 passed, 1 failed, 0 skipped across the four originally failing files plus both changed owner UI component tests. Heap1536, one worker, DATABASE_POOL_MAX=1; codeChangedDuringRun=false. Route inventory 3/3, deploy 41/41, design 18/18, owner view 9/9, daily chart 2/2, migration guard 3/4.
- Remaining blocker deliberately not bypassed: all held114-118 lack the required release marker and down.sql. No dummy rollback or marker-only green fix was added. Held116 additionally has separate opening.sql. No migration SQL was modified or applied, and no database or .env was touched.
- Separate next rehearsal: inspect the complete dependency graph including held116 opening.sql and its replacement functions; implement transactional down scripts that lock all affected objects, refuse any retained data (including currency_snapshot and command/history evidence), and tear down only proven-empty structures in dependency order without CASCADE. Preserve shared extensions and baseline objects. For populated data, disable feature entry points while retaining compatible writers and immutable guards, reconcile and forward-repair rather than delete financial/history evidence. Review the scripts independently, then rehearse fresh apply, validation, empty teardown and populated refusal only on the owned synthetic database. Production remains blocked.
- Gbrain blast/callers for OwnerSummaryView and OwnerDailyChart returned not_found/not_built; local component imports and test references were inspected. Installed Next CSS documentation was read. Existing full types/lint evidence predates these edits and was not rerun in this bounded pass. git diff --check passed. No commit, push or deployment.

Основание: независимое read-only ревью 2026-10-16, полный отчёт `/srv/hermes/cache/delegation/subagent-summary-0-20261016_094905_971689.txt`. Это список блокеров, не выполненная приёмка. Разрешение владельца на полный выпуск не означает разрешение сократить функциональность или обойти gate.

## Код и подключения

- [ ] Закончить текущий daily-series срез; сверить точки и валютные итоги.
- [ ] Hotel currency: все создающие canonical cash writers сохраняют доказанный snapshot; оба денежных reader читают snapshot, legacy unknown остаётся PARTIAL.
- [ ] Marketing: атомарная связь документа и выплат, защита после оплаты; budget не денежный расход.
- [ ] Payroll и остальные старые cash writers: общий persistent intent, связанный document/category lifecycle без второго списания.
- [ ] Hospitality: подключить retained source к реальным InventoryEditor/HTTP/init paths, доказать текущую coverage и согласовать corrections закрытых дат. Pretracking данные не восстанавливать предположениями.
- [ ] Restaurant: доступный через штатный интерфейс confirmed physical opening schedule, API и concurrent validation; booking periods не подмена.
- [ ] Beauty: реальный payment ledger для поступлений по утверждённой модели, не revenue-as-payment.
- [ ] Previous/comparable projection с сопоставимыми локальными периодами; до подключения нет ложной дельты.

## Миграции и эксплуатация

- [ ] Единый исполняемый пакет held114–118: 116/opening.sql должен действительно выполняться, не оставаться пропущенным соседним файлом.
- [ ] Исправить устаревшие held README: root «Ничего», supplier114, противоречивый rollback117.
- [ ] Fresh baseline apply всего пакета + validation + forward-repair/rollback rehearsal без удаления финансовой истории.
- [ ] Owner-approved immutable image/commit, trusted backup+restore runner и пробное восстановление.
- [ ] Узкий migration acknowledgement/cutover путь; текущий sudo не разрешает wetop-auto-deploy --migrations-applied SHA. Полный root не требуется.

## Итоговая приёмка

- [ ] Независимый SQL/security review, runtime-role write/RLS и детерминированная race matrix.
- [ ] Authenticated Next → API → собственная synthetic DB → UI reconciliation; SSR screenshot stand этого не доказывает.
- [ ] Supplier form network-error/remount/success сохраняют intent корректно.
- [ ] Desktop/mobile 320/390/768/1440, light/dark, empty/partial/error/no-access, keyboard/axe, реальные links/retry.
- [ ] Согласование с актуальным main без потери изменений других веток.
- [ ] Итоговый неподвижный commit: полный lint, root/API/web types, unit, migration/schema, integration, build, bot/site/auth/onboarding/DB E2E/UI shards и остальные наборы TESTING.md + release-checks. Старые и filtered проверки не заменяют полный gate.
- [ ] После разрешённого merge/авторизованной миграции: actual image version + health + authenticated smoke и денежная сверка app.wetop.ai.



## Hotel cash currency: выполненный срез 16.10.2026

Оба owner-reader читают доказанный currency_snapshot, текущий KPI и daily получают одинаковые источники. Tenant scope проверяется по property/location/organization. Через to_jsonb(c) отсутствие held-колонки безопасно; при выключенном EXPENSE_LINKS_ENABLED snapshot не используется, историческая неизвестность остаётся PARTIAL. Property.currency не заменяет валюту прошлого.

Новые FinanceRepository INCOME/EXPENSE, комиссия и поправка сверки, а также обе гостиничные bar cash ветки используют единый insert-only writer. При включённом флаге валюта проверенного объекта блокируется FOR SHARE и записывается сразу в INSERT в исходной транзакции; суммы/правила не менялись. Выключенный флаг сохраняет прежний Prisma writer без обращения к held-колонке. Held114 дополнен запретом UPDATE snapshot, включая NULL; автоматического backfill нет. При откате сохранять совместимые writers и этот guard: старый supplier UPDATE после INSERT несовместим с новым guard.

Доказательства: RED integration d8f0 (UNKNOWN_SOURCE_CURRENCY вместо USD); GREEN полный owner-money-isolated 6/6 без skips `2026-10-16T09-59-17Z-integration-f551`; impacted unit 19/19 `09-59-22Z-unit-3ed0`; root/API/web types `09-59-27Z-typecheck-dfc6`. Только собственная 127.0.0.1:55516/wetop_owner_home, pms_test. Реальный FinanceRepository сохранил INCOME+fee EUR в транзакции; изменение Property на KZT не переписало EUR/USD итоги и daily; legacy NULL PARTIAL, void и foreign tenant проверены; actual reconciliation adjustment получил KZT; SQL запрет изменения snapshot проверен.

Дополнительная bounded-приёмка 16.10.2026: `NODE_OPTIONS=--max-old-space-size=512 DATABASE_POOL_MAX=1 npm run test:record -- integration --config tests/owner-money-isolated.config.ts --maxWorkers=1` — **9/9**, `tests/runs/logs/2026-10-16T10-05-46Z-integration-7a93.log`.

- [x] Непустой hotel Charge → folio: service DATE 2040-01-03 даёт USD303 в total и daily Asia/Almaty; created_at до/после локальной полуночи не переопределяет DATE; предыдущая service DATE, future created и void исключены.
- [x] Actual FinanceRepository direct EXPENSE без комиссии сохраняет EUR snapshot.
- [x] Feature OFF: строгий adapter spy принимает только legacy create data/select; любой raw query падает. Это bounded adapter proof, не запуск полного FinanceRepository на физически отсутствующей колонке.
- [x] Actual hotel Bar supplier payReceipt выполняет транзакцию с SET LOCAL ROLE wetop_app + app.org_id, создаёт EUR20 canonical cash + settlement, due80; чужая организация получает not_found. Только scope resolver подменён synthetic location; writer/Prisma/SQL/role реальные.
- [x] Revised held114 целиком применён к новым пустым transactional clones baseline dependency tables в pms_test; snapshot предварительно отсутствует только в клоне, создано 4 RLS policies; ROLLBACK удаляет все clones/functions. Для изоляции SQL identifiers переименованы suffix _accept114. Это не полный migration-package rehearsal и не rollback финансовой истории.
- [x] Expense integration replay после immutable snapshot guard: `NODE_OPTIONS=--max-old-space-size=512 DATABASE_POOL_MAX=1 npm run test:record -- integration --config tests/expense-isolated.config.ts --maxWorkers=1` — **11/11**, `tests/runs/logs/2026-10-16T10-04-21Z-integration-9f61.log`.

Промежуточные красные cc14/9f7f/b8b1 были ошибками новых fixtures/assertion/clone index namespace, не production regression; production code не менялся. До полного закрытия верхних блокеров остаются bar sale regression matrix, полный runtime/security/race matrix и fresh baseline/validation/rollback всего held-пакета. Верхние общие checkbox не закрыты. Types после новых тестов отдельно не повторялись. Gbrain blast/callers ранее не построен (not_found/not_built); новых production функций в этом срезе не меняли.

Невосстановимое прошлое до запуска tracking допускается как честно неизвестное. Не подключённый рабочий writer не является таким прошлым. До закрытия перечисленного публикация всего согласованного релиза не принимается.


## Hospitality: подключение старого редактора, 16.10.2026

Подключены существующие POST rooms / DELETE category / PATCH room к baseline capture перед изменением в той же транзакции; пользовательский scope проверяется без fallback, права property и canWrite проверяются в сервисе. Контракт и доказательства: `docs/contracts/hospitality-workload-history.md`. Разрыв writer устранён; выпуск НЕ разрешён: CoverageSegment/COMPLETE для непрерывно отслеженных закрытых дат и Q118 corrections не доказаны. Не менять статус общего blocker на CLOSED по одному этому патчу.


## Full compile/lint remediation evidence, 16.10.2026

- [x] Исправлены все 16 diagnostics полного typecheck и 6 ошибок полного lint из прогонов `11-16-18Z-typecheck-2810` и `11-16-18Z-lint-2456`. Без новых features, schema, financial rules, dependencies или отключения проверок.
- [x] Полный root/API/web typecheck: `tests/runs/logs/2026-10-16T11-23-10Z-typecheck-b546.log`, без ошибок. Полный lint: `tests/runs/logs/2026-10-16T11-24-39Z-lint-0dd1.log`, без ошибок. Прогоны последовательные, NODE_OPTIONS heap1536 и DATABASE_POOL_MAX=1.
- [x] Impacted unit 40/40: `11-22-39Z-unit-e0fe`; isolated hotel cash 5/5: `11-22-52Z-integration-43ca`; hospitality history 1/1: `11-22-56Z-integration-38e6`; occupancy 7/7: `11-23-01Z-integration-9cd7`. Только собственная PostgreSQL 127.0.0.1:55516/wetop_owner_home, pms_test, один worker. Occupancy выводит существующее pg deprecation warning о concurrent query.
- Production corrections ограничены отсутствующим optional audit filter и явным извлечением KPI fields без unused binding. Tests используют определённые UUID, реальный scoped property lookup вместо private never spy, inferred Prisma types и проверяемые runtime invariants вместо any. Bar-location-children проверен full types/lint, отдельно DB suite не запускался: его общий setup не использован ради этой type-only правки.
- Gbrain refs/blast для cashIntent/readOwnerMoney вернули not_built/not_found; проверены фактические references в исходниках (cash operation/reconciliation и owner-summary/tests).
- [ ] Это не full release gate: полный unit/integration/build/E2E/UI, immutable commit, held package rehearsal и production acceptance по-прежнему не закрыты. Верхние release checkbox не изменены. Commit/push/deploy не выполнялись.

## Bounded previous-money readiness, 16.10.2026
- [x] Previous canonical money projection подключён: частичные today/week/month по тому же местному времени, отдельные валюты/категории/daily, точный BigInt delta, zero-base/unknown не создают процент. GREEN 37 impacted unit и 11 actual isolated DB integration, `11-13-30Z-unit-7712`, `11-16-06Z-integration-a6d8`.
- [ ] Более короткий предыдущий месяц и DST gap/fold требуют отдельной бизнес-политики, если нужен числовой результат вместо честного noncomparable reason. Сейчас безопасно недоступны.
- [ ] Полный UI visual/E2E gate, все workload coverage и остальные release blockers остаются открыты. Эта отметка не разрешение rollout.
