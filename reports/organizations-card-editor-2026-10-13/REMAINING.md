# Организация: итог проверки 13.10.2026

## Реализовано и проверено локально

- Новый бизнес с первым объектом либо филиал конкретного бизнеса, включая второй бизнес того же направления. Гостиница, салон и ресторан. KZT/USD; часовой пояс находится в дополнительных настройках.
- Карточка владельца: название, описание, загрузка/снятие фото через приватное хранилище. Архив и восстановление объектов сохраняют идентификаторы, настройки и историю.
- Финансовые показатели по выбранному месяцу: проведённые оплаты, уникальные оплаченные заказы, средний чек и внесённые расходы. Валюты не смешиваются. Оплаты Beauty ещё не подключены, неполнота сводки показана явно.
- Нижние панели поясняют оплаты по месяцам, число бизнесов и объектов по направлениям, изменения карточек.
- Владелец отдельно утвердил нормализацию размеров CSS и удаление неиспользуемого UI-компонента overview.tsx. Серверный API /branches/overview сохранён.
- Убраны пустые промежутки под названиями. На 1440×900 все восемь объектов локального примера видны целиком; на 1024 и 390 нет горизонтальной прокрутки. Обложки: 112 px на компактном desktop, 160 px на среднем экране.

## Доказательства

- Полный unit: 4735 passed, 4 skipped, 2026-10-13T15-27-58Z-unit-1d9c.
- После последующих исправлений карточек: 54/54 unit, 2026-10-13T15-51-36Z-unit-0c1a.
- Браузер: 4/4 сценария, 2026-10-13T15-47-11Z-e2e-b780, включая сохранение карточки, архив/восстановление, второй бренд, выбор филиала и размеры 1440/1024/390.
- Integration: 14/14, 2026-10-13T14-52-58Z-integration-ceae, изолированная локальная PostgreSQL. Миграция 104 прошла forward/rollback/reapply.
- Полные ESLint и root/API/web typecheck прошли после последних изменений.
- Проверка оформления не ослаблялась: из baseline удалено только одно уже устранённое нарушение workspace.tsx; новые нарушения не добавлялись.
- Снимки final-cards-1440.png, final-cards-1024.png, final-cards-390.png. Изображения референса используются только в приватном синтетическом предпросмотре, в production будут обложки владельца.

## Выкладка

Владелец разрешил слияние и выкладку в main. На момент проверки клон сервера и release: 6d8b6d8acc06a1a4484c9b7f5dcc89b14ba9b45d. Production-миграции применены до 100 включительно. Неприменённые 101 food_booking_rules, 102 bar_location, 103 bar_restaurant_cash и 104 business_card требуют отдельного разрешения на резервное копирование и применение по AGENTS.md §14/18. Текущий SSH-доступ остаётся диагностическим и только для чтения.

Object storage на сервере выключен; S3-конфигурации нет. Без его подключения смена фотографии на рабочем домене недоступна, UI показывает причину. Реальный Luxx Aparts необходимо проверить после выкладки под обычной сессией владельца. Локальные тесты и push не подтверждают production.

После актуализации с main 6e5d89a86 выполнены полный lint и root/API/web typecheck. Карточки повторно проверены после жалобы на промежутки и обрезание филиалов: 4/4 UI (2026-10-13T15-47-11Z-e2e-b780), 54/54 unit (2026-10-13T15-51-36Z-unit-0c1a). Исходные иллюстрации в приватном preview обновлены из design/references/02_business/organizations_variant.png, без включения этих иллюстраций в production.

Дополнительные регрессии перед слиянием: организация только с рестораном сохраняет график оплат (красный 2026-10-13T16-04-06Z-e2e-ad40, зелёный 2026-10-13T16-07-55Z-e2e-bd1f: 6/6 real API). Дублированная кнопка меню после обновления общего shell устранена (красный 2026-10-13T16-20-08Z-e2e-82e5, зелёный 2026-10-13T16-28-37Z-e2e-2515: 4/4 UI). Карточка единственного бизнеса занимает нормальную ширину 640 px.

После включения main 41ac6c7fd: web typecheck и целевой lint прошли. Полный прогон 2026-10-13T17-00-08Z-unit-e91f: 4731 passed, 5 failed, 4 skipped. Найденный orphan Agentation исправлен; четыре таймаута guard-run повторены с maxWorkers=2. Итоговый повтор 2026-10-13T17-49-40Z-unit-c6e0: 27/27, включая все 18 design-slop и порядок миграций. Полный прогон после этой правки не повторялся.

Последнее решение владельца: полностью убрать нижний блок, включая новую сводку объектов. Удалены график, счётчик направлений, журнал и их запросы. Верхние финансовые итоги и карточки сохранены. Красный unit 2026-10-13T18-01-18Z-unit-8809; зелёный 23/23 2026-10-13T18-01-49Z-unit-619b. Браузер 1/1: 2026-10-13T18-02-06Z-e2e-64b9, размеры 1440/1024/390. Web typecheck и targeted lint прошли. Локальный браузер подтвердил lowerPanels=0, cards=3.

Список объектов улучшен по фото владельца: адрес отделён от вместимости, неподтверждённый зелёный индикатор заменён иконкой направления, строка получает понятное имя открытия и видимый фокус. Идентификаторы и действия выбора прежние. Красный unit 2026-10-13T18-04-32Z-unit-0c8c, зелёный 24/24 2026-10-13T18-05-34Z-unit-b3bc. Браузер 2/2 2026-10-13T18-05-55Z-e2e-67ed: создание/reload, выбор филиала, 1440/1024/390. Typecheck и targeted lint прошли. На локальном 1440×900 scrollHeight=900, все строки карточек видны.

Владелец отдельно разрешил backup, миграции 101-104 и штатную выкладку после зелёного гейта. Production не изменён. В предыдущем GitHub-прогоне 38433275748 найден блокер platform-p1-backfill: общий счёт локаций сравнивался только с гостиничными объектами. Воспроизведение на изолированной базе: красный 2026-10-13T18-11-38Z-integration-5cae (11 локаций против 7 объектов). Проверка ограничена гостиничными связями, сохранена уникальность location_id и tenant/vertical/полевая проверка каждого объекта. Зелёный 3/3: 2026-10-13T18-16-14Z-integration-77ea. Root typecheck и targeted ESLint прошли.

После удаления панелей обновлено последнее устаревшее ожидание в organization-card-workflow. Красный 2026-10-13T18-19-38Z-e2e-5027 дошёл до отсутствующей таблицы после сохранения, архива, восстановления и второго бренда. Повтор 2026-10-13T18-21-28Z-e2e-482e завершился таймаутом локальной загрузки. Зелёный полный сценарий 1/1: 2026-10-13T18-23-45Z-e2e-a6be, локальный CLI timeout=90000, 58.6 секунд; постоянный лимит теста не менялся. Проверка теперь требует отсутствие нижних панелей и наличие верхних итогов.

По последнему поручению верхняя сводка идёт от расходов к доходу: Расходы, Средний чек, Оплаченные заказы, Доход от оплат. Изменены только порядок, подписи и финансовая иконка расходов; расчётные поля и формулы прежние. Красный 2026-10-13T18-29-54Z-unit-8c3c; зелёный 25/25 2026-10-13T18-30-50Z-unit-8086, финальный повтор после иконки 19/19 2026-10-13T18-31-25Z-unit-72a7. Web typecheck и targeted lint прошли. Браузер подтвердил фактический порядок четырёх подписей.

Последние правки владельца: строка фильтров, поиск бизнесов, сортировка и переключатель вида удалены; все карточки показаны сразу. Архив перенесён в верхние действия. В общем меню выровнены колонки и строки, разделены поверхности, добавлено явное закрытие с возвратом фокуса. Маршруты, права и клавиатурное управление сохранены. Меню приватного preview обновлено из текущего компонента. Старый grid-selector ограничен заголовком, чтобы кнопка добавления не переносилась.
Доказательства: красный фильтры unit 2026-10-13T18-36-23Z-unit-cba9; зелёные 26/26 2026-10-13T18-50-48Z-unit-48c1; красное закрытие 2026-10-13T18-41-17Z-e2e-07ae; зелёное меню 3/3 2026-10-13T18-52-08Z-e2e-9645 (переходы, стрелки, Escape, закрытие); красная раскладка заголовка 2026-10-13T18-53-37Z-e2e-2426; зелёные размеры/создание/reload 1/1 2026-10-13T18-55-30Z-e2e-cbab; финальные 18/18 style guards 2026-10-13T18-55-44Z-unit-7ed0. Web typecheck и targeted lint прошли.
CI 38447686483: integration остановился на жёстком личном порту 55613 в organization-feedback.test.ts. Исправлен только guard: существующая проверка локального адреса и обязательная схема pms_test, проверяется также app URL, если задан. Красный через localhost на том же изолированном сервере: 2026-10-13T18-59-43Z-integration-691b. Зелёный 6/6 (бизнес-сценарии и гостиничные связи) 2026-10-13T19-01-31Z-integration-018c; CI-подобный режим без app URL 3/3 2026-10-13T19-03-23Z-integration-7fb7. Production пока не менялся.

## Следующая правка: карточка Luxx Aparts

- Удалён длинный перечень недоступных объектов из финансовой сводки. Короткая подпись сохраняет область частичных сумм; неизвестные суммы не заменяются нулями.
- Red: unit 2026-10-13T19-18-27Z-unit-512f, новый тест падает на старом предупреждении. Green: 2026-10-13T19-18-41Z-unit-d38c, 2/2. Web typecheck и targeted ESLint прошли.
- AI-обложка подготовлена локально: output/imagegen/luxx-aparts-cover.png. В production не загружена, SITE_ASSET_STORAGE отключён.
- Демонстрационные бизнесы пока не удалены: владелец указал сначала отправить текущие правки. Merge PR492 отклонён автоматической проверкой по AGENTS.md §18; запрошено прямое исключение.
- Создание рабочего Luxx Aparts 2 и переход в него ещё не выполнены. Существующий гостиничный объект и его идентификатор сохраняются; production-данные не менялись.

### Проверка рабочего списка и настройки филиала

- Рабочий домен прочитан через существующую сессию владельца: Luxx Aparts, 88 номеров и коек, 5 категорий; Luxx Aparts 2 уже существует, 0 номеров. Дубли не создавались. WETOP Салон и WETOP Ресторан ещё активны.
- В приватном synthetic preview оставлен один бизнес и два объекта с AI-обложкой. Эти данные не доказывают обновление production.
- Редактор бизнеса получил кнопку «Настройки объекта» для каждого гостиничного филиала. Переход в существующие /hotel-settings разрешён и для пустого филиала, без принудительного онбординга; выбор по актуальному списку и проверка чужого id сохранены.
- Red: 2026-10-13T19-23-59Z-unit-2cc8. Green: 2026-10-13T19-24-24Z-unit-ba90, 21/21 (switch, FinancialWidgets, ReferenceBoard). Web typecheck и targeted ESLint прошли.
- Единственная карточка бизнеса использует ширину до 640px и при нескольких филиалах.

## Final design verification and main authorization

The owner explicitly authorized agent commit, push, merge into main and standard publication of the verified current design delta on 2026-10-13. No schema, money computation, dependency or CI/CD configuration changes are added.

- Responsive regression red: 2026-10-13T19-32-05Z-e2e-148b, page height 1025 instead of 900.
- Green: 2026-10-13T19-33-01Z-e2e-fbd1, 5/5: creation/reload, metadata/archive/restore, menu transitions, keyboard, close with focus restoration.
- Final CSS verification: e2e 2026-10-13T19-34-01Z-e2e-c1a7, 1/1; unit 2026-10-13T19-34-13Z-unit-c301, 25/25. Web typecheck and targeted ESLint passed.
- CUA: 1440x900 and 1024x900, scrollHeight=900 and footer visible. At 390px, scrollWidth=390. Screenshots design-final-1440.png, design-final-1024.png, design-final-390.png, design-menu-final.png. Private preview figures are synthetic, not production evidence.
- Cover v2 keeps Luxx Aparts readable inside a shallow central crop. Production upload is still unavailable.
- Review: scoped UI delta, validated branch selection and safe destination, partial totals, menu close/focus reviewed. No blocking issue identified in this delta. Full release gate and live domain remain separate checks.

## Release gate correction after PR492

PR492 merged into main as dae7250c95e05a1483612f50b99c579b556c49c0. Its exact-SHA release-checks 38456363644 failed the design guard: the added min-width 600 must be min-width 601. Release and production remain 6d8b6d8acc06a1a4484c9b7f5dcc89b14ba9b45d; API/web healthy.

- Guard red: 2026-10-13T19-49-11Z-unit-5446. Corrected only the two new minimum breakpoints. Green: 2026-10-13T19-51-18Z-unit-46e2, 43/43.
- Existing UI checks still used the old Organization summary form and calendar header search removed by prior code. Reproduced: 2026-10-13T19-42-37Z-e2e-611d, 3 failed; beauty helper red 2026-10-13T19-53-17Z-e2e-cf6b.
- Updated test entry steps to the existing business/branch dialog; kept two salon locations in the same business, marketing access checks and all business assertions. No Beauty, Marketing, Calendar or Tour product code changed. No CI/CD configuration, timeouts, retries or exclusions changed.
- Green UI4: 2026-10-13T19-51-20Z-e2e-e333. Dependent UI run 2026-10-13T19-55-09Z-e2e-0088 had 30 passed and one obsolete exact combobox label; that selector was corrected, final multi-location scenario passed in 2026-10-13T20-00-32Z-e2e-3689. This is combined scenario evidence, not a green full 31-case run.
- Tour retains precise spotlight geometry for visible search in Finance and checks the centered explanation when search is absent in Calendar. Final green: 2026-10-13T20-10-15Z-e2e-f61c.
- Two full local unit runs are NOT green: 2026-10-13T19-55-39Z-unit-2a7f (guard-run timeout) and 2026-10-13T20-02-29Z-unit-051d (web-booking socket hang up), each 4741 passed, 1 failed, 4 skipped. Both previously failed files and the design guard passed isolated, 67/67, in 2026-10-13T20-08-38Z-unit-d0d3 without source changes. Full GitHub gate remains mandatory before publication. Web typecheck and targeted ESLint passed.
- Production storage is disabled. The generated cover remains local; requested owner information about an existing Kazakhstan bucket. No production data changes, backups, migrations or deployment performed yet.

### Final full local result

2026-10-13T20-22-01Z-unit-6c09: 4742 passed, 4 existing skips, 0 failures, 492 passed files plus one skipped file. Full unit verification ran without concurrent UI load with two workers; no product source changes or timeout adjustments were needed for the two earlier transient failures. Production application DB role checked read-only: administrative=false. No database privileges were changed.

## Integration fixture date blocker on a8181384

PR493 merged as a8181384d36d763ecaa415f34874db087c6fdddc. Release-checks 38462872531 passed main/unit/site, bot and separate UI suites, but integration had 1030 passed, 1 failed, 16 skipped. Migration up/down checks passed; GitHub jobs metadata initially showed a stale in-progress step. The real failure was mv4-beauty READ_ONLY assertions: fixed absence date 2026-10-13 was already past in Asia/Almaty, the visible date-filtered list was empty, and the test read undefined.id before invoking the guarded mutation.

- Local red: 2026-10-13T20-58-07Z-integration-6d8e, same exception.
- Changed only the test: obtain the persisted fixture id by employee and exact fixed DATE fields; keep all mutation rejection checks; additionally prove the time-off row remains. No product behavior, dates, schema, access rules or CI/CD configuration changed.
- Full local MV4 integration green: 2026-10-13T20-59-32Z-integration-75f6, 23/23, isolated PostgreSQL55613/pms_test. Root typecheck and targeted ESLint green.
- Production unchanged until the full exact-SHA gate is green.

## Current publication blocker on 10d02d56

PR494 merged as 10d02d565985e7aa7265e019048d46eea498103b. Full release-checks 38467879153 is pending behind the earlier failed run. UI part1 of 38462872531 has 509 passed and 9 failed: three desktop Calendar toolbar height checks (86 instead of <=56), three mobile category overflow-wrap checks, two design-system snapshot scenarios, and the reservation dialog width check (940 instead of760).

- Local reproduction on current main: 2026-10-13T21-19-50Z-e2e-2e74, 7 failed, 6 passed, unchanged product and assertions. These seven failures concern Calendar/Reservation, outside the current design-only publication scope. Requested a bounded scope extension; no product correction made without the answer.
- Inspected GitHub visual artifacts: icon registry additions expand the kit, requiring reviewed Linux references. Dispatched the existing ui-snapshots workflow38469619188; no workflow configuration or check changes. References are not accepted blindly.
- Production is still the previously verified6d8b6d8 version. No backup, production migration, data cleanup, cover upload or deployment performed in this iteration.

- ui-snapshots38469619188 succeeded on exact main10d02d56. Reviewed light/dark icon images and accepted only these two icon references from ci/ui-snapshots-24 (d2d88dc5). Did not accept the other24 changed references, including unrelated dark tokens. Snapshot tolerance, assertions and product code are unchanged.

## Follow-up: reported503 and remaining gate failures (13.10.2026)

PR495 is MERGED, main03653e49. Local3152/branches and production /branches both return200. Latest full gate38470261319 failed UI part1; the aggregate UI job only reports that failure. Other mandatory jobs passed. The503 line in this run belongs to the synthetic channel API error path, not a failed merge.

New owner request: investigate the merge error and put remaining work in order. Corrected the scoped UI blockers without schema, financial or other business logic changes:

- Retain <=56px Calendar toolbar by removing extra vertical padding; category names wrap at word boundaries. Preserve strict six-card/grid/height assertions, verify visible control centres with1px alignment tolerance.
- Retain approved940px reservation drawer from41ac6c7fd; update stale760px expectation and additionally assert no horizontal overflow.
- Manual Agentation overlays contaminated automated reference screenshots. Regression red2026-10-14T04-35-16Z-e2e-9601: one agentation-toolbar instead of zero. Exclude this manual tool only from the already existing APP_UI_TEST environment. Normal local annotation tooling remains enabled. No CI configuration changes, tolerance widening or skipped checks.
- Green2026-10-14T04-36-01Z-e2e-6ae6:18/18 scenarios, including all seven prior blockers, both themes, month navigation, preview, mobile booking cancel and the new toolbar isolation check. CSS intermediate run2026-10-14T04-32-25Z-e2e-312e had14 passed/3 failed before correcting the alignment metric.
- Design guard2026-10-14T04-38-04Z-unit-778e:15/15. Targeted ESLint and web typecheck passed. Source decisions recorded. Full GitHub gate and live deployment remain separate, mandatory steps.

- Canonical Linux workflow38512475820 succeeded on a38f29d51, snapshot branchci/ui-snapshots-25 (053620f8). Reviewed visual samples for buttons, action menu, dark tokens, form grid, table and toasts; checked all23 image dimensions (same or1px rounding difference). State structure, colours and component implementation remain intact. Accepted canonical clean references without changing comparison tolerances.
- Full local unit2026-10-14T04-39-49Z-unit-c53f is NOT green:4741 passed,1 socket hang up in the AI-seller disconnected-catalogue test,4 existing skips. The unchanged AI-seller file passed isolated74/74 in2026-10-14T04-43-04Z-unit-5b62. This does not promote the failed full run to green.

- Final full local unit2026-10-14T04-43-46Z-unit-ede1:4742 passed,4 existing skips,0 failures (492 passed files,1 skipped). No AI-seller test or product changes were required. Production deployed marker remains6d8b6d8; API/web bothhealthy, verified via the existing hostinger SSH profile.

## Final mobile category overflow correction

Exact-SHA1930e9df gate38513294586 passed main/unit/site, bot, database, branches-ui, beauty-ui, food-ui and UI part3. UI part1 had517 passed/2 failed: long category text overflowed2px in both themes. Cancelled only this own already-red run via standard GitHub cancellation after owner renewed the instruction to complete publication. Did not cancel the separate UI4 candidate or change CI configuration.

- Updated own tree fast-forward to current maincc9b2892, preserving PR497 changes to inventory/menu. Separate UI4 PR498 remains untouched.
- Red2026-10-14T05-27-43Z-e2e-03de:2/2 failed. Narrow gap change alone did not solve it (2026-10-14T05-28-44Z-e2e-c194). Diagnostics in2026-10-14T05-30-15Z-e2e-5e36 showed390px, label91px versus first word93px.
- Allocate more mobile label width using4px side padding and4px icon gap; preserve normal word wrapping with break-word only for overlong tokens. Keep every1px/no-overflow/whole-word/accessibility assertion. Added useful failing-category geometry to the existing test.
- Green2026-10-14T05-31-50Z-e2e-defa:8/8, both themes across1440/1024/768/390/320, mobile whole-word checks360/390/430, desktop toolbar1280/1366/1440. Targeted ESLint and design guard passed. Production still requires a green exact-SHA gate, approved migrations and runtime/domain verification.

## Baseline decrease after PR497

The earlier current-maincc9b2892 run38514092816 failed only the CSS baseline check: fund.css violations had decreased27 to26, but the old count remained. Reproduced on current fa803ca0 in2026-10-14T05-37-24Z-unit-3920. Updated exactly one JSON value27 to26; no rule or allowance increased. Green2026-10-14T05-37-55Z-unit-d920:33/33 design guards. Stopped only own obsolete fa803ca0 run38517495901, which contained the reproduced baseline mismatch; separate UI4 candidate remains untouched.

## Production verification, 14.10.2026

- Full exact-SHA release-checks38517851997 succeeded for13d3210d4137d1eb9682fa6a51f059f795c363b0. Standard auto-release advanced release to this checked ancestor of main.
- Fresh backup wetop-20261014T072638Z.dump,708401 bytes,121 TABLE DATA entries. Restored successfully into a private network-disabled ephemeral PostgreSQL17 with btree_gist preinstalled:121 public tables. Temporary container removed.
- Prisma status confirmed exactly101 food_booking_rules,102 bar_location,103 bar_restaurant_cash,104 business_card pending. Applied only those four approved migrations; subsequent status:Database schema is up to date.
- Standard wetop-auto-deploy --migrations-applied13d3210d invoked. SSH build session disconnected, but fresh independent check confirmed deployed marker and repository HEAD13d3210d; API/web running healthy on image11d5cd6f95fff87a56d24e9cf6464a17d80cf242eac5294064a2b4e063d5dd18.
- Authenticated owner browser on https://app.wetop.ai/branches shows new Organization, expense-to-income KPIs, monthly controls, no old filters/bottom panels. Existing Luxx Aparts preserved88 units/5 categories; existing Luxx Aparts2 preserved with0 units/0 categories. No duplicate created.
- Owner card editor opened, name/description controls present. Cover control disabled truthfully because production photo storage is not connected. Generated cover remains local.
- Luxx Aparts2 settings selection led to first-time onboarding, not completed hotel settings. No room, category, price or booking invented. This route requires follow-up verification/correction.
- WETOP Salon and WETOP Restaurant, identified by owner as test objects, archived through normal owner UI. Archive count2 confirmed; history retained. Empty business cards remain because business archiving is not implemented. No physical deletion or direct SQL performed.
- Actual production screenshot:/private/tmp/wetop-production-organizations-20261014.png. Publication is verified; cover storage, empty business-card cleanup and Luxx Aparts2 settings redirect remain explicit limitations. Do not label the entire original request complete.

## Editor polish requested14.10.2026

- Keep natural card heights instead of stretching into the available desktop screen. Apply the existing compact tablet spacing to multi-business views as well as singleton views.
- Two-column desktop metadata/cover editor; one column on mobile. Mobile tabs wrap and sticky actions stay above the bottom navigation. Secondary branch settings and a clearly labelled danger deletion action; deletion retains approved archive/restore semantics.
- Settings gate red2026-10-14T08-56-42Z-unit-1ca7, then green9/9. Missing properties still require onboarding. Existing empty hotels can edit metadata before adding rooms.
- UI2026-10-14T09-00-15Z-e2e-8fcd and09-03-08Z-e2e-e7c7:3/4, old creation spec incorrectly assumed no existing business. Sequential reproduction disproved the initial cross-talk hypothesis. Explicitly select new brand, target the accessible textbox name including helper text. Do not weaken persistence/layout assertions.
- Red height947px vs900 at tablet in09-08-26Z-e2e-dbe0. Corrected tablet spacing. Final UI2026-10-14T09-11-09Z-e2e-d5e6:4/4, metadata save/archive/restore/reload, distinct second business, 1440/1024/390 no overflow, desktop first-screen bounds. Reviewed editor screenshots at1440 and390.
- CSS baseline27/27 including onboarding test in09-12-14Z-unit-a42f. Additional design guard/onboarding24/24 in09-13-55Z-unit-41cd. Web typecheck and targeted ESLint passed.
- Read-only production configuration check: storage disabled and all five SITE_ASSET_S3 configuration keys absent. Owner confirmed storage has not been created. Generated cover was local synthetic preview content; no persisted production cover has been removed. Provisioning remains blocked on documented provider setup; no disk/R2/public-reference fallback introduced.

- Integrated current maina3dad0346 via076435ee2, retaining stricter900px viewport and footer checks instead of widening to920px. Main already fixed missing text-base token; no duplicate Calendar change.
- Full unit09-15-53Z-unit-8aec:4742 passed/4 failed (three service-script timeouts and one upstream undefined token). Reduced concurrent workers without changing timeouts:09-18-15Z-unit-8e20 had4745 passed/one upstream-token failure. After integrating the existing main correction:09-25-09Z-unit-4b22,4746 passed/4 existing skips/zero failures.
- Final combined lint09-30-48Z-lint-5cc8 and typecheck09-31-49Z-typecheck-0931 green. Organization UI09-32-39Z-e2e-c971:4/4. Last visual hierarchy correction (secondary settings button): CSS guard09-35-00Z-unit-473e18/18; workflow09-35-04Z-e2e-c1111/1. No new migrations compared with deployed13d3210d.
