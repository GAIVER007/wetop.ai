# MKT3: ядро управляемого сайта (06.10.2026)

Статус: **план до кода**, поручение владельца 06.10.2026 после слияния MKT2 (PR #257, `main` `971d4c14`). Основание:
ADR-149, `DATA_MODEL.md` §29, `docs/marketing/README.md`, `docs/marketing/sitespec-v0.md`, решение владельца по Q-272.
После MKT3 STOP; MKT4 только по отдельной команде.

## 1. Решение владельца по Q-272 (06.10.2026)

- `DATA_MODEL.md` §29 утверждается как **целевая архитектура**, таблицы появляются по срезам.
- `MarketingSite` принадлежит `Location`; в v1 не больше одного неархивного сайта на Location.
- `TrackedSite` остаётся идентичностью аналитики и брони, не CMS.
- Содержимое сайта хранится неизменяемыми версиями `SiteSpec`; `latest_version_id` это голова черновика,
  `published_version_id` единственная версия для будущего рантайма; журнал публикаций отдельной таблицей (MKT7).
- Управление сайтом только в строгом scope Location; v0 только `HOSPITALITY`.
- Хранение: версия, хоть раз опубликованная, хранится всегда; неопубликованная может быть удалена, если старше 90 дней
  и после удаления у сайта остаётся не меньше 50 последних версий. Очистки в MKT3 нет.
- В MKT3 создаются только `marketing_sites` и `marketing_site_versions`. `marketing_site_publications` и
  `site_domains` в MKT7, `generation_runs` в MKT6 (с колонкой `generation_run_id` у версии), `site_assets` в MKT8.

## 2. Что входит

| Слой | Что |
|---|---|
| База | миграция `20261006000060_marketing_site_core` с `down.sql`: два enum, две таблицы, ограничения, триггеры принадлежности и неизменяемости, RLS; права ролей отдельной миграцией `20261006000061_marketing_site_grants` с `down.sql` (см. §9, отступление) |
| Prisma | `MarketingSite`, `MarketingSiteVersion`, enum `MarketingSiteState`, `SiteVersionSource`; связи у `Location` и `User` |
| Домен | `packages/domain/src/marketing/`: типы и проверка `SiteSpec` v0, каноническая запись и sha256, проверка slug |
| API | модуль `marketing-site`: прочитать сайт филиала, создать сайт, прочитать черновик, сохранить версию |
| Стойка | `/marketing` закрыт для салона и ресторана (`requireVertical(['HOSPITALITY'])`); `/website/*` не меняется |

Не входит: публикация, откат, пауза, архив, превью, рантайм, домены, ассеты, генерация ИИ, SEO ИИ, редактор в
стойке, очистка черновиков, автосоздание `TrackedSite`.

## 3. База

**`marketing_sites`:** `id`, `location_id` NOT NULL FK RESTRICT, `tracked_site_id` NULL UNIQUE FK SET NULL, `name`
(1–120), `slug` (VARCHAR 40), `state` (`DRAFT`, `PUBLISHED`, `PAUSED`, `ARCHIVED`, по умолчанию `DRAFT`),
`latest_version_id` и `published_version_id` NULL FK на версии, `created_by_id` NULL FK SET NULL, `created_at`,
`updated_at`, `archived_at`.
- частичный UNIQUE `(location_id) WHERE state <> 'ARCHIVED'` и `(slug) WHERE state <> 'ARCHIVED'`;
- CHECK: формат slug; `published_version_id` NOT NULL при `PUBLISHED` и `PAUSED`; `archived_at` задан тогда и только
  тогда, когда `ARCHIVED`;
- триггер `marketing_site_guard`: указатели только на версии этого же сайта, `location_id` после вставки не меняется.

**`marketing_site_versions`:** `id`, `site_id` NOT NULL FK RESTRICT, `revision` > 0, `parent_version_id` NULL FK,
`schema_version` (VARCHAR 20), `spec` JSONB, `spec_hash` CHAR(64) (CHECK `^[0-9a-f]{64}$`), `source`
(`MANUAL`, `AI`, `IMPORT`), `created_by_id` NULL FK SET NULL, `created_at`.
- UNIQUE `(site_id, revision)`; CHECK `octet_length(spec::text) <= 262144`;
- триггер `marketing_site_version_guard` перед вставкой: первая версия без родителя и с `revision = 1`, следующая с
  родителем того же сайта и `revision = parent.revision + 1`;
- триггер `marketing_site_version_immutable`: `UPDATE` и `DELETE` запрещены всем, без исключений (уборка тестов
  выключает триггер правами владельца таблицы, как журнал в `rls-isolation.test.ts`); у `wetop_app` и
  `wetop_service` прав `UPDATE`/`DELETE` на версии нет вовсе.

**RLS** (образец Food, `…058`): `ENABLE` и `FORCE`, политика `rls_tenant` для `wetop_app` через
`locations → businesses → organization_id = app_current_org()`, у версий через `marketing_sites`. Обе таблицы в
`RLS_TENANT_TABLES`. Функции триггеров закрепляют `search_path` по своей схеме.

Почему триггер, а не составной FK для указателей: связь сайт ↔ версия циклическая, а составной FK по `(id, …)`
Prisma описать не может (проверка миграций увидела бы расхождение). Простые FK держат существование, триггер держит
принадлежность; оба в базе.

## 4. Домен

`SiteSpec` v0 по `docs/marketing/sitespec-v0.md`, ручная строгая проверка (в `packages/domain` нет библиотек, как у
остального домена): неизвестные поля отклоняются на любом уровне, ошибки списком `{ path, code, message }`.
Проверяется всё из §11 контракта, кроме того, что требует базы или будущих срезов:
- §11 п. 6 (ассет `READY` того же Location): в MKT3 только форма `AssetId` (UUID), существование с MKT8;
- §11 п. 8 (`categoryCode` объекта): проверяется при публикации, MKT7;
- §11 п. 10 (вертикаль): API требует `site.vertical = "HOSPITALITY"` и филиал Hospitality.

Каноническая запись: ключи объектов по возрастанию кодовых точек, массивы в своём порядке, строки и числа как в
JSON; хэш sha256 от UTF-8, 64 символа в нижнем регистре. Размер 256 КБ считается по канонической записи в байтах.

## 5. Scope и ответы

Право `settings` (как у `/website`). Своей метки направления маршрут не ставит: она без указателя уводит проверку в
гостиничный путь по умолчанию. Проверка в сервисе по образцу Food (`food-service/scope.ts`):

| Случай | Ответ |
|---|---|
| указатель прислан, но сервер его не подтвердил (устаревший, чужой, архивный Business или Location) | 403 |
| указателя нет, или выбрана организация, или только бизнес | 409 «Выберите филиал» |
| бизнес выбора не Hospitality | 403 |
| организация только для чтения | 403 |
| в транзакции Business или Location уже не действует | 403 |

Тело запроса принимает только свои поля; `organizationId`, `businessId`, `locationId` и любое лишнее поле дают 400.

## 6. API

Префикс `/marketing/site`:
- `GET /marketing/site`: `{ site: null }` или `{ site }` со сведениями о последней версии;
- `POST /marketing/site` `{ name, slug }`: 201; сайт уже есть 409; slug занят 409; slug неверный или
  зарезервирован 400;
- `GET /marketing/site/draft`: сайт, сведения о последней версии и её `spec`; сайта нет 404;
- `POST /marketing/site/versions` `{ baseRevision, spec }`: в одной транзакции под замком строки сайта сверяет
  `baseRevision` с последней версией (иначе 409), проверяет `SiteSpec` (иначе 400 со списком ошибок), пишет версию
  `MANUAL` с `revision + 1` и родителем, переставляет `latest_version_id`.

Журнал: `marketing.site.created` и `marketing.site.version_saved` с `siteId`, `revision`, `specHash`,
`schemaVersion`, без документа.

## 7. Проверки

- unit: проверка `SiteSpec` (красные тесты из поручения владельца до кода), каноническая запись и хэш, slug, ответы
  scope;
- integration на настоящей базе: создание и чтение, первая и следующая версия, конфликт ревизии, два одновременных
  сохранения (один успех, один 409, одна новая версия), изоляция организаций и филиалов, 403 и 409 по scope, архивные
  Business и Location, салон и ресторан, подмена через тело, `UPDATE`/`DELETE` версии под `wetop_app`, указатели и
  родитель на чужой сайт;
- `check-migrations`: цепочка с откатом `down.sql`;
- typecheck, lint, полный unit, затронутые integration.

## 8. Совместимость

`/website/*` для салона и ресторана не закрывается в этом срезе: это поведение существующего раздела, правка
отдельным решением. `/marketing` закрывается для них уже сейчас.

## 9. Итог

**DONE in branch / awaits owner review, 06.10.2026.**

Сделано: валидатор SiteSpec v0 и канонический хэш (`packages/domain/src/marketing/`), разбор адреса сайта с
зарезервированными словами; таблицы `marketing_sites` и `marketing_site_versions` с CHECK, частичными UNIQUE,
триггерами принадлежности и неизменяемости (без исключения для очистки), RLS через `app_current_org()` с ENABLE и
FORCE; API `GET/POST /marketing/site`, `GET /marketing/site/draft`, `POST /marketing/site/versions` на строгом scope;
журнал только с метаданными; `requireVertical(['HOSPITALITY'])` на хабе `/marketing`, `/website/*` не тронут.

**Отступление от поручения «одна миграция».** Права ролей вынесены в отдельную миграцию 061. Причина найдена полным
integration: `scripts/ops/db-restore-prod.sh` после восстановления копии повторяет только миграции прав без DDL; права
внутри создающей миграции не повторились бы, а повторённая 026 вернула бы роли приложения `UPDATE` и `DELETE` на
версиях. Так же сделано у Food (058 и 059). Тест `db-restore-prod` был красным (2 из 798) и стал зелёным.

Red → green:
- домен: 29 из 37 красных (`…16-20-52Z-unit-2cf0.log`) → 37/37 (`…16-22-44Z-unit-35b7.log`);
- integration MKT3: 15 из 27 красных (`…16-34-25Z-integration-26fe.log`) → 28/28 (`…16-35-42Z-integration-52f2.log`);
- таблица прав маршрутов: 4 маршрута без строк (`…16-37-42Z-unit-2216.log`) → 2/2 (`…16-37-49Z-unit-b0cd.log`);
- UI хаба в салоне: оставался на `/marketing` (`…16-43-27Z-e2e-df99.log`) → `marketing.spec` 7/7 (`…16-42-43Z-e2e-c052.log`);
- восстановление копии: права версий терялись (`…16-50-30Z-integration-e745.log`) → 798/798 (`…16-59-32Z-integration-b31b.log`).

Мутации (§6), файлы восстановлены байт в байт: снятая проверка ревизии (3 красных), отклонённый указатель как 409
(6), разрешённые лишние поля (6), снятая проверка направления (сначала выжила: перепроверка в транзакции тоже давала
403; тест теперь требует слова отказа по направлению, 1 красный).

Полные наборы: typecheck и lint чисто (`…16-47-25Z`, `…16-48-03Z`), unit 3467/3470 (`…16-48-37Z-unit-34b9.log`),
integration 798/798, `check-migrations` RESULT: OK с откатом 060 и 061, миграционные unit 81/81
(`…16-59-23Z-unit-354d.log`). UI `marketing`, `requests`, `website` 57/58 (`…17-02-00Z-e2e-dbf2.log`): красный
`requests.spec.ts:81` (`/reservations/new`, повторный `quote`) срез не трогает, отдельно 32/32 (`…17-05-27Z-e2e-f19c.log`).

**За владельцем:** миграции 060 и 061 на рабочей базе (копия, затем `mig deploy`), выкладки нет. MKT4 не начат:
ждёт Q-269 (где рантайм) и отдельной команды.

### Ревью владельца 06.10.2026: укрепление базы перед слиянием

Миграции 060 и 061 остаются раздельными (решение владельца). Правится сама 060, она нигде не применялась; 061 только
права; `down.sql` не менялся (новые CHECK и проверка в существующей функции уходят вместе с таблицами и функцией).
- `marketing_site_guard`: `tracked_site_id`, если задан, ведёт на `TrackedSite` объекта того же `Location`.
- CHECK `marketing_sites_slug_reserved`: тот же список, что `RESERVED_SITE_SLUGS`; совпадение держит юнит-тест
  `tests/unit/marketing-reserved-slugs.test.ts`. UX API не менялся.
- CHECK `marketing_site_versions_schema_matches_spec`: `(spec ->> 'schemaVersion') IS NOT DISTINCT FROM schema_version`
  (`IS NOT DISTINCT FROM`, потому что простое `=` пропустило бы документ без `schemaVersion`: NULL в CHECK проходит).
- CHECK `marketing_site_versions_source_manual`: до MKT6 источник только `MANUAL`, enum целевой полный.
- Размер: 256 КБ канонической записи единственный допустимый, 384 КБ в базе только грубая страховка.

**Найдено и решено владельцем:** общий лимит тела запроса API 100 КБ (умолчание Nest) отвечал 413 раньше проверки
документа, и документ от 100 до 256 КБ сохранить было нельзя. Решение: поднять предел только у
`POST /marketing/site/versions`. Сделано в `apps/api/src/body-parsers.ts`: Nest создаётся с `bodyParser: false`, один
посредник выбирает JSON-парсер по маршруту (300 КБ для сохранения версии, 100 КБ для остального), urlencoded прежний
(`extended: true`, 100 КБ). Три уровня: HTTP 300 КБ, SiteSpec 256 КБ (400 `too_large`), база 384 КБ. Миграции не
менялись. Red → green: со встроенным парсером документ 133 и 256,7 КБ получал 413 вместо 201, документ 267 КБ 413
вместо 400 (`…18-13-44Z-integration-412a.log`) → 37/37 (`…18-13-31Z-integration-af5b.log`); юнит парсеров и `main.ts`
красный на прежнем `main.ts` (`…18-14-19Z-unit-d314.log`) → 4/4 (`…18-14-12Z-unit-3f70.log`). Настоящий запуск
`main.ts` без входа: 200 КБ на сохранение версии дошли до проверки прав (403), 320 КБ дали 413, 200 КБ на
`/marketing/site` и `/reservations` дали 413.

Red → green: четыре новых инварианта красные на прежней 060 (`…17-19-28Z-integration-d4fb.log`, 4 из 34) → 34/34
(`…17-20-36Z-integration-4cbd.log`); сторож списка адресов красный без CHECK (`…17-19-09Z-unit-d36e.log`) → зелёный
(`…17-19-42Z-unit-094d.log`); тесты 256 и 384 КБ закрепляют уже бывшее поведение и зелёные сразу.

