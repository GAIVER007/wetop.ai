# MV8.5 DS2a: один реестр меню и одно правило активного пункта (09.10.2026)

База: ветка начата от `origin/main` `d0eb1e623` (слияние PR #314, план DS2), в неё трижды влит `main` (последний раз `f39b66092`). `release` = `ecb0d629`, не тронут. API, база, миграции, права страниц не менялись.
План: `plans/mv8-5-ds2-shell-navigation-2026-10-09.md` §12–§14, §16.2 (DS2a), с тремя уточнениями владельца от 09.10.

Что сделано одной фразой: у каждого направления теперь свой реестр меню с `id` и префиксами подсветки, а строка вкладок, меню в окне, нижняя панель телефона и кнопка «Ещё» берут подсветку у одной функции `activeItem`. Состав меню, подписи, разметка, CSS и геометрия прежние; единственная видимая правка состава: ссылка «Сотрудники и доступ» у салона и ресторана ведёт сразу на `/team`.

---

## 1. Контракт реестра

`apps/web/src/lib/navigation.ts`

| Что | Как |
|---|---|
| `MenuItem` | `NavigationItem` + `id`, `match?: string[]` (префиксы подсветки, по умолчанию `[href]`), `hidden?: true` |
| Реестры | `hospitalityRegistry`, `beautyRegistry`, `foodRegistry`; `menuRegistry(vertical)` отдаёт полный, со скрытыми пунктами |
| Видимое меню | `menuSections`, `beautyMenuSections`, `foodMenuSections` = реестр без скрытых пунктов и без пустых разделов. `menuSectionsFor` и `phoneNavigationFor` не менялись |
| `activeItem(path, vertical, access)` | Путь без `?…`, `#…`, хвостового `/`; пункты только этого направления и только открытые этой роли (`allowedItem`); префикс совпадает целым сегментом; самый длинный выигрывает, при равенстве первый по порядку. Возвращает `{ sectionId, itemId, href }` или `null` |
| Незнакомое направление | `null`. `activeItem` гостиницу не угадывает (`undefined`, `null`, `'RETAIL'`, `''` закреплены тестом) |
| `routeRule`, `AccessGate`, `activeNavigation` | Без изменений. `routeRule` поле `match` не читает. `activeMenuRoute` удалена: у неё не осталось потребителей |

**Скрытые до DS2b пункты** (есть в реестре, подсвечиваются, в меню не видны):

| Направление | Пункт | Раздел | Право |
|---|---|---|---|
| все три | «Филиалы» `/branches` | `settings` | `desk` (у всех ролей, `AccessGate` как и раньше страницу не проверяет) |
| гостиница | «Техподдержка WETOP» `/platform/support` | `settings` (вкладку «Платформа» владелец снял в `main` 09.10, «Организации» теперь в «Настройках») | `platform` |
| гостиница | «Профиль» `/profile`, «Помощь» `/help` | `account` | `desk` |
| салон | «График» `/beauty/schedule` | `schedule` | `desk` |

«Филиалы» в `navigation` (реестр прав) не добавлены, поэтому `routeRule('/branches')` по-прежнему пуст (это F7, не DS2a).

**Префиксы подсветки** (кроме `[href]`):

| Пункт | `match` |
|---|---|
| гостиница «Главная» | `/today`, `/tasks` |
| гостиница «Гости и бронирования» | `/guests`, `/reservations` (одна вкладка вместо «Броней» и «Гостей», решение владельца 09.10, пришло из `main` во время работы) |
| «Каналы продаж» | `/channels`, `/channel-manager`, `/connections/channex` |
| «ИИ-продавцы» | `/ai-agents`, `/ai-seller` |
| «Сайт и SEO» | `/marketing`, `/website` |
| «Аналитика» гостиницы | `/management` |
| «Номерной фонд» | `/inventory`, `/rooms`, `/rates`, `/units` |
| «Сотрудники и доступ» (три направления) | `/team`, `/staff` |
| салон «Календарь» | `/calendar`, `/beauty` |
| салон «Мастера» | `/employees`, `/beauty/masters` |
| салон «Услуги» | `/services`, `/beauty/services` |

## 2. Матрица активного пункта

Закреплена `apps/web/src/lib/navigation-active.test.ts`; `раздел>адрес`, `нет` = ничего не горит.

| Путь | Гостиница | Салон | Ресторан |
|---|---|---|---|
| `/today`, `/today?date=…` | home>/today | today>/today | today>/today |
| `/tasks` | home>/today | нет | нет |
| `/chessboard` | chessboard | нет | нет |
| `/reservations`, `/new`, `/ABC`, `/ABC/print/invoice`, `/reservations/`, `?status=new#top` | reservations | нет | нет |
| `/reservations-old`, `/websites` | нет | нет | нет |
| `/guests`, `/guests/123`, `/guests/123/preview`, `/guests/birthdays` | guests>/guests | | |
| `/inventory`, `/rooms`, `/rooms/categories`, `/rates`, `/units/R01` | inventory>/inventory | нет | |
| `/market` | sales>/market | | |
| `/channels`, `/channels/events/rev-1`, `/channels/sync`, `/channel-manager`, `/connections/channex` | sales>/channels | | |
| `/connections` | settings>/connections | | |
| `/ai-agents`, `/ai-agents/new`, `/ai-seller`, `/ai-seller/knowledge` | sales>/ai-agents | | |
| `/marketing`, `/marketing/site/editor`, `/website`, `/website/booking` | marketing>/marketing | нет | нет |
| `/reports`, `/reports/form-910` | reports>/reports | | |
| `/management`, `/management/analytics`, `/management/analytics/units` | reports>/management/analytics | analytics (только `/management/analytics`) | то же |
| `/hotel-settings`, `/hotel-settings/stay`, `#services` | settings>/hotel-settings | | |
| `/team`, `/staff` | settings>/team | team>/team | staff>/team |
| `/branches` | settings>/branches | settings>/branches | settings>/branches |
| `/journal` | settings>/journal | journal | journal |
| `/incidents` | settings>/incidents | | |
| `/platform` | settings>/platform | | |
| `/platform/support`, `/platform/support/knowledge` | settings>/platform/support | нет | |
| `/profile`, `/profile/access` | account>/profile | profile>/profile | profile>/profile |
| `/help` | account>/help | help>/help | help>/help |
| `/calendar`, `/beauty`, `/beauty/` | нет | calendar>/calendar | нет |
| `/appointments` | | appointments | |
| `/customers` | | customers | customers (подпись «Гости») |
| `/employees`, `/beauty/masters` | нет | employees>/employees | |
| `/beauty/schedule` | нет | schedule>/beauty/schedule | нет |
| `/services`, `/beauty/services` | | services>/services | |
| `/floor-plan`, `/table-reservations`, `/dining-areas` | нет | нет | свой пункт |

Роль закреплена тем же тестом: администратору (`STAFF`) не горят `/team` и `/hotel-settings`, горят `/incidents`, `/reports`, `/branches`; владельцу без отметки главного администратора не горят «Организации» и «Техподдержка»; без вошедшего (`CLOSED_ACCESS`) горит всё, как и меню; `PENDING_ACCESS` и `UNKNOWN_ACCESS` как администратор.

**Отступления от таблицы плана §12, все в пользу «состав меню в DS2a прежний»:**
1. `/profile`, `/help` гостиницы: в плане «профиль». В DS2a это скрытый раздел `account`: вкладки у него нет, кнопка профиля в шапке DS2a не трогается (её переделка в DS2b). Видимой подсветки нет, как и раньше.
2. `/profile`, `/help` салона и ресторана: вкладки «Помощь» и «Профиль» в их меню пока видимые (уходят в меню профиля в DS2b), поэтому горят свои вкладки.
3. `/` в матрицу не входит: корень сам переводит на посадку направления.
4. `/guests*` и `/reservations*` гостиницы: в плане это две вкладки, «Брони» и «Гости». Пока шла работа, владелец в `main` дважды поменял решение: сначала «Гости» стали вкладкой внутри «Броней», затем обе вкладки заменила одна, «Гости и бронирования» на `/guests`. Итог в реестре: пункт `guests` с `match: ['/guests', '/reservations']` вместо удалённой `activeMenuRoute`; тест `workspace-organization.test.ts` из `main` переведён на `activeItem` с теми же ожиданиями (пять адресов, все дают «Гости и бронирования»).
5. `/platform/support`: в плане «Платформа → Техподдержка» (В4). Вторым слиянием `main` пришло решение владельца снять вкладку «Платформа» и перенести «Организации» в «Настройки»; скрытая «Техподдержка» переехала туда же, и `/platform/support` зажигает «Настройки». Эталон сторожа прав при этом поменялся ровно в одном месте: подпись правила `/team` стала «Сотрудники и доступ» (правка `main`), решения `AccessGate` прежние; сторож прогнан и на `navigation.ts` из `main`, и на ветке, оба раза 2 из 2.

## 3. Потребители

| Файл | Было | Стало |
|---|---|---|
| `components/shell/top-menu.tsx` | `activeMenuRoute(path)` в `TopMenu`, сравнение `item.href` | `activeItem` в `GrantedTabs` (там уже известны роль и вертикаль); вкладка горит по `sectionId`, ссылка списка по `href` |
| `components/shell/sidebar.tsx` | группа искалась в гостиничном `menuSections` (P3: у салона и ресторана не горело и не раскрывалось ничего) | `activeItem` в `GrantedSectionLinks`; туда же переехало состояние раскрытой группы |
| `components/top-nav.tsx`, нижняя панель | `activeNavigation(path)`, общий для всех направлений | `activeItem` |
| `components/top-nav.tsx`, «Ещё» | подсветки не было | `is-active`, если активный пункт живёт в видимом разделе меню, но не в панели. Класс и его стиль уже были (`.bottom-navigation .is-active`, `premium.css`), CSS не менялся |

Если обещания `desk` нет вовсе, меню показывается гостиничным (`menuSectionsFor`, как и раньше), и потребитель передаёт в `activeItem` ту же вертикаль, что и меню. Сама функция ничего не подставляет.

## 4. Права не изменились

`apps/web/src/lib/navigation-rights.test.ts` + `navigation-rights.baseline.json`. Снимок снят на нетронутом `d0eb1e623` до первой правки (коммит `feba6663`): 92 адреса из дерева `app/**/page.tsx` (динамические сегменты подставлены образцами, у `[[...section]]` корень и образец) × 6 состояний (владелец, управляющий, администратор, никто не вошёл, сбой `/auth/me`, главный администратор). Для каждого `routeRule(path)` (адрес, подпись, право) и решение `AccessGate` (`open`, `denied`, `unchecked`): 408 `unchecked`, 119 `open`, 25 `denied`. После DS2a снимок совпадает побайтно; тест держится до конца DS2c. Второй тест того же файла красный, если из дерева пропадёт адрес из снимка.

## 5. RED → GREEN

| Шаг | Прогон | Итог |
|---|---|---|
| RED | `tests/runs/logs/2026-10-09T12-20-34Z-unit-accb.log` | 16 из 28 красные: `activeItem` и `menuRegistry` нет, у салона и ресторана `/staff`; сторож прав зелёный (2/2) на нетронутом коде |
| GREEN, навигационные unit | `…12-33-44Z-unit-d70b.log` | 59 из 59 |
| Полный unit | `…12-35-33Z-unit-c08c.log` | 4163 из 4166, 3 пропуска (прежние) |
| lint | `…12-34-58Z-lint-43e7.log` | чисто |
| typecheck, сборка `apps/web`, затронутые UI | см. §7 | |

Тесты, в которых поменялись ожидания (ослаблений нет):
- `navigation-beauty.test.ts`, `navigation-food.test.ts`: `/staff` → `/team` в составе меню и в подписи «Сотрудники и доступ» (это и есть правка DS2a);
- `website-navigation.test.ts`: `activeMenuRoute` заменён на `activeItem`, проверка стала строже (раздел `marketing` плюс адрес `/marketing`).

Новые UI-проверки:
- `tests/ui/top-menu.spec.ts` «DS2a: адреса без своего пункта…»: `/units/R01`, `/connections/channex` (горит «Продажи», не «Настройки»), `/tasks`, `/staff` → `/team`, `/branches` и `/platform/support` (горит только группа «Настройки», ссылки нет), `/reservations-old`;
- `tests/ui/navigation.spec.ts`: нижняя панель и «Ещё» на 390;
- `tests/ui/beauty-branch.spec.ts` «DS2a: меню салона…»: `/team`, `/staff`, `/beauty`, `/beauty/masters`, `/beauty/services`, `/beauty/schedule` (не горит ничего), панель, «Ещё», меню в окне, axe;
- `tests/food-ui/food.spec.ts` «DS2a: Food menu…» на настоящем API: `/customers`, `/team`, `/staff`, панель, «Ещё», меню в окне, 390 без прокрутки вбок, axe в светлой и тёмной теме.

## 6. Снимки

`before/` и `after/`, по 34 файла, одни и те же экраны и темы. Сняты временным спеком на стенде `tests/branches-ui` (настоящий API, синтетические филиалы трёх направлений) после слияния `main`: «до» тем же спеком с четырьмя файлами оболочки из `main` `f39b66092`, «после» с ветки. Спек в коммит не входит. У гостиницы этого стенда нет единицы `R01`, поэтому `/units/R01` показывает «Страница не найдена»; на подсветку шапки это не влияет. Общий «как есть» всей шапки остаётся в `reports/mv8-5-ds2-audit-2026-10-09/asis/`.

| Экран | Было | Стало |
|---|---|---|
| `hospitality-units-R01-1440` | не горит ничего | «Номерной фонд» |
| `hospitality-connections-channex-1440` | «Настройки» | «Продажи»; в `…-open` внутри горит «Каналы продаж» |
| `hospitality-branches-1440` | не горит ничего | «Настройки» (пункт «Филиалы» появится в DS2b) |
| `hospitality-tasks-1440` | не горит ничего | «Главная» |
| `beauty-team-1440` | не горит ничего | «Сотрудники и доступ» |
| `beauty-masters-1440` | не горит ничего | «Мастера» |
| `beauty-schedule-1440` | не горит ничего | не горит ничего (вкладка «График» в DS2b) |
| `food-team-1440` | не горит ничего | «Сотрудники и доступ» |
| `beauty-calendar-390`, `food-floor-plan-390` | панель горит | панель горит, как раньше |
| `beauty-team-390`, `food-team-390`, `hospitality-units-R01-390` | ничего | горит «Ещё» |
| `…-more-390` (окно «Навигация») | ничего | горит свой пункт |

Обе темы у каждого экрана (`-light`, `-dark`). На паре снимков «до» видна подложка наведения на вкладке: это курсор Playwright после щелчка предыдущего шага, не состояние меню.

## 7. Проверки

Итоговый прогон на коде после третьего слияния `main` (`d0701181`, база `main` `f39b66092`), через `npm run test:record`, логи в `tests/runs/logs/`. Ранние прогоны (до слияний и после каждого из них) лежат там же: на каждом DS2a-тесты зелёные, красные только от `main`.

| Проверка | Лог | Итог |
|---|---|---|
| typecheck | `2026-10-09T18-42-08Z-typecheck-faa3.log` | чисто (первый прогон `…17-40-33Z-typecheck-cebf.log` дал 86 ошибок в `apps/api`: Prisma-клиент в контейнере был собран до изменения схемы в `main`; после `prisma generate` чисто) |
| lint | `…17-41-24Z-lint-3a68.log` | **1 ошибка не DS2a**: неразрывные пробелы в регулярке `tests/ui/reports-finance.spec.ts:16`, файл из `main` (`b4c721496`, RPT2.4a) |
| unit, полный | `…17-42-08Z-unit-a97d.log` | 4397 из 4400, 3 пропуска |
| сторож прав | в том же логе | зелёный; отдельно прогнан на `navigation.ts` из `main` (2 из 2) |
| сборка `apps/web` | вывод сборки | код выхода 0 |
| UI, часть 1 (21 спек: ИИ-агенты и продавец, аналитика, `beauty-branch`, `branches`, каналы, шахматка, `loading-performance` (бюджет запросов шапки), `market`, `marketing`, `mobile-adaptation` и др.) | `…17-45-38Z-e2e-d006.log` | 193 из 194, 1 красный не DS2a |
| UI, часть 2 (21 спек: `navigation`, `top-menu`, `accessibility` (axe по всем разделам, две темы, две ширины), `roles`, `platform-access`, `platform-support`, `team`, `staff`, `settings-simplification`, `workspace`, `reservations-v2-r2`, `login-access` и др.) | `…18-04-32Z-e2e-c2dd.log` | 241 из 242, 1 плавающий |
| `tests/beauty-ui` (настоящий API) | `…18-35-15Z-e2e-0f36.log` | 11 из 15, 4 пропуска (спек съёмки DS1c, включается переменной) |
| `tests/food-ui` (настоящий API) | `…18-36-57Z-e2e-fef7.log` | 15 из 19, 4 пропуска (то же) |
| `tests/branches-ui` (настоящий API, три направления) | `…18-43-13Z-e2e-920d.log` | 39 из 39 (первый прогон `…18-39-24Z-e2e-4865.log` упал на переключении филиала с «Объект не загружен»: тот же устаревший Prisma-клиент у API стенда; после `prisma generate` зелёный) |
| `git diff --check` | | чисто, кроме машинных логов `tests/runs/logs` (хвостовые пробелы вывода Playwright, как у логов в `main`) |

**Красные, которые не от DS2a.** Каждый UI-тест прогнан повторно с четырьмя файлами оболочки из `main` `f39b66092` (без записи в журнал).

| Тест | Откуда | На оболочке `main` |
|---|---|---|
| lint `tests/ui/reports-finance.spec.ts:16` | `main`, RPT2.4a | файл не мой |
| UI `mobile-adaptation.spec.ts:122` «цели не ниже 44 px» | поля ввода и ссылка «Открыть пример» на странице `/hotel-settings` ниже 44 px | красный |
| UI `support-kb.spec.ts:117` «создание записи» | плавающий | зелёный |

Красные прошлых прогонов (сторожа дизайна и шахматка после PR #317, `reservations-v2-r2:194`, `roles:36`, `no-hardcoded-utc5`) `main` уже починил сам, на итоговом коде они зелёные.

Ни один существующий тест не ослаблен.

## 8. Что не входит и что осталось

- DS2b (новый состав меню, меню профиля, шапка, поиск, иконки) и DS2c (перенаправления `/beauty*`, переходы между филиалами) не начаты.
- F1–F9 (план §15) не трогались. В частности F1: экран чужого направления по прямому адресу (например, `/website` в салоне) по-прежнему открывается, меню на нём просто ничего не подсвечивает. F5 (справка гостиницы на `/help`) остаётся условием приёмки DS2b. F7: у `/units/[code]` и `/branches` правила страницы нет, как и раньше.
- Ссылки на `/staff` вне меню (`app/help/page.tsx`, `components/shell/search.tsx`, `lib/scope-resolve.ts`) не менялись: это справка (F5), палитра (DS2b) и выбор филиала (F8). Перенаправление `/staff` → `/team` живо.
- `activeNavigation` остаётся только ради `routeRule`.
