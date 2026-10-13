# Проверка пяти замечаний, 13.10.2026

Владелец принял внешний вид и попросил убрать подпись с обложек. Текст удалён из приватного локального предпросмотра, включая подпись внутри использовавшегося снимка. В поставляемом ReferenceBoard такой строки нет. Снимок: without-labels-1440.png. Локальная вкладка 3152 остаётся синтетической.

| Замечание | Состояние кода | Осталось |
|---|---|---|
| 1. Понятное добавление компании/филиала, ресторан, валюты и часовой пояс | Реализовано: новый бренд с первым объектом или филиал выбранного бизнеса, KZT/USD, дополнительные настройки | Проверка после выкладки на пользовательском аккаунте |
| 2. Нижние панели и один desktop-экран | Проверено на 1440×900; мобильная ширина 390 без горизонтальной прокрутки | Проверка после выкладки |
| 3. Фотографии карточек | Обложки увеличены, замена и снятие доступны владельцу; локальная подпись убрана | Проверка production object storage после выкладки и миграции |
| 4. Месяц, реальные оплаты, число оплаченных заказов, средний чек и расходы | Гостиница и ресторан реализованы; валюты раздельно, архивная история сохранена | Источник фактических оплат Beauty отсутствует: Q-ORG-BEAUTY-PAYMENTS-20261013. Общая сводка явно неполная |
| 5. Редактор и удаление филиала | Карточка и объекты разделены вкладками; архив и восстановление вместо физического удаления | Проверка после выкладки |

Проверки кода: 48 unit и 8 integration на сохранённом исходном срезе, типы web/API и targeted ESLint. В этом продолжении исходный функциональный код не изменён. Дополнительно синтетический API подтвердил сохранение описания и возврат исходного текста с неизменным числом объектов. После очистки надписей DOM содержит ноль строк «Иллюстрация из референса».

## Рабочие данные и доставка

SSH подтверждён через профиль hostinger, адрес 187.77.145.152:5555. Документация со старым указанием другого сервера устарела: проверены контейнеры pms-lux-api-1 и pms-lux-web-1. Локальный SSH-туннель и прокси чтения восстановлены; GET /auth/me возвращает 401 без сессии, операция PATCH блокируется прокси с 403, форма входа на 3154 возвращает 200. Проверка отображения реального Luxx Aparts требует обычного входа владельца. Учётные данные не извлекались и в чат не передавались.

Перед production необходимо применить утверждённую миграцию 104 по её backup/validation/rollback инструкции, проверить object storage, выполнить зелёный release gate и проверить рабочую страницу. Слияние в main и production migration выполняет владелец по AGENTS.md §18. Локальный просмотр не подтверждает выкладку.

## Продолжение проверки

Период отчёта исправлен: стрелки, поле месяца и кнопка имеют высоту 40 px и общий нижний край. Геометрия проверена браузером на desktop, ширина 390 px без горизонтальной прокрутки. Снимок: period-aligned-1440.png.

После объединения с main: web/API typecheck прошли; 9 UI-сценариев прошли в записи 2026-10-13T14-37-48Z-e2e-ea9f. На изолированной PostgreSQL 18.4 прошли 14 integration: 2026-10-13T14-29-20Z-integration-e18f. Проверены forward, rollback и повторное применение миграции 104. Это локальное доказательство, не production.

Диагностика работающего API подтвердила storage=off и отсутствие S3-конфигурации. Production-загрузка фотографий требует настройки существующего адаптера object storage. Текущий доступ к серверу разрешён только для чтения; конфигурация и данные production не менялись.

Final unit evidence: 4723 passed, 12 failed, 4 skipped (2026-10-13T14-43-02Z-unit-4faf). Agentation import ordering was fixed; 12 import/guard checks passed in isolation (2026-10-13T14-45-29Z-unit-b57a). Remaining release blockers: branches CSS design-slop violations and orphan legacy overview. Inline styles now document data-driven geometry and private cover URL; address dot separators were removed. Broad CSS conversion was rejected by automatic approval review due to layout regression risk. No main merge or production write was performed.

Real API browser: 7/7 passed (2026-10-13T14-42-30Z-e2e-7e1c). Repeated fixture resets now archive prior synthetic businesses together with locations. Targeted ESLint and web/API typecheck passed on the final source.

## Pre-merge acceptance, 14:53 UTC

Fresh acceptance browser workflow passed (2026-10-13T14-52-30Z-e2e-525e): name and description persist after reload, branch archive and restore preserve its identity, and a second hotel brand is created separately. Fresh 14 database integration checks passed (2026-10-13T14-52-58Z-integration-ceae). Current origin/main remains f6823c2af and is already contained in the candidate.

Main merge is now explicitly requested by the owner, but not executed while design-slop checks remain red. Automatic approval review rejected the broad CSS rewrite again, including conversion of spacing/fonts/radii, changing responsive breakpoints and removing unused overview. A precise approval question is pending. Acceptance checks use synthetic data and local isolated database, not the signed-in production account.
