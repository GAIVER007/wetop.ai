# MV8: Vertical Today

Статус: утверждён владельцем, реализация разрешена 05.10.2026. Возобновлён после merge unblock #248 (dd763f5c).
Основание: полное ТЗ владельца MV8, 05.10.2026.

## Старт и AS-IS

GitHub подтверждает MV7 #247 MERGED, merge e5b565f67757ad5147f7d4470e49b46af851267f.
Fresh main при preflight: dfa7274dcaa838f45f6697e1a205c30a9c5bac95. Перед реализацией проверить ещё раз.
Read-only checkout: /Users/urijzapojnov/wetop-mv7-gate-20261005, HEAD f52dd81f880b5ee31e1ce79201dc888ead96c842. До создания этого плана дерево было чистым, locks пусты. Это предыдущая ветка, реализация MV8 в ней не начинается.

Main после MV7 содержит актуальный owner dashboard, owner-only journal permissions, staff changes и новые regression tests. Они сохраняются как база MV8.
/today пока Hospitality-only. landingForVertical ведёт Hospitality на /today, Beauty на /calendar, Food на /floor-plan. BeautyDay уже отдаёт date, Location timezone, columns и appointments с пятью принятыми статусами. Food facade и completeFoodList уже существуют. Food workspace loader дополнительно читает Customers/ServicePeriods, поэтому для Today он не используется.

Проект tasks/plan.md и tasks/todo.md помечает историческими и направляет текущие планы в plans/. План и checklist MV8 находятся в этом отдельном файле; чужие задачи не перезаписываются.

## Границы

Только presentation/composition. Не менять backend contracts, Prisma, migrations, permissions engine, booking transitions, capacity/overlap, customer visibility или financial model. Нет новых зависимостей без необходимости, generic booking domain, finance Beauty/Food, AI, aggregate dashboard, MV9. Production/release, merge PR MV8 закрыты. Финал: отдельный PR и STOP.

Работа одним агентом в независимом чистом clone fresh main, ветка codex/mv8-vertical-today-20261005. Свои PostgreSQL UTF8, localhost port/PGDATA/schema и browser ports; общая Supabase, чужие worktree и процессы не используются. Сохранить согласованный для MV7 принцип полной изоляции ресурсов. Node по .nvmrc. Никаких secrets/real guest data в evidence.

## Архитектура, предлагается к утверждению

/today/page.tsx проверяет verified server scope ДО domain calls и выбирает отдельный HospitalityToday/BeautyToday/FoodToday. deskShell fallback не является доказательством HOSPITALITY: при failed/invalid scope показывать LoadError или существующий auth/setup flow, не угадывать vertical.

Hospitality JSX выносится без изменения semantics, query period, loading/retry и текущих owner widgets. Beauty/Food получают отдельные pure metric builders и минимальные loaders. Общими могут быть только визуальные primitives, presentation contract и навигация. Решение до кода записать как ADR-MV8 в DECISIONS.md. Изменение DATA_MODEL не предполагается.

Beauty читает beautyApi.day() без query date: сервер возвращает current local date/timezone, columns и appointments. Дополнительные customers/services/employees endpoints не вызываются, labels уже доступны в day. Один captured instant применяется к вычислениям текущего local minute.

Food получает verified selected Location timezone, фиксирует один now, вычисляет local today и previousDate. Полностью загружает areas, tables и оба reservation days, валидирует и дедуплицирует. Customers/ServicePeriods catalog не загружается. Ошибка обязательного источника даёт LoadError всей композиции, без нулей/free fallback.

## Последовательность, acceptance и verification

- [x] 1. Подготовить изолированный fresh-main clone и PostgreSQL. Evidence: clean tree, base SHA, пустые locks, Node major, UTF8, только localhost URLs. Сверить scope и фактический API contract; отсутствие обязательного contract означает impact report до реализации.
- [x] 2. Создать pure Beauty metric builder и RED/GREEN tests. planned=BOOKED+CONFIRMED, confirmed=CONFIRMED, done=DONE, masters=columns.length. Attention BOOKED/NO_SHOW; upcoming сначала endMinutes>currentLocalMinute, затем уже прошедшие, максимум 5, startMinutes ASC внутри групп. CANCELLED не входит в planned. Scope: builder + focused test.
- [x] 3. Создать pure Food metric builder и RED/GREEN tests. planned/completed/unassigned/BOOKED/NO_SHOW считаются только для начавшихся local today. SEATED list/count только для operational [startsAt,endsAt) текущего instant из объединённых дней. freeNow=active tables в active areas минус distinct занятые active table IDs. Terminal не занимает стол. Upcoming BOOKED/CONFIRMED, startsAt ASC, максимум 5. Scope: builder + focused test.
- [ ] 4. Минимальные loaders. Проверить UTC date != local date, previous-day SEATED 23:30–01:30 при now 00:30, >100 reservations, duplicate IDs, повтор cursor/сломанный response/partial failure. RED/GREEN unit и реальные scoped API reads. Scope: loaders, tests, existing date/pagination reuse.
- [ ] 5. Вынести HospitalityToday и добавить verified server dispatch. Сохранить актуальный owner JSX, controls, Suspense/retry. До чужих запросов определить scope; /today больше не Hospitality-only. RED/GREEN dispatch/error tests и Hospitality smoke. Scope: today page, hospitality adapter, dispatch tests.
- [ ] 6. BeautyToday. Compact summary, attention/empty, ближайшие записи с labels и текстовым статусом, ссылки календарь/записи/клиенты по существующим permissions. Нет собственной appointment form и денег. Evidence: точный status fixture 2 BOOKED/1 CONFIRMED/1 DONE/1 NO_SHOW/1 CANCELLED, API/UI counts, API error/empty/READ_ONLY. Scope: adapter, shared presentation/CSS если нужны, tests.
- [ ] 7. FoodToday. Summary, unassigned/confirmation/no-show attention, текущие SEATED и ближайшие брони, quick links. Нет мутаций, клиентов/catalog reads и финансов. Evidence: точный status fixture, overnight/pagination/reload и error/READ_ONLY. Scope: adapter, focused tests.
- [ ] 8. Canonical landing и route classification. landingForVertical=/today для трёх; /today shared, Hospitality-specific children изолированы. Добавить Главная первым пунктом Beauty/Food, mobile первые четыре как в ТЗ, остальное в Ещё. RED/GREEN menu/guards/permission tests. Scope: landing, navigation и соответствующие тесты.
- [ ] 9. Entry points и scope switch. Root, completed onboarding, logo и completed branch ведут /today; незавершённый Hospitality остаётся /onboarding. Existing branchDestination сохранён для других сценариев, где ТЗ не требует изменения. Проверить server action/cookie/cache invalidation, A→B→C и reload, отсутствие старых данных даже кратковременно. Scope разделить на branch flow и onboarding/logo/root до пяти файлов на increment.
- [ ] 10. Реальный browser harness. Next → scoped transport → реальные Nest controllers/RoleGuard/AuthorInterceptor и существующие services → собственная PostgreSQL. Подставлять только synthetic identity/fixtures, не domain responses. Сначала доказать возможность реального Hospitality pipeline, затем полный matrix. Evidence: status fixtures, local-date boundary, >100 Food, midnight, READ_ONLY/STAFF, две Business/Location, switch/rapid switch/reload, счётчики foreign API=0 до redirect и на /today. Не путать прежний mock Hospitality harness с real API proof MV8.
- [ ] 11. Visual/accessibility. 12 real API screenshots: Hospitality/Beauty/Food × 1440/390 × light/dark. Hospitality сохранить структурно, сделать smoke. axe, heading order, keyboard, aria-current, focus visibility и отсутствие horizontal overflow. Evidence: PNG, traces и accessibility results.
- [ ] 12. Regression и handoff. Focused и real API matrix, существующие Beauty/Food direct URL flows и Hospitality owner/finance/forecast/retry/switching. Full unit/integration, root/API/web typecheck, lint, check-migrations, no drift, all downs, git diff --check. Recorded fingerprints не меняются во время прогона; без новых skips, weakened assertions и увеличения timeout ради GREEN. Проверить fresh main impact, синхронизировать и повторить зависимые checks. Commit/push своей ветки, PR «MV8: Vertical Today», report base/head, formulas, API matrix, timezone/switch isolation, screenshots/evidence. Не merge, не deploy. STOP.

## Контрольные точки

После 2–4: точные формулы, timezone и полный dataset GREEN до подключения UI.
После 5–7: каждый /today adapter делает только разрешённые reads, error не становится нулём.
После 8–10: landing/scope/direct routes и real persistence/isolation GREEN до visual finalization.
После 11–12: full DoD и отдельный PR. Промежуточные точки технические; нового согласования после общего утверждения плана не требуют.

## Риски и STOP

1. Auth/scope fallback может ошибочно выбрать отель: verified scope обязателен, no foreign API доказать счётчиками.
2. Beauty day/date и captured now должны относиться к одним local суткам даже при midnight race: сверять local date с серверным day.date, при расхождении перечитать day в ограниченном порядке либо LoadError, не смешивать разные даты.
3. Food day-start API требует предыдущий день; неполная пагинация не может дать свободные столы или нулевые attention counts.
4. Статус SEATED без текущего interval не входит в текущий operational count. Это применяет заданную в ТЗ temporal семантику, transitions не меняются.
5. Shared /today и branch landing меняют ожидания существующих navigation/onboarding tests: пересмотреть только утверждённые landing assertions, сохранить domain assertions.
6. Fresh main меняется: фиксировать реальную базу и итоговый impact; не считать старые результаты доказательством изменённого кода.
7. Отсутствие API для обязательного факта: STOP с конкретным экраном/KPI, missing contract и объяснением, почему UI не может вычислить его. Любая business ambiguity записывается в QUESTIONS.md, независимые части продолжаются.

План требуется подтвердить по AGENTS.md §1: «До подтверждения плана не создавать и не изменять код».
