# CORE-SECURITY-FIX-01, часть 2: отчёт исполнителя (O2=A, O3=A, A3/F6, O4=A)

Дерево: `/Users/urijzapojnov/Documents/ChatGPT/WETOP/.claude/worktrees/core-security-fix-01` (ветка `claude/core-security-fix-01-20261014`), база `127.0.0.1:55461/pmslocal`. Ничего не закоммичено. Логи красных и зелёных прогонов лежат рядом с отчётом в `scratchpad/csf01-notes/` (`ai-red.log`, `guest-red.log`, `self-red.log`, `failclosed-red.log`, `all-red-final.log`, `all-green-final.log`, `me-red.log`, `me-green.log`, `final-int.log`).

## Итог одним абзацем

Все четыре пункта закрыты по правилу red, затем минимальная правка, затем green. Финальный прогон четырёх новых файлов на ЧИСТОМ коде (мои 10 исходных файлов временно возвращены к `HEAD`): **48 красных из 124** (остальные 76 это контроли и места, уже безопасные); на моём коде **124 из 124 зелёные**. Соседи: unit `apps/api` + `packages` + `apps/web/src/lib` 344 файла, 3384 теста зелёные; интеграция 42 файла, 326 тестов зелёные; `npm run typecheck`, `npm run typecheck:api` чисто; eslint по всем моим файлам чисто. Миграций и правок `schema.prisma` нет.

## 1. P1 ИИ-продавец (O2=A)

**Было.** `AiSellerController` (`ai-seller.controller.ts:28-29`, 29 маршрутов), `BusinessAgentsController` (`business-agents.controller.ts:10`), `AgentInstructionsController`, `AgentTelegramController`, `SellerAgentsController` (`wizard/seller-agents.controller.ts:7`): `@Access('seller'|'dialogs')`. `RoleGuard` пускал ограниченного менеджера или администратора салона и ресторана (роль в его месте даёт `seller`/`dialogs`), `agentId = organizationId`, указатель не читался. Красное на чистом коде: ограниченный получает 200 на 44 маршрутах (профиль, промпт, ключ LLM, WhatsApp, диалоги, reply, takeover) и вызовы бота `putLlmKey`, `putWhatsApp`, `takeover`, `reply`.

**Как выражено.** Существующим механизмом, без параллельной RBAC: права `seller` и `dialogs` отнесены к `ORGANIZATION_LEVEL_PERMISSIONS` (там уже `staff`, `owner`, `journal`). Проверено, что эти права используют ТОЛЬКО маршруты ИИ-продавца и мастера агентов: `@Access('seller'|'dialogs')` встречается лишь в пяти контроллерах `ai-seller/*` и `wizard/seller-agents.controller.ts`; в сервисах `actorMay('seller')` и `can(role,'seller')` не менялись (они смотрят роль, а не область). Другие маршруты с этими правами не затронуты, потому что их нет. Метка `OrganizationLevel` для продавца не понадобилась.

**Изменено.**
- `packages/domain/src/accounts/scopes.ts:151-157` список `ORGANIZATION_LEVEL_PERMISSIONS` дополнен `'seller'`, `'dialogs'`, комментарий с основанием (O2=A).
- Эффект: `RoleGuard` (`role.guard.ts`, существующая ветка) отвечает ограниченному 403 «Этот раздел для сотрудников без ограничения по филиалам…»; веб-меню (`mayAccess` в `navigation.ts:667`) само прячет пункты «ИИ-продавцы», «Знания», «Подключения», «Агенты».
- `apps/web/src/lib/navigation-rights.baseline.json`: 3 строки (`/ai-seller/agents`, `/ai-seller/agents/123`, `/ai-seller/agents/new`, `restrictedManager` open -> denied). Сторож `navigation-rights.test.ts` требует обновлять снимок в PR прав: обновлён здесь.
- `agents/options` и `POST agents`: для ограниченного закрыты теперь целиком (по решению), фильтр по указателю `inScope` в `business-agents.service.ts` остаётся для неограниченных и не менялся (тесты `business-agents.scope.test.ts`, `tests/integration/business-agents.test.ts` зелёные).
- `DATA_MODEL.md` §31.6 пункт 2 дополнен.

**Тесты.** `tests/integration/core-security/scope-ai-seller.test.ts` (22). Матрица: 9 ограниченных (менеджер и администратор салона, менеджер ресторана, STAFF/MANAGER H1, H2, менеджер бизнеса `hot`, менеджер второй гостиницы `hot2`) x 44 маршрута (29 основных + агенты, инструкции, Telegram, `/seller-agents`, `claim`) x {свой указатель, без указателя} = 403 и ни одного вызова бота (`FakeConnection` из продукта); T08, T09, T10, S1, S2, S3, S5 отдельно; русский текст отказа; контроли: OWNER, ORG_MGR, ORG_STAFF открывают каталог, статус, `agents/options`; владелец достигает бота и меняет профиль; менеджер без назначений видит `/seller-agents` (`WIZARD_ENABLED=1`); администратор без назначений читает диалоги, но не настройки (права ролей прежние); чужая организация не видит данных A.
- Красное (чистый код): `ai-red.log`: 14 из 22 красных, например `BEA GET /ai-seller/status -> 200`, `bot: ['takeover']` вместо `[]`.
- Зелёное: 22 из 22 (стабильно, 3 прогона).
- Команда: `DATABASE_URL='postgresql://postgres@127.0.0.1:55461/pmslocal' npx vitest run --project integration tests/integration/core-security/scope-ai-seller.test.ts`
- Unit: `packages/domain/src/accounts/scopes.test.ts` (+1), `apps/api/src/auth/scope-enforcement.test.ts` (+3, замок ролей).

**Затронутые сценарии веба (O2).** Меню ограниченного больше не показывает ИИ-продавцов. По прямому адресу `/ai-agents` и `/ai-seller/*` страница открывается (для `dialogs` `openToEveryRole` отключает `AccessGate`) и показывает `LoadError` «Не удалось загрузить агентов»/ошибку, потому что API отвечает 403. `/sales` (`app/sales/page.tsx:53`) читает `sellerApi.status()` через `settle(...)`: блок продавца пустеет без падения страницы.

## 2. P1 Guest (O3=A)

**Было.** `guests.controller.ts` (`@Access('desk')`, право общее со всей стойкой гостиницы, поэтому закрыть правом нельзя): `GET /guests`, `/guests/birthdays`, `/guests/directory`, `/guests/:id/preview`, `/guests/:id`, `PATCH /guests/:id`, `POST /guests/:id/documents`, `DELETE /guests/:id/documents/:documentId`. Ограниченный STAFF/MANAGER филиала H1 читал и правил гостей H2 и другого бизнеса (G-1..G-6). Вторая дорога к тем же данным: `reservations.service.ts` `existingGuest` принимал `guestId` существующего гостя при создании брони (`guestForBooking` ищет по организации), после чего гость виден в карточке брони.

**Изменено.**
- Новая узкая метка `apps/api/src/auth/organization-level.decorator.ts` (`@OrganizationLevel(message)`, метаданные `wetop:organization-level-route`).
- `role.guard.ts`: для человека с областью (`isRestricted`) маршрут с меткой даёт 403 с текстом метки; неограниченным (владелец, менеджер, администратор без назначений) ничего не меняется.
- `guests.controller.ts:38` `@OrganizationLevel(RESTRICTED_GUESTS_MESSAGE)` на `GuestsController` целиком (`PiiStorageController` с флагом режима хранения не тронут: это не данные гостей).
- `packages/domain/.../scopes.ts` новые константы `RESTRICTED_GUESTS_MESSAGE` («Гости общие для всей организации: их открывают сотрудникам без ограничения по филиалам.») и `SCOPE_REJECTED_MESSAGE`.
- `request-context.ts:203` `actorIsRestricted()`; `reservations.service.ts:356`: ограниченному `guestId` существующего гостя в брони (и в расчёте `/reservations/quote`) даёт 403. Нового гостя вместе с бронью он заводит как раньше (проверено тестом).
- Схема `Guest`, миграции, варианты B и C: не трогались.

**Тесты.** `scope-guest.test.ts` (23): 9 ограниченных x гости {H1, H2, hot2, чужая организация} x 8 маршрутов x {свой указатель, без} = 403 и в ответе нет данных гостя; G-1..G-6 по отдельности (карточка другого филиала, другого бизнеса, превью с долгами, поиск и справочник без UUID, запись `PATCH` не меняет строку); G-7 чужая организация 404 в обе стороны; бронь существующему гостю 403 для ограниченного и не-403 для менеджера без назначений; бронь с новым гостем не закрыта; `/system/pii-storage` открыт; контроли OWNER, ORG_MGR, ORG_STAFF читают всех гостей, ищут, правят.
- Красное: `guest-red.log`: 13 из 23 красных (6 гостиничных ограниченных; три пользователя салона и ресторана уже были закрыты capability, это зелёные контроли).
- Зелёное: 23 из 23.
- Unit: `scope-enforcement.test.ts` (метка `@OrganizationLevel`).

### Список затронутых гостиничных сценариев ограниченного сотрудника (O3=A, НЕ исправлялись)

API: все 8 маршрутов `GuestsController` выше (403 + текст), `POST /reservations` и `POST /reservations/quote` с `guestId` (403).

Страницы и действия веба (что увидит пользователь):

| Что | Код | Что увидит ограниченный сотрудник гостиницы |
|---|---|---|
| Пункт меню «Гости и бронирования» (`/guests`, в меню гостиницы единственный вход и в «Брони», и в «Гости») | `app/guests/page.tsx:62-71`, `navigation.ts:182` | страница с заголовком, шапкой и кнопкой «Список броней», в теле `LoadError` («не загрузилось», 403 «Гости общие для всей организации…»). Список броней остаётся доступным по кнопке в шапке и по `/reservations` |
| Карточка гостя `/guests/[id]` (ссылки из брони: `reservations/[number]/page.tsx:126`, из шахматки: `chessboard/actions.ts:45`) | `app/guests/[id]/page.tsx:252` (`notFoundOn404` ловит только 404) | граница ошибки `app/guests/error.tsx`: «Экран не загрузился» |
| Дни рождения `/guests/birthdays` | `guests/birthdays/page.tsx:20` | страница открыта, показывает ошибку загрузки (ловится) |
| **Печать регистрационной карточки** `/reservations/[number]/print` | `print/page.tsx:76` `guestsApi.card(...)` без `catch` | **необработанное исключение, граница ошибки: печать карточки недоступна** |
| **Печать договора** `/reservations/[number]/print/contract` | `print/contract/page.tsx:34` `guestsApi.card(...)` без `catch` | **то же: договор не напечатать** |
| Форма новой брони: подсказка по телефону «такой гость уже есть» | `reservations/actions.ts:151` (`try/catch` возвращает `[]`) | подсказок нет, бронь с новым гостем создаётся как раньше |
| Новая бронь из карточки гостя (`?guest=`) | `reservations/new/page.tsx:48` (`.catch(() => null)`) | форма без предзаполнения |
| Бронь существующему гостю по `guestId` | `reservations.service.ts:356` | 403 (из UI недостижимо: подсказки уже пусты) |
| Ссылка «Проживают сейчас» в настройках | `hotel-settings/.../page.tsx:208` | ведёт на `/guests?state=inhouse`, то есть на экран с ошибкой |

REQUIRED OWNER DECISION (O3=A уже реализовано, как указано; решение нужно владельцу до выкладки):
1. Печать регистрационной карточки и договора для ограниченных администраторов гостиницы сломана (карточка читает паспортные данные гостя через `GET /guests/:id`). Это штатная операция стойки. Варианты: оставить как есть и сделать страницы печати устойчивыми (показать печатную форму без документа/ФИО из `primaryGuest.label` брони, как `print/contract/page.tsx:41` уже делает при `guest === null`), либо пересмотреть O3 в сторону B/C. Я ничего из этого не делал.
2. Единственный пункт меню гостиницы «Гости и бронирования» для ограниченного ведёт на экран ошибки. Нужна либо отдельная вкладка «Брони» для ограниченных, либо решение по O3.

## 3. A3 / F6: self-маршруты

**Было.**
- `onboarding.module.ts:269` `@Access('self') GET /onboarding`: `roleAtPlace` возвращается раньше проверки места (`author.interceptor.ts:116`), `SharedOnboardingService.context()` читал филиал по указателю без проверки назначений, отдавал черновик (`draft`), `businessId`, `locationId`.
- `auth.service.ts:214-235` `registrationContext(organizationId)` отдавал названия и id САМОГО РАННЕГО бизнеса и филиала организации любому, включая ограниченных.

**Изменено.**
- `onboarding.module.ts:80-87`: для ограниченного (`isRestricted(currentRole(), currentAssignments())`) место без назначения (`roleAt` = null) даёт 403 «У вас нет доступа к этому бизнесу или филиалу». Для владельца, менеджера и администратора без назначений ничего не меняется.
- `auth.service.ts:220-290`: `registrationContext(organizationId, access?)`; для ограниченного новый `restrictedRegistrationContext` берёт первый активный бизнес с первым НАЗНАЧЕННЫМ активным филиалом (`visibleLocations`), иначе `null`. `auth.controller.ts:217-224` передаёт роль и назначения. Заодно это правильнее для входа ограниченного (`login/actions.ts:152`).
- `GET /auth/me` не сломан и теперь дополнительно не подтверждает указатель на существующее, но не назначенное место (`auth.controller.ts:198-210`, `unassigned`): отдаёт пустой `context`, и стойка по `scopeIsStale` ведёт на `/scope/resolve`. Причина: до правки такой человек (назначение сняли, кука осталась) получал 403 на каждом маршруте и не получал редиректа на выбор филиала. Проверено пробой: `/auth/me` подтверждал pointer, `/tasks` отвечал 403 «нет доступа к этому бизнесу или филиалу».
- Остальные `self`-маршруты (`/auth/sessions`, `/auth/logout-all`, `/auth/password`, `/assistant/identity`) данных места не отдают, не менялись.

**Тесты.** `scope-self.test.ts` (50): T11 (+5 ограниченных с pointer на H2 без назначения: 403, в ответе нет метки черновика `S2SECRETDRAFT`); контроли: H2_MGR, H2_STAFF, HOT_MGR открывают черновик своего H2; неограниченные читают любой филиал; чужая организация; T12 и 8 ограниченных: `registration-context` только из назначений (H2 получает H2, а не самый ранний H1 «Luxx Aparts»); неограниченные получают прежнее (hot/h1); `/auth/me` 200 для всех 13 пользователей при чужом, битом, несовместимом и без-бизнесного указателях с пустым `context.businessId`; `/auth/me` для места без назначения (4 случая) не подтверждает выбор, для своего и свободного места подтверждает (6 случаев).
- Красное: `self-red.log` 14 красных на чистом коде (+4 красных `me-red.log` для `/auth/me` без назначения; один тест из первого прогона был неверно составлен для FOREIGN и исправлен).
- Зелёное: 50 из 50.
- Unit: `registration-context.test.ts` (+2).

## 4. F4a / O4=A: fail-closed

**Было.** `author.interceptor.ts` (HEAD `:166-178`): `scope()` на любой отказ `resolveScope` и на неразобранный заголовок возвращал `{scope: 'ORGANIZATION'}`; fail-closed только на маршрутах с `@RequiresBusinessCapability` (`:84-90`). Для остальных человеческих маршрутов отклонённый указатель молча становился самым ранним объектом организации (T13), `POST /tasks` писал в него (T14).

**Изменено.**
- `scope.ts:56` `hasScopePointer(header)`: «заголовок есть» (непустая строка или непустой массив) отличается от «заголовка нет» (нет, пусто, пробелы).
- `author.interceptor.ts:77-78, 112-122, 192-211`: `scope()` возвращает `{scope, rejected}`. `rejected` истинно, если указатель прислан и либо не разобран (битый uuid, повтор ключа, чужой ключ), либо разобран, но `resolveScope` вернул ORGANIZATION (чужая организация, архивный бизнес или филиал, филиал не из бизнеса, филиал без бизнеса). Без базы (`prisma` не передан, тестовые сборки) разобранный указатель не отклоняется, как было. Нет человека (служебный ходок): не отклоняется.
- На отклонённый указатель интерцептор бросает 403 «Выбранный бизнес или филиал недоступен. Выберите филиал заново.» (`SCOPE_REJECTED_MESSAGE`) до `roleAtPlace` и до обработчика, то есть запись `POST /tasks` не происходит.
- Что не менялось: заголовка нет вообще (организация, T14b), валидный указатель BUSINESS (T15 / F4b вне этого пункта), валидный LOCATION.

**Исключения из fail-closed (минимальные, с обоснованием).** `mayIgnoreRejectedPointer`: `@Public` (человека за запросом нет), `@Access('service')` (служебный ключ), `@Access('self')`, `@Access('platform')`, `@ScopeAware`.
- `GET /auth/me` (`self`): по нему и по пустому `context.businessId` стойка определяет устаревшую куку (`lib/scope-resolve.ts` `scopeIsStale`, `lib/scope-gate.ts` `redirectIfScopeStale`, который стоит в корневом `layout.tsx:105` `<ScopeGate />` для каждой страницы и в `requireVertical`). 403 на `/auth/me` ломал бы это восстановление.
- `GET /branches` и `/branches/overview` (`@ScopeAware`, `branches.ts:365`, `organization-summary.ts:231`; классы `business-cards.ts:267`, `branch-lifecycle.ts:85`): их зовёт `/scope/resolve` (`app/scope/resolve/route.ts` снимает куку, затем `branchesApi.list()`) и переключатель филиала ДО выбора указателя.
- Остальные `self`: `/auth/sessions`, `/auth/password`, `/auth/logout-all`, `registration-context` (его зовёт `verifyEmailAction` с кукой прежнего аккаунта), `/onboarding` GET, `/assistant/identity`: личные, места не выбирают.
- `platform`: раздел главного администратора указателя не использует.
- Цепочка восстановления проверена тестом: устаревшая кука -> `/auth/me` 200 с пустым `context.businessId` -> `/branches` 200 (ограниченному только его филиал) -> выбранный из ответа указатель открывает `/tasks`.

**Тесты.** `scope-fail-closed.test.ts` (39): 8 видов отклонённых указателей (чужая организация, `garbage`, `business=not-a-uuid`, несовместимая пара, повтор ключа, филиал без бизнеса, архивный филиал, архивный бизнес) x 8 маршрутов (`/tasks`, `/chessboard` с capability, `/hotel/settings`, `/finance/cash`, `/market/occupancy`, `/bar/categories`, `/guests/directory`, `/ai-seller/status`) для OWNER, ORG_MGR, ORG_STAFF и для ограниченных; FOREIGN с указателем A; T14 `POST /tasks` со stale-указателем для трёх неограниченных: 403 и ноль записей (в P1 и по всей базе); без заголовка 200 (T14b); пустой и из пробелов заголовок не отклоняется; пробелы вокруг валидного указателя допустимы; business-only указатель работает; валидный указатель H1/H2 работает (запись уходит в H2, не в самый ранний); исключения 200 для 8 пользователей x 8 видов x 5 маршрутов; цепочка восстановления; публичный `/auth/options` с мусорным заголовком 200; русский текст.
- Красное: `failclosed-red.log`/`all-red-final.log`: T13 x3, FOREIGN, T14 x3, текст отказа красные на чистом коде (в `failclosed-red.log` ещё 6 красных из-за моей опечатки пути `/branches/overview` без дат, исправлена).
- Зелёное: 39 из 39.
- Unit: `scope.test.ts` (+2), `author.interceptor.test.ts` (одно прежнее утверждение «тихо ORGANIZATION» заменено на 403: оно документировало fail-open), `scope-enforcement.test.ts` (+3 describe: исключения, служебный ходок, модуль без базы).

## Соседние прогоны (все зелёные)

- `npx vitest run --project unit apps/api packages apps/web/src/lib`: 344 файла, 3384 теста (включая `route-access.test.ts` на настоящем `AppModule`, `role.guard.test.ts`, `navigation-rights.test.ts`).
- Интеграция (42 файла, 326 тестов): мои 4 + `access-extensions`, `audit-author`, `audit-guest-identity`, `beauty-branch`, `booking-existing-guest`, `branches-scope`, `business-agent-identity`, `business-agents`, `desk-tasks`, `guest-card`, `guest-directory`, `integration-scope`, `manager-role`, `member-scopes`, `membership-scopes-schema`, `mv1-vertical-boundary`, `mv3-onboarding`, `mv4-beauty`, `mv6-food`, `mv8-branches-contract`, `onboarding-concurrency`, `onboarding-without-property`, `organization-isolation`, `request-scope`, `scope-hardening`, `seller-agent-scope`, `seller-scope-precheck`, `seller-catalog`, `seller-orgs`, `wizard-claim`, `wizard-drafts`, `reservation-create-retry`, `reservation-directory-filters`, `website-reservations`, `platform-extensions`, `platform-organization-create`, `organization-feedback`, `seller-booking-intents`. Отдельно 7 файлов маркетингового сайта (`site-*`, `marketing-site`, `licensed-site-builder`): 131 тест зелёный.
- `npm run typecheck` и `npm run typecheck:api` чисто (на дереве с чужими правками другого исполнителя). `npm run typecheck:web` падает на `qrcode-generator` в `app/food/rating-parts.tsx` (нет модуля в этом дереве, к моим файлам отношения нет).
- eslint по всем моим файлам чисто. Prettier: файлы, чистые до правки (`onboarding.module.ts`, `request-context.ts`, новые), чистые; `author.interceptor.ts`, `role.guard.ts`, `auth.service.ts`, `auth.controller.ts`, `reservations.service.ts`, `scopes.ts` не были форматированы по prettier и до меня (их целиком не форматировал, чтобы не раздувать дифф).

## Что НЕ покрыто и риски

- Ограниченные сотрудники в production: есть ли они, не проверено (определяет срочность).
- F4b (BUSINESS-указатель выбирает самый ранний филиал бизнеса) не менялся; валидный BUSINESS остаётся принятым.
- Данные организационного уровня вне двух решений (каталоги мастеров, услуг, клиентов Beauty/Food, меню): F3, не трогал по поручению.
- Бот-продавец остаётся организационным: бот сам границу не знает, она теперь только в API.
- Страницы веба `/ai-agents*`, `/ai-seller/*` для ограниченного открываются по прямому адресу и показывают ошибку загрузки, а не редирект (`openToEveryRole` для `dialogs`); это UX, не утечка.
- Серверные действия стойки с устаревшей кукой до срабатывания `ScopeGate` покажут пользователю текст «Выберите филиал заново» (раньше действие молча работало на самом раннем объекте).
- Резервные клиенты API вне веба с устаревшим указателем теперь получают 403 вместо данных самого раннего объекта (это и есть решение O4).
- Не покрыто тестами: исключение для `@Access('service')` на HTTP-уровне (служебный ключ в тестовом мире убран); покрыто unit-тестом перехватчика.
- T03b из CORE-01 не переносился, как просили.
- `CLAUDE.md` §2 не правил (параллельные сессии), запись о срезе остаётся за владельцем/координатором.

## Изменённые и добавленные файлы (git status, только мои)

Изменены:
`DATA_MODEL.md`, `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`, `author.interceptor.ts`, `author.interceptor.test.ts`, `registration-context.test.ts`, `request-context.ts`, `role.guard.ts`, `scope-enforcement.test.ts`, `scope.test.ts`, `scope.ts`, `apps/api/src/guests/guests.controller.ts`, `apps/api/src/onboarding/onboarding.module.ts`, `apps/api/src/reservations/reservations.service.ts`, `apps/web/src/lib/navigation-rights.baseline.json`, `packages/domain/src/accounts/scopes.ts`, `scopes.test.ts`.

Добавлены:
`apps/api/src/auth/organization-level.decorator.ts`, `tests/integration/core-security/scope-world.ts`, `scope-ai-seller.test.ts`, `scope-guest.test.ts`, `scope-self.test.ts`, `scope-fail-closed.test.ts`.

НЕ мои (изменения другого исполнителя в том же дереве, не трогал): `apps/api/src/beauty/appointments.ts`, `beauty/schedule.ts`, `database/connection.ts`, `database/connection.test.ts`, остальное в `tests/integration/core-security/` (`harness.ts`, `world.ts`, `system-connection.test.ts`, `customer-explicit-id.test.ts`, `beauty-*.test.ts`).

`git diff --stat` по моим файлам: 17 файлов, +432 / -32 (без новых файлов). Новые тестовые файлы: `scope-world.ts` 491 строка, `scope-ai-seller.test.ts` 267, `scope-fail-closed.test.ts` 273, `scope-guest.test.ts` 220, `scope-self.test.ts` 193.

## Команды

```
DATABASE_URL='postgresql://postgres@127.0.0.1:55461/pmslocal' npx vitest run --project integration tests/integration/core-security/scope-ai-seller.test.ts tests/integration/core-security/scope-guest.test.ts tests/integration/core-security/scope-self.test.ts tests/integration/core-security/scope-fail-closed.test.ts
npx vitest run --project unit apps/api packages apps/web/src/lib
npm run typecheck && npm run typecheck:api
npx eslint <мои файлы>
```
