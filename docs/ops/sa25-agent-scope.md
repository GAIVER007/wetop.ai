# SA2.5, рантайм по агенту: выкладка, предпроверка, смоуки Luxx

План, `plans/business-ai-seller-sa25-2026-09-30.md` (§10, решения владельца), модель, `DATA_MODEL.md` §20.11.
Порядок, **расширить → переключить → проверить → сузить**; сужение, отдельный релиз (§4).
Миграции на рабочих базах применяет владелец (`CLAUDE.md` §3). Значения ключей и секретов ниже нигде не выводятся.

## 0. До всего

1. Копии обеих баз (PMS и бота).
2. Всё, что ниже, сначала: **на копии**, потом на рабочей базе.

## 1. Расширить (шаг A и B)

### 1.1. PMS: миграция `20260930000036_seller_agent_scope_expand`

Миграция сама вызывает `seller_scope_assert()` **до** любых изменений: любая неоднозначность цепочки
`seller_profile → Organization → legacy Seller Agent → Business → Location`, отказ без изменений. Филиал по `created_at`,
названию или догадке не выбирается.

Проверить до применения нельзя (функции создаёт сама миграция), поэтому порядок такой: применить на **копии** →
если отказ, в тексте ошибки, перечень красных проверок; если прошла, выполнить на копии и **на рабочей базе после
применения**:

```sql
SELECT * FROM seller_scope_precheck();   -- все bad = 0
```

| Проверка | Что значит красная |
|---|---|
| `profiles_without_organization` | профиль без организации |
| `profiles_without_agent` | профиль, для организации которого нет агента с `id = organization_id` |
| `profiles_wrong_agent` | `seller_profiles.agent_id` указывает не на агента с `id = organization_id` |
| `legacy_agents_without_location` | рабочий агент без филиала у организации без единого действующего объекта |
| `orgs_with_many_locations` | у организации с профилем или расширением больше одного возможного филиала |
| `legacy_agents_wrong_location` | филиал агента не входит в объекты организации |
| `duplicate_sales_agents_per_location` | два неархивных AI-продавца на одном филиале |
| `orgs_without_actor` | у организации с продавцом нет ни одного участника (некому быть автором агента) |

**Любая красная, STOP.** Разбирает владелец вручную; миграцию не «подгоняют». Для Luxx ожидается: один филиал, все нули.

Откат: `down.sql` (вернёт прежние тела функций 035; данные, филиалы агентов, `agent_id` профилей, остаются, они однозначны).

### 1.2. Бот: миграция `0009_agent_scope_expand`

Применяется при старте образа бота. Ничего не сужает: прежние уникальности по организации и первичный ключ подключения WhatsApp
на месте. Откат, `alembic downgrade 0008` (снимает только добавленные индексы, данные остаются).

## 2. Переключить (шаг C)

Порядок: код API и стойки → образ бота (`apps/ai-seller/vykatka.md`). Новый API с прежним ботом и прежний API с новым ботом
работают: прежний бот игнорирует `X-Agent`, новый без `X-Agent` берёт единственного агента организации.

Новые настройки бота **не нужны**: домены виджета бот спрашивает у платформы по уже заданным `INTEGRATION_BASE_URL` и
`INTEGRATION_API_KEY` (узкий ключ котировки; платформа разрешила ему ещё и `GET /bot/agent-origins`).

## 3. Проверить: Luxx до и после (только чтение)

Снимок до выкладки кода и после; строки должны совпасть.

**PMS**

```sql
SELECT a.id, a.organization_id = a.id AS agent_is_org, a.lifecycle, a.location_id IS NOT NULL AS has_location
FROM seller_agents a WHERE a.id = '<id организации Luxx>';
SELECT sp.agent_id, sp.facts_hash,
       md5(concat_ws('|', sp.bot_name, sp.address_form, sp.emoji, sp.reply_length, sp.greeting, sp.included_in_price,
                      sp.extra_charges, sp.house_rules, sp.prompt_text, sp.faq::text)) AS profile_hash
FROM seller_profiles sp WHERE sp.organization_id = '<id организации Luxx>';
```

**Бот**

```sql
SELECT (SELECT count(*) FROM clients WHERE agent_id = :id) AS clients,
       (SELECT count(*) FROM conversations WHERE agent_id = :id) AS conversations,
       (SELECT count(*) FROM documents WHERE agent_id = :id) AS documents,
       (SELECT phone_number_id FROM whatsapp_connections WHERE agent_id = :id) AS phone_number_id,
       (SELECT md5(system_prompt) FROM agents WHERE id = :id) AS prompt_hash,
       (SELECT count(*) FROM clients WHERE organization_id IS NOT NULL AND agent_id IS NULL) AS clients_without_agent;
```

Из раздела «ИИ-агенты» → «Данные объекта» (или `GET /ai-seller/facts`): `hash` фактов до и после равен.
Из «Код для сайта» (`GET /ai-seller/embed`): `data-key` в теге и список доменов до и после равны.
Из «WhatsApp» (`GET /ai-seller/whatsapp`): `webhookUrl` и `phoneNumberId` до и после равны.

**Смоук виджета** (на боевом сайте Luxx): открыть чат, отправить сообщение, получить ответ; в панели диалог виден.
**Смоук WhatsApp**: в консоли Meta «Проверить и сохранить» на прежнем адресе вебхука (`hub.challenge` вернётся), входящее
сообщение → ответ гостю; реплика оператора из панели доходит до гостя (BUG-WA-1).

**Ожидаемая разница после SA2.5:** одноразовый повтор одного и того же сообщения в окне дедупа (минуты) при выкладке, ключ
дедупа теперь с агентом, а не с организацией.

## 4. Сузить (шаг E: отдельный релиз, отдельный PR)

Только после зелёных смоуков §3 на выложенном коде. PMS `039` и бот `0010` лежат в ветке сужения
(`claude/sa25-contract`), в образ шага C не входят. Предпроверка: на рабочей базе нет профилей без `agent_id`
(`SELECT count(*) FROM seller_profiles WHERE agent_id IS NULL` = 0) и строк бота с организацией без агента.

## 5. Откат

- код: прежние образы (`pms-lux:rollback-<sha>`, образ бота);
- PMS `039`: `down.sql`; бот `0009`: `alembic downgrade 0008`;
- историю переписки при откате не удаляют.
