# ТЗ2.1 D: рабочее время и защищённая неделя

## Действительно общее

- resolveWorkingTime: все интервалы независимо от порядка, перерывы, active/assignment, TimeOff по локальной дате конкретного филиала. NO_SCHEDULE не превращается в24часа. Включены реальные Food employees/onShift и Beauty fitsSchedule/freeBeautySlots.
- Beauty legacy WeekForm, Food legacy WeekForm, PortalWeek: исходный обязательный expectedRevision, черновик сохраняется при конфликте, сравнение не меняет token/ввод, отдельное принятие серверной недели меняет оба.
- Beauty setWorkingHours, Food setShifts, Portal mutate week: общая функция source+hours revision, employee locks, транзакционная проверка и замена. Ни Appointment ids/status/time, ни финансовые формулы не меняются.

## Дополнительные блокеры закрыты с RED→GREEN

Новый DB regression a791:6 assertion failures,6старых PASS. Без изменения assertions после применения fix90b5:12/12PASS. Для Beauty и Food: два empty→empty writer допускают одного; empty→filled→empty не возвращает старый token; детерминированный конкурентный writer между commit Portal и последующим GET не подменяет committed week/revision. Реальные services+PostgreSQL; post-commit seam управляется one-shot spy без sleeps, второй writer пишет в настоящую БД.

Для пустой недели нужен существующий монотонный source. Используется employees.updated_at с6microseconds, обновляется GREATEST(clock_timestamp(),old+1microsecond) на КАЖДОМ успешном save. source+строки читаются одним SQL snapshot. Это не новая таблица/поле/миграция. Консервативное следствие: правки недели инвалидируют исходную версию контактов сотрудника и недель других филиалов; правки контактов инвалидируют неделю. Формы получают409 и сохраняют ввод, а не перезаписывают данные.

Portal ответ содержит именно принятую внутри транзакции пару week+weekRevision, даже если другой writer уже успел изменить неделю перед отдельным GET остальных данных. Нельзя брать более новый token с прежним controlled draft.

## Что остаётся отраслевым

Календарь записи, каталог и skills Beauty, Food roles/продажи, гостиничные номера/доступность, зарплаты и финансовые определения не объединялись. Hotel staffing этим пакетом не реализован. Общий resolver не вводит overnight/DST-модель и новые исключения. Hospitality проверяется только по существующим затронутым финансовым регрессиям, это не кадровый паритет.

## Публикация

Web и API должны выходить одной версией. Старые versionless writers теперь получают400; старые токены409. Не добавлять bypass ради совместимости. Новые модели, роли, миграции и активация held migrations в production этому пакету не разрешены. Итоговые общий type/lint/build и реальные UI proofs записываются отдельно; ранние65unit/92integration не выдаются за окончательную проверку после дополнительного исправления.
