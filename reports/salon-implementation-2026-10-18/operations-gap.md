# Салон: readonly gap mapping A-G

## Основание и границы

Проверен локальный HEAD `8a5ab9480` в `/opt/data/workspace/wetop-all-release-20261017`. Прочитаны корневой `AGENTS.md`, `apps/web/AGENTS.md`, оба исходных JSON, исходники domain/API/UI и migration hold/runbook. Тесты, браузер, production, авторизация, управление процессами и git-записи не выполнялись. Репозиторий не изменялся. Чужие изменения и артефакты в дереве оставлены нетронутыми; каталог locks был пуст.

Программная сверка: исходный register содержит **56 задач**, в A-G входят **36 уникальных ID**, все 36 присутствуют в `screens.json`: A=10, B=3, C=3, D=6, E=8, F=2, G=4. Покрытие матрицы **36/36**; остальные 20 задач намеренно вне аудита. HTML-макеты прочитаны как источник желаемого интерфейса, не как действующая модель. Их демонстрационные формулы не являются утверждёнными бизнес-правилами.

Статусы: **existing** означает найденную реализацию в исходниках, а не подтверждённую работу на сервере; **unverified** означает неполное соответствие/неподтверждённую часть; **missing** означает не найденный целевой сценарий в просмотренном контуре, при наличии соседних функций они указаны; **schemaheld** означает код есть, но необходимый SQL находится вне ordinary chain. Runtime всех строк не проверялся.

## Важная граница схемы

`packages/database/prisma/migrations-hold/README.md:43-64` и `docs/ops/beauty-zapis-release.md` явно удерживают пять папок:

- `20261018000131_beauty_appointment_lines`: `appointment_lines`, `employee_service_prices`, новая защита пересечений, A1/A2/A3/E2.
- `20261018000132_beauty_reviews`: отзывы и приглашения, влияет также на чтение employee portal.
- `20261018000133_beauty_materials`: нормы материалов, revision, связь складского движения со строкой записи.
- `20261018000134_beauty_positions`: должности, permissions, assignments.
- `20261018000135_beauty_location_hours`: часы салона и граница новой записи.

Ordinary 131 и 132 уже заняты `customer_phone_normalized` и `customer_imports`. Будущие 133-137 в runbook предварительны, нужен пересчёт на момент разрешённого выпуска. Не переносить часть блока, не применять миграции по этому отчёту. Модели этих held-таблиц **уже присутствуют в `schema.prisma`** (например строки 3257, 3387, 3410, 3512, 4167), что не доказывает существование таблиц в активной базе. README содержит общее требование не опережать схему, а специальный runbook описывает согласованный выпуск: эту переходную границу следует проверить отдельно, не считать автоматически завершённой.

Employee portal ordinary 128/129 и платежи ordinary 113/114/122 находятся в общей цепочке. Это также не доказательство применения production. Held117 workload не часть Beauty zapis release; runbook требует `BEAUTY_WORKLOAD_CAPTURE=false`.

Есть сквозные зависимости: актуальное чтение дня/периода использует строки записи и персональные цены; access resolver использует должности; portal читает отзывы. Поэтому пометка existing для старой функции ниже не обещает её работоспособности с одной ordinary-схемой без полного release baseline.

## Обозначения точных путей

Все пути относительно репозитория. Сокращения в матрице раскрываются здесь, это не абстрактные компоненты:

- **AP** = `apps/api/src/beauty/appointments.ts`, контроллер `beauty`, сервис BeautyAppointmentsService.
- **CAT** = `apps/api/src/beauty/beauty.module.ts`, BeautyCatalogService и BeautyCatalogController.
- **FORM** = `apps/web/src/app/beauty/appointment-form.tsx`; **CARD** = `apps/web/src/app/beauty/appointment-card.tsx`.
- **JA** = `apps/web/src/app/beauty/journal-actions.ts`; **JOURNAL** = `apps/web/src/app/beauty/journal.tsx`.
- **LIST** = `apps/web/src/app/appointments/list.tsx`, страница `apps/web/src/app/appointments/page.tsx`.
- **PORTAL** = `apps/api/src/employee-portal/employee-portal.service.ts`, routes в `apps/api/src/employee-portal/employee-portal.module.ts`.
- **PROFILE** = `apps/web/src/app/employees/[id]/profile/page.tsx`, UI `apps/web/src/components/employee-portal/screen.tsx`, `cabinet.tsx`, `management.tsx`, серверные actions `apps/web/src/app/my-work/actions.ts`.
- **SCHEDULE** = `apps/api/src/beauty/schedule.ts`; UI `apps/web/src/app/beauty/schedule/board.tsx`.

API ниже указаны по controller route без предположения о внешнем префиксе reverse proxy.

## Матрица A: карточка записи

| ID | Статус | Backend/API | UI и точный остаток относительно draft |
|---|---|---|---|
| A1 | schemaheld | AP `create/move/planLines`, POST `beauty/appointments`, PATCH `beauty/appointments/:id`; domain `packages/domain/src/beauty/appointments.ts` | FORM `items`, отдельные service/master/duration/price; JA, CARD, `calendar-columns.ts` разбивают линии по мастерам. Не отсутствует: последовательные услуги реализованы. Требуется held131. |
| A2 | schemaheld | AP `planLines`, base/discount/surcharge, процент через bigint, price permission; те же POST/PATCH | FORM строки скидки amount/percent и доплаты; CARD показывает корректировки. Held131, не проектировать финансовую формулу заново. |
| A3 | schemaheld | AP `planBeautyAppointment`, `assertFree`, `employeeBusy`, domain parser длительности; те же POST/PATCH | FORM часы/минуты с пятиминутными вариантами, окончание, CARD длительность; сохранение валидирует пересечения. Есть код, runtime не проверен; новая многосервисная версия held131. |
| A4 | existing, частичное соответствие unverified | AP `pay/refund/paidLocked`, POST `beauty/appointments/:id/payments`, POST `.../:id/refunds`; domain `packages/domain/src/beauty/payment.ts`; ordinary payment/cash migrations | CARD форма суммы/способа оплаты и остаток. Частичные последовательные оплаты и возврат существуют. Не подтверждён parity отдельного отображения предоплаты и двух операций прямо как в макете; текущие readers зависят от release baseline. |
| A5 | existing, частично missing | CAT GET `beauty/customers`, AP существующий/новый клиент | FORM: поиск имени/телефона, нормализованные цифры, выбор клиента, новый клиент с необязательным телефоном. Отдельные «Гость» и «Последний клиент» не найдены. Поиск по загруженной выборке, не доказан полноценный серверный поиск по всей базе. |
| A6 | missing, частичная основа | `customer-detail.ts` читает `appointments.source`, но input AP/domain не предоставляет source и employee-important | FORM не содержит редактируемого источника и «Сотрудник важен». Поле source само по себе не закрывает задачу; не добавлять правило закрепления мастера без решения. |
| A7 | missing | В просмотренном AP/domain нет контракта именованной палитры записи | JOURNAL цвет плитки задаёт CSS-класс статуса, не выбранный цвет записи. В FORM нет палитры/preview. |
| A8 | missing целевой интервал, existing дневные отсутствия | SCHEDULE POST `beauty/employees/:id/time-offs`, PORTAL POST `employee-portal/employees/:id/time-offs`, GET/PUT working-hours | SCHEDULE UI и portal имеют график/отсутствия. `dateFrom/dateTo` обозначают целые дни, не блок 13:00-14:00. Не выдавать это за внутридневную блокировку с причиной в карточке. |
| A9 | missing | Текущий AppointmentInput содержит одного customer и массив услуг, не группу участников/вместимость | FORM/CARD не содержат group flow. Несколько услуг не равно групповая запись. Нужна модель и отдельное решение правил. |
| A10 | schemaheld, основа existing | `apps/api/src/beauty/appointment-history.ts` GET `beauty/appointments/:id/history`, audit before/after/author; AP POST повторного создания | `appointment-history-panel.tsx`, `apps/web/src/components/beauty/appointment-history.tsx`, CARD «Повторить запись», FORM `repeatFrom`. Повтор сбрасывает цены/скидки к актуальным условиям. История/повтор уже есть, чтение lines требует held131. |

## Матрица B/C: календарь и реестр

| ID | Статус | Backend/API | UI и точный остаток |
|---|---|---|---|
| B1 | existing, schemaheld reader | AP GET `beauty/appointments?date`, POST create | JOURNAL свободная ячейка открывает `appointment-editor.tsx` с employee/time; JA сохраняет. Сценарий не отсутствует. Текущий reader использует held131. |
| B2 | unverified / частично missing | AP GET `beauty/finance/day` предоставляет финансовое чтение; отдельная финчасть `apps/web/src/app/finance/beauty-finance.tsx` | JOURNAL:401-407 показывает только количество записей; подключён QuickReport, но закрытие смены, сверка наличных, предоплаты и платёжный breakdown из draft в этом календарном сценарии не подтверждены. Наличие /finance не равно закрытию смены. |
| B3 | existing | Новый backend не нужен, тот же GET дня | JOURNAL:64-65,305: `compact` и изменение PX_PER_MIN, кнопка aria-pressed. Это уже реализовано, не предлагать как новый slice. Плотность колонок для 10 мастеров визуально не проверена. |
| C1 | existing, schemaheld reader | AP `period`, GET `beauty/appointments/period?from&to`, доменный разбор диапазона | LIST:153-179 диапазон from/to; фильтры имени/телефона, статуса, услуги и мастера. «Источник/автор/цвет» из расширенного draft не найдены. Текущий reader lines требует held131. |
| C2 | missing расширение, existing история | AP history endpoint существует; текущая projection AP не выдаёт author/source/deletedAt для реестра | LIST:269-277 колонки дата/время/клиент/телефон/услуга/мастер/статус/стоимость/действия. Автор/источник/удалённые/экспорт этого реестра не найдены. Экспорт финансов `apps/web/src/app/finance/export-appointments/route.ts` не равен экспорту текущей выборки реестра. CANCELLED не означает soft-deleted. |
| C3 | missing | В AP нет report endpoint авторов записей; автор audit history не равен авторской сводке | LIST не содержит вкладки авторов и агрегатов. Не изобретать семантику created-period против appointment-period. |

## Матрица D: клиенты

| ID | Статус | Backend/API | UI и точный остаток |
|---|---|---|---|
| D1 | existing, частичное соответствие unverified | CAT POST `beauty/customers`; `apps/api/src/beauty/customer-detail.ts` GET `beauty/customers/:id`, history до 100 записей | `apps/web/src/app/customers/customer-tools.tsx`, `create-customer.tsx`, `[id]/page.tsx`, `actions.ts`: ручное создание и отдельная карточка есть. Контакты, VIP/ДР, история; расширенное редактирование предпочтений/пола/полная неограниченная история не подтверждены. Detail читает held131 lines. |
| D2 | existing | `apps/api/src/beauty/customer-import.ts`: POST `beauty/customers/import/preview`, POST `beauty/customers/import`; также POST/GET `beauty/customer-imports`, PUT `:id/rows`, POST `:id/submit`, GET `:id/rows`, POST `:id/undo`; worker `customer-import.worker.ts`; domain customer-import*.ts | `customer-tools.tsx` CSV/XLSX до 500 строк и preview; `import-customers.tsx` надёжный импорт/история; `xlsx.ts`; экспорт `apps/web/src/app/customers/export/route.ts`, таблица `beauty-table.tsx`. Не утверждать, что нужны импорт/экспорт с нуля. Полный parity mapping листов/кодировок/обновления пустых полей не доказан. Ordinary131/132 есть, применение базы не проверялось. |
| D3 | unverified: действующие правила отличаются | CAT `customers`: DONE count/sum/last visit; `apps/web/src/app/customers/customer-filter.ts:10,22-24` regular >=2 | `beauty-table.tsx`: новый/постоянный/VIP/архив. Draft требует 0/1/2/3+ разных дней и 60/90 дней. Это не пропущенная UI-деталь, а иные правила; код ссылается на Q-BS-3. Не заменять утверждённый порог 2 на иллюстративный 3. |
| D4 | missing целевой blacklist | AP проверяет ACTIVE клиента при создании; CAT и filters используют статус/архив, но reason/override/blacklist policy не найдены | `customer-filter.ts` archived не является чёрным списком. В просмотренной карточке нет обязательной причины, согласования и запрета онлайн-записи. |
| D5 | missing | Платёж записи и refund существуют в AP, но клиентский deposit ledger/top-up/apply endpoint не найден | `[id]/page.tsx` не даёт депозитный баланс/движения из draft. Не считать оплату записи депозитом и не вводить денежные правила. |
| D6 | existing частично, missing теги/потерянные | CAT GET customers отдаёт birthDate/birthdayInDays/isVip; PATCH `beauty/customers/:id` обновляет marks | `beauty-table.tsx` показывает ДР, VIP; `customer-filter.ts` не содержит lost/sleeping/tags. Отдельный диапазон ДР, управляемые теги и потерянные из draft не подтверждены. |

## Матрица E/F: мастера и команда

| ID | Статус | Backend/API | UI и точный остаток |
|---|---|---|---|
| E1 | existing | CAT GET/POST/PATCH `beauty/employees`; PORTAL GET `employee-portal/employees/:id`, PATCH `:id/profile`; `employee-common.ts` общие данные | `apps/web/src/app/beauty/masters/board.tsx:28,195` направляет в PROFILE; общий `employee-workspace/basic-form.tsx`, `workspace.tsx`; услуги/график/оплата/публичность/доступ в portal. Не нужно строить вторую карточку. Все поля профессии/категории и тип участия из draft не подтверждены. |
| E2 | schemaheld | CAT GET `beauty/employees/:id/service-prices`, PUT/DELETE `.../:serviceId`; AP effective priority MASTER > LOCATION > CATALOG | `apps/web/src/components/employee-portal/service-prices.tsx`, PROFILE, `my-work/actions.ts`; types FIXED/RANGE/FREE/UNFIXED и персональное время. Есть реализация, held131. |
| E3 | existing | PORTAL PUT `employee-portal/employees/:id/pay-settings`, minor-unit contract; `my-work/actions.ts:75-84` parseMoney fixedAmount | `employee-portal/management.tsx:51` ввод fixedAmount в ₸ через minorToInput, `cabinet.tsx` formatMoney. Ошибка «вводить тиыны» в этой реализации уже устранена. |
| E4 | existing, частичный parity unverified | PORTAL GET `employee-portal/employees/:id/account-options`, PUT/DELETE `.../account`, проверка verified active membership и scope | PROFILE загружает допустимых участников; `management.tsx:37-45` именованный select, не ручной ID; ссылка /team на приглашения. Inline отправка приглашения именно по телефону/почте как в draft не подтверждена, но безопасная привязка без ID уже есть. |
| E5 | existing | CAT employee.active/status; AP/SCHEDULE рабочие интервалы/отсутствия | `apps/web/src/lib/beauty-master-day-status.ts`; masters board и PROFILE используют один helper, разделяют Активен/В архиве и На смене/Выходной/График недоступен. Не считать отсутствующим. Чтение дня наследует held baseline. |
| E6 | existing, частичное соответствие unverified | PORTAL PATCH profile, PUT publication, PUT avatar, POST/PATCH/DELETE portfolio, GET `employee-portal/public/:slug`; media storage fail-closed | PROFILE/employee-portal UI: biography, career year, avatar, portfolio, consent/publication. Ordinary128/129 есть. Не проверены публичный booking funnel и все настройки слотов из draft; live storage не проверен. Чтение reviews зависит от held132. |
| E7 | existing базовая оплата, missing гибкие правила | PORTAL pay-settings и PUT `employee-portal/pay-policy`; FIXED/PERCENT/FIXED_PLUS_PERCENT/BONUS_ONLY, две базы процента | `management.tsx`, `cabinet.tsx` вывод начислений/корректировок. Нет найденной матрицы приоритетов по услуге/категории/клиенту/товару из draft. Не переизобретать текущий payroll и не добавлять правила расчёта автономно. |
| E8 | missing | В просмотренной Beauty модели нет booking resource «кабинет» с capacity/preparation и независимым allocation | MastersBoard и PROFILE представляют employees, не комнаты. Гостиничные units нельзя молча использовать вместо salon resource. |
| F1 | schemaheld | `apps/api/src/beauty/positions.ts`: GET/POST `beauty/positions`, PATCH `:id`, POST `:id/archive`, PUT `assignments`, POST `assignments/:id/revoke`; `access.ts`, `scope.ts`, domain `beauty/access.ts` | `apps/web/src/app/team/roles/page.tsx`, `positions-board.tsx`, `position-actions.ts`: должности/матрица/назначения существуют. Это не только макет. Held134, permissions и OWN scope требуют согласованного backend release. |
| F2 | existing, schemaheld access | PORTAL GET `employee-portal/me`, собственные profile/week/services/time-offs; access.ts обеспечивает own scope через employee identity и permissions | `apps/web/src/app/my-work/page.tsx`, employee-portal/cabinet.tsx: свои записи/график/начисления. Не предполагать, что отсутствует роль/кабинет. Доказательство отдельного буквального legacy enum «Мастер» не получено: здесь собственный кабинет и action/scope permissions, не обещание нового enum. Безопасность OWN не проверялась исполнением; held134 и прочие portal readers остаются release dependency. |

## Матрица G: услуги

| ID | Статус | Backend/API | UI и точный остаток |
|---|---|---|---|
| G1 | existing частично / unverified | CAT GET/POST/PATCH `beauty/services`, PUT `beauty/services/:id/location`; domain `packages/domain/src/beauty/catalog.ts`; персональные цены E2 | `apps/web/src/app/beauty/services/board.tsx`, page.tsx: каталог и филиальный override цены/длительности, активность/назначение. Полная иерархия категория/подкатегория/группа, описание для клиента и price-range всей услуги из draft не подтверждены. Master RANGE существует отдельно и held131. |
| G2 | schemaheld | CAT GET/PUT `beauty/services/:id/materials`, materialRevision и нормы; AP `consumeMaterials` при завершении записи, складские movements с lineId | `apps/web/src/app/beauty/services/materials.tsx`, `material-actions.ts`, `board.tsx`: материалы, остаток, стоимость есть. Held133 требует held131. Не писать техкарты с нуля и не считать FIFO-списание доказанным live. |
| G3 | missing акции, existing ручная скидка | AP скидка/доплата конкретной строки A2, не campaign engine | FORM скидка не закрывает happy hours/first visit/birthday/referral с расписанием/приоритетом. В Beauty services board отдельный editor акций не найден. Новые автоматические скидки требуют решений. |
| G4 | missing | AP items позволяет последовательные услуги, но нет найденного persisted bundle, package price и распределения скидки | FORM много услуг не равно комплекс в каталоге. В services board не найдена сборка/сохранение комплекса с фиксированной общей ценой. Требуется модель/денежные правила. |

## Самый безопасный следующий вертикальный срез без новых бизнес-правил

**Не брать A1/A2/E2/F1/G2 с нуля: они реализованы и удержаны схемой. Не брать D3/D5/E7/G3/G4: это новые или конфликтующие бизнес-правила. B3 и E3 также уже реализованы.**

Рекомендуемый небольшой срез: **C2, только доступ к уже существующей истории из строки реестра**, без новых колонок/авторов/источников/soft-delete/export semantics.

1. В LIST добавить явно подписанное действие «История» для выбранной доступной записи; использовать существующий scope-aware путь загрузки `apps/web/src/app/beauty/appointment-history-actions.ts` и существующий `apps/web/src/app/beauty/appointment-history-panel.tsx`/общий компонент истории.
2. Backend остаётся `GET beauty/appointments/:id/history`, без новых таблиц и мутаций. Перед реализацией parent должен проверить, что CARD уже не даёт достаточно явный эквивалент: если да, вместо дублирования только сделать существующее действие обнаружимым и доступным с клавиатуры.
3. Не добавлять новые business claims: показывать только реально возвращённые audit events, автора, значения before/after; отдельные empty/loading/error состояния. Не интерпретировать отсутствие audit как отсутствие изменений и не выдавать actor audit за автора создания в отчёте.
4. Проверка после разрешения parent: unit на недоступную запись/смену scope/empty history и UI на открытие правильного ID. В текущем readonly-проходе эти проверки **не запускались**. Если интеграционные fixtures требуют held131/134, проверять только в разрешённой synthetic release-схеме, не двигать SQL в ordinary chain ради UI.

Это завершённая маленькая read-only цепочка реестр -> уже имеющийся API -> уже имеющаяся история. Она не меняет деньги, availability, статусы, identity или авторство и не требует новой бизнес-модели. Закроет лишь часть C2, не всю задачу.

## Выводы

- Найдено много действующего кода из актуального дерева: multi-service, скидки/длительность строк, history/repeat, диапазон реестра, компактный календарь, карточка клиента, импорт/экспорт, единый профиль мастера, персональные цены, ставка в ₸, выбор аккаунта, согласованный статус, portfolio/publication, кабинет сотрудника, должности и техкарты. Заявление «всё отсутствует» неверно.
- Главный release gap не равен feature gap: пять held-миграций и сквозные зависимости API/portal/access нельзя объявлять активной схемой на основании Prisma-моделей или наличия UI.
- Существенные функциональные пробелы: source/employee-important, именованный цвет, внутридневной блок, группа, расширенный реестр/авторы, blacklist с причиной, депозит, теги/lost, кабинеты-ресурсы, гибкие зарплатные правила, акции/комплексы. Каждый сложный денежный/booking gap требует утверждённого решения, а не копирования демонстрационного макета.
- Отчёт является доказательством статической сверки **36/36**, не результатом тестов, production QA, применения migrations или проверки безопасности в runtime.
