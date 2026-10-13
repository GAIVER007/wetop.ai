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
