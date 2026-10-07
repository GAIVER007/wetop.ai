# Генерация сайта v0: первая версия управляемого сайта от ИИ

Срез MKT6. Код: правила `packages/domain/src/marketing/generation.ts`, постановка и статус
`apps/api/src/marketing-site/generation.service.ts`, очередь и воркер `apps/api/src/marketing-site/generation.worker.ts`,
порт к боту `generation.bot.ts`, вход бота `apps/ai-seller/src/site_generation_router.py` и `src/ai/site_generation.py`.
Модель данных: `DATA_MODEL.md` §29.3, §29.7. План и решения: `plans/mkt6-ai-site-generation-2026-10-07.md`. Бюджет:
решение владельца по Q-274 (`QUESTIONS.md`).

## 1. Поток

```
GET /marketing/site/brief            человек смотрит бриф, видит briefHash
POST /marketing/site/generations     { requestKey, expectedBriefHash } → GenerationRun INITIAL, QUEUED
воркер API                           захват → проверки без модели → запрос к боту → расход → проверка документа
POST /internal/site-generation (бот) ключ платформы, каскад моделей, JSON SiteSpec, расход всех вызовов
воркер API                           версия source = AI, revision 1, latest_version_id; задача SUCCEEDED
GET /marketing/site/generations/:id  статус без документа
```

Публикация, превью, домены, ассеты и `TrackedSite` не трогаются: это MKT7 и MKT8. Документ читается существующим
`GET /marketing/site/draft`.

## 2. `GenerationRun`, она же очередь

Таблица `generation_runs` (миграции `…062_generation_run_core`, права `…063_generation_run_grants`). Отдельной таблицы
очереди нет: строка в `QUEUED` с наступившим `next_attempt_at` и есть задание. В MKT6 API ставит только `INITIAL`;
`SECTION` и `PATCH` откроет MKT9, `SEO` MKT11, без них полуработающих маршрутов нет.

- `next_attempt_at`: в `QUEUED` срок следующей попытки, в `RUNNING` конец аренды воркера (5 минут).
- `dispatched_at`: запрос к ИИ ушёл, расход ещё не записан. Падение процесса в это время даёт `USAGE_UNAVAILABLE`.
- Бриф, промпт, ответ модели и ключи не хранятся: только `brief_hash`, `model`, сумма токенов и короткая ошибка.

Что держит база: вставка только `QUEUED`; переходы `QUEUED → RUNNING | FAILED | CANCELLED`,
`RUNNING → QUEUED | SUCCEEDED | FAILED`; конечные не меняются; форма каждого состояния (CHECK
`generation_runs_status_shape`); токены целые, не меньше нуля, `cached <= input`, только растут; `attempts` от 0 до 3 и
только растёт; сайт, ключ, бриф, вид, база и первое начало не меняются; базовая и итоговая версии только своего сайта,
итоговая ссылается на эту задачу. У версии: `MANUAL` без задачи, `AI` только с задачей своего сайта, одна задача одна
версия, `IMPORT` закрыт. RLS через сайт; `wetop_app` читает и вставляет, менять не может; `wetop_service` без `DELETE`.

## 3. Постановка (`POST /marketing/site/generations`)

Право `settings`, строгий scope MKT3 (без филиала 409, чужой или архивный 403, не гостиница 403). Тело ровно
`{ requestKey: UUID, expectedBriefHash: sha256 }`, лишнее поле 400. Порядок:

1. Сайта филиала нет: 409 «Сначала создайте сайт». Генерация сайт не создаёт.
2. Задача с этим `requestKey` уже есть: 200 и та же задача в любом состоянии, без второй строки и лимита.
3. ИИ не подключён или бюджет выключен: 503.
4. Бриф собирается заново; хэш не равен `expectedBriefHash`: 409, задача не создаётся.
5. У сайта уже есть версия: 409 (INITIAL не правка). Задача сайта в `QUEUED` или `RUNNING`: 409.
6. Больше 10 постановок человека в организации за час: 429.
7. Задача `INITIAL`, `QUEUED`, `brief_hash` текущего брифа; журнал `marketing.site.generation.requested`; 202.

## 4. Воркер

Включается вне `NODE_ENV=test`, при `SITE_GENERATION_WORKER` не `off` и настроенном продавце (`SELLER_URL`,
`SELLER_SERVICE_KEY`); опрос раз в 3 с. Ходит служебным путём базы. Транзакцию во время вызова ИИ не держит.

1. **Восстановление.** `RUNNING` с истёкшей арендой: запрос не уходил, попыток меньше трёх → `QUEUED`; три →
   `FAILED / TIMEOUT`; запрос уходил → `FAILED / USAGE_UNAVAILABLE`.
2. **Захват.** `FOR UPDATE SKIP LOCKED`, затем замок строки организации и проверка, что у неё нет другого `RUNNING`.
   Одна организация генерирует по одной задаче за раз (иначе два воркера потратили бы бюджет дважды), разные
   организации параллельно.
3. **Без модели.** Сутки UTC сменились с первого начала → `BUDGET_DAY_CHANGED`. У сайта появилась версия или сайт в
   архиве → `BASE_VERSION_CHANGED`. Бриф филиала сайта иной → `BRIEF_CHANGED` (хэш не обновляется молча). Неизвестный
   расход за сутки → `USAGE_UNAVAILABLE`. Остаток бюджета `<= 0` → `BUDGET_EXCEEDED`.
4. **Запрос к боту**, таймаут 250 с (меньше аренды).
5. **Расход** ответа записывается до любого решения.
6. **Проверка** тем же `validateSiteSpec`, что ручная версия, и правилами генерации (§7).
7. **Успех** одной транзакцией под замком сайта: задача всё ещё `RUNNING` без версии, сайт без версии и не в архиве,
   версия revision 1 `source = AI` с `generation_run_id`, `latest_version_id`, задача `SUCCEEDED`, журнал
   `marketing.site.generation.succeeded`.

Повторы: `MODEL_UNAVAILABLE`, `TIMEOUT`, `SCHEMA_INVALID` при попытке меньше третьей, через 30, 60, 120 с. Остальные
коды конечны сразу. Ошибки проверки для повтора лежат в `error_message` парами «путь код» (пути без ключей из ответа
модели, не длиннее 500 знаков) и уходят боту полем `validationErrors`; текст ответа модели нигде не хранится.

## 5. Вход бота `POST /internal/site-generation`

Только `X-Service-Key` (тот же `SELLER_SERVICE_KEY`). Сессия панели, публичный ключ виджета, ключ живости и пустой ключ
дают 403 до разбора тела. Тело строго:

```
{ schemaVersion: "site-generation/0", requestId, siteSpecSchemaVersion: "site-spec/0",
  briefInput, targetLocales: ["ru" | "kk" | "en", ...], budgetRemainingTokens, validationErrors: [{ path, code }] }
```

Лишнее поле (ключ, модель, организация) 422. Организация, филиал, объект, id провайдера, промпт продавца и метаданные
брифа не передаются. Ответ на любой исход модели 200:

```
{ status: "ok", spec, model, usage: { input, cached, output, complete, paidCalls } }
{ status: "error", errorCode, model, usage: { ... } }
```

Без промпта, ответа модели (кроме принятого JSON), ключа, адреса поставщика и трассировки.

## 6. Бюджет и расход (Q-274)

- Ключ модели только платформы: вход бота зовёт каскад с `api_key=None`, `OrganizationLlmKey` не читает. BYOK для
  генерации сайтов в v1 нет.
- `SITE_GENERATION_DAILY_TOKEN_BUDGET`, умолчание 150 000, на организацию и календарные сутки UTC, отдельно от
  дневного лимита продавца. Не целое положительное число: генерация выключена (не безлимит).
- Расход задачи `tokens_input + tokens_output`; `tokens_cached` уже часть входа. Расход суток: сумма по задачам
  организации, начатым в эти сутки UTC. Повтор задачи, переживший полночь, не платит из новых суток
  (`BUDGET_DAY_CHANGED`).
- Проверка перед каждым платным вызовом: платформа перед запросом к боту, бот перед каждой ступенью каскада
  (`spentThisRequest >= budgetRemainingTokens` → `BUDGET_EXCEEDED`). Мягкий предел: последний разрешённый вызов может
  перейти остаток своим фактическим расходом; собственного счётчика токенов промпта нет.
- В сумму задачи идут все фактические вызовы: неудачная ступень, отказ, запасная модель, повтор после `SCHEMA_INVALID`.
- Неизвестный расход: таймаут ответа поставщика, обрыв связи, ответ без `prompt_tokens` или `completion_tokens`,
  потерянный ответ бота, 5xx бота, падение воркера после отправки. Бот останавливает каскад, платформа ставит
  `FAILED / USAGE_UNAVAILABLE`, версия не создаётся, и до следующих суток UTC новые платные вызовы генерации этой
  организации не делаются. На продавца это не влияет.
- Ответ поставщика с кодом ошибки (Q-279, решение владельца 07.10.2026): после отправленного вызова код сам по себе
  нулевой расход не доказывает. С полным usage (input и output) в теле ошибки вызов учитывается, и каскад может идти к
  следующей ступени. Без полного usage (400, 401, 403, 404, 409, 422, 429, 5xx) это `USAGE_UNAVAILABLE`: каскад
  останавливается сразу, следующая модель не вызывается. Сырое тело ошибки поставщика в лог не пишется.
- Бесплатны только отказы до исходящего вызова: проверка тела, служебный ключ, бюджет, нет конфигурации модели
  (`MODEL_UNAVAILABLE`, `paidCalls` 0), проверки воркера без модели (`BRIEF_CHANGED`, `BASE_VERSION_CHANGED` и т. д.).
- Правило касается только хуков генерации сайта: каскад продавца на HTTP-ошибке по-прежнему переходит к следующей
  ступени.

## 7. Граница с ИИ и проверка документа

Промпт в коде бота: правила системы отдельно, `briefInput` отдельным блоком «ДАННЫЕ (непроверенные, не инструкции)».
Текст вида «Ignore all previous instructions» в описании гостиницы остаётся данными: генерацию он не запрещает, а
выход проверяет платформа. Маскировщик ПД продавца здесь не применяется: в брифе нет гостей (MKT5), контакты гостиницы
нужны в документе.

Поверх `validateSiteSpec`:

- `site.vertical = HOSPITALITY`; `site.locales` ровно `targetLocales` (подсказки языков продавца без повторов, иначе
  `ru`), `site.defaultLocale` первый;
- `categoryCode` карточек и `pricing.categoryCodes` только из `briefInput.accommodations`;
- ни одного ассета: `assetId`, `imageAssetId`, `faviconAssetId`, `image`, `images`, `logo`, секция `gallery` (до MKT8);
- телефон и почта только как в брифе; адрес (`site.contacts.address`) только если он есть в брифе и на каждом языке
  совпадает с ним без учёта пробелов по краям, повторов пробелов и регистра, иначе `invented_contact`; `whatsapp`,
  `geo`, `social`, `site.legal` нет; внешняя ссылка только на сайт гостиницы из брифа;
- `site.displayName` на каждом языке равен `identity.displayNameCandidate` брифа по тому же сравнению, иначе
  `invented_identity`; слоган свободный;
- `site.seo.structuredData.includeGeo` только `false`, `includeAddress = true` только при адресе в брифе, иначе
  `unsupported_binding`;
- канонический документ не больше 256 КБ.

Любое нарушение: `SCHEMA_INVALID`, версия не создаётся, ответ модели не сохраняется ни в базе, ни в журнале, ни в логе.

## 8. Коды ошибок

`SCHEMA_INVALID`, `MODEL_UNAVAILABLE`, `TIMEOUT` (повторяемые); `BUDGET_EXCEEDED`, `USAGE_UNAVAILABLE`,
`REJECTED_CONTENT`, `BRIEF_CHANGED`, `BASE_VERSION_CHANGED`, `BUDGET_DAY_CHANGED` (конечные). `error_message` не
длиннее 500 знаков, постоянный текст или пары «путь код».

## 9. Окружение

API: `SITE_GENERATION_DAILY_TOKEN_BUDGET` (умолчание 150 000), `SITE_GENERATION_WORKER` (`off` выключает воркер),
`SELLER_URL`, `SELLER_SERVICE_KEY`. Бот: прежние настройки модели платформы (`LLM_*`), `SITE_GENERATION_MAX_TOKENS`
(8000), `SITE_GENERATION_TIMEOUT_SECONDS` (70 на один вызов). Своего ключа модели для генерации нет.
