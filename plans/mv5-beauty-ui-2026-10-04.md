# MV5: WETOP Beauty UI

Утверждено владельцем в ТЗ 04.10.2026. Начало после merge MV4 #241, SHA 6974cb3b.

1. Server-resolved Business.vertical управляет оболочкой и меню. Beauty landing /calendar после onboarding и переключения филиала. Не запрашивать hotel settings для Beauty, не выбирать первый бизнес. Существующий Hospitality сохраняется.
2. Канонические /calendar, /appointments, /customers, /employees, /services. Старые Beauty URL остаются совместимыми. Общие /staff (существующий redirect /team), /journal, /help, /profile. Employee не Membership.
3. Переиспользовать действующие ServicesBoard, MastersBoard, ScheduleBoard, Overlay, Table и server actions. Добавить read-only CustomerBusiness список. Никаких новых API mutations, schema, domain rules.
4. Calendar: день/стрелки/сегодня, колонки мастеров, часы/отсутствия/записи, первичный CTA. Mobile: выбранный мастер и его timeline. Общий drawer создания и карточки с server next actions. Цена только server snapshot/quote, minor units; eligibility проверяет API. Список записей отдельный с фильтрами.
5. Employee detail: основные данные/услуги, филиалы, неделя, отсутствия, сегодня работает по day response. READ_ONLY и STAFF используют существующие permissions и canWrite.
6. Red/green navigation and scope regression tests. Browser на настоящих Nest Beauty controllers, RoleGuard, AuthorInterceptor, PostgreSQL; synthetic identity/fixtures только localhost. Flow от пустого каталога до DONE после reload, ошибки overlap/archive/TimeOff, два Business и Location, роли.
7. Полные unit/integration/typecheck/lint; affected browser, axe, keyboard, 1440/390 light/dark, проверка переполнения. Report, screenshots, commit/push/PR и STOP. Production и MV6 не разрешены.

Контракт данных MV4 достаточен. Цена записи не редактируется: API не поддерживает ручную цену. Фильтры списка работают над выбранным серверным днём. Клиент создаётся только через Appointment.
