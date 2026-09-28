# Platform P1 — Business + Location foundation (ADR-104, Q-199 вариант Б), 27.09.2026

Решение владельца 27.09.2026 (вечер): «Q-199 → выбираем ADR-104 / архитектуру v3… Business + Location
создаём вместе одной additive-фазой», имя фазы — Platform P1 (нумерация Phase 2/2.5 отменена; Phase 1
tenant isolation остаётся security-фазой). Основание: `ARCHITECTURE.md` (v3), `DATA_MODEL.md` §18 (v2.0
линии ADR-104) + журнал v2.3, план `plans/phase-business-location-2026-09-27.md` (подтверждён этим решением).
Временная миграция `20260927000029_phase2_location` линии ADR-100 (`Location.organization_id`/`vertical`)
**удалена из ветки до применения куда-либо** — на production и в `main` её никогда не было.

## 1. Что сделано

- **Схема** (`schema.prisma`): enum'ы `BusinessVertical` (canonical vertical ТОЛЬКО здесь), `BusinessStatus`,
  `LocationStatus`; модель `Business` (§18.1: organization_id NOT NULL, name varchar(200), vertical, status,
  created/updated); модель `Location` (§18.2: **business_id NOT NULL**, БЕЗ organization_id (§18.3) и БЕЗ
  vertical, name/address/phone/email, timezone varchar(50), currency varchar(3), status, created/updated);
  `Property.location_id` — nullable UNIQUE FK (1:1, миграционное окно; §18.4);
  `Organization.reporting_currency` varchar(3) NOT NULL DEFAULT 'KZT' (§18.4).
  Hospitality-таблицы (Reservation/ReservationItem/Allocation/InventoryUnit/AccommodationType/RatePlan/
  DailyRate/ChannelMapping/Folio/Payment) **не тронуты**, ни один существующий ID не меняется.
- **Миграция `20260927000030_platform_p1_business_location`** (+ `down.sql`), backfill в той же транзакции:
  - организация с объектами → **один** `Business` (vertical `HOSPITALITY`, имя организации, ACTIVE);
  - по одной `Location` на каждый её объект — поля из `Property` (имя, адрес, контакты, пояс, валюта);
    связка `properties.location_id` через CTE с заранее вычисленными id (по имени не сопоставляем);
  - `reporting_currency` — из фактической валюты объектов организации, только где она **однозначна**
    (ровно одна различная); неоднозначное и организации без объектов остаются на DEFAULT 'KZT' —
    ложные валютные данные молча не создаются, остаток виден отчётом.
  - Для Luxx: Organization «Luxx Aparts» → Business «Luxx Aparts» (HOSPITALITY) → Location (имя объекта) →
    существующий Property; reporting_currency = KZT (фактическая).
- **RLS — сразу под финальную цепочку** (приём миграции …028): `businesses` — политика по `organization_id`;
  `locations` — через родителя-Business; обе в `RLS_TENANT_TABLES`. Проверяется **под ролью `wetop_app`**:
  обход всех арендаторских таблиц в `rls-isolation.test.ts` (чужой видит 0, своя видит свой Business и его
  филиал через цепочку — сид теста расширен).
- **Код**: `location-ref.ts` переписан под финальную связь (`LocationRef{id, businessId, vertical(с Business),
  name, timezone, currency}`, выборка `location.business.organizationId`, кэш и «отказ не запоминается» — как
  прежде); `organizationPropertyRef()` идёт по цепочке Organization → Business → Location → Property с
  фолбэком на `properties.organization_id`, пока миграция не применена; внешний контракт `PropertyRef` не
  менялся — репозитории не тронуты. Локальный сид (`seed-local.ts`) строит цепочку сам (сид идёт после
  миграций — иначе свежая тестовая база оставалась бы без неё).

## 2. Доказательства (журнал tests/runs/JOURNAL.md, логи в коммите)

| Проверка | Красный | Зелёный |
|---|---|---|
| integration: цепочка/backfill/резолвер (`platform-p1-backfill.test.ts`, 3 теста) + RLS под wetop_app | база без 030: 28/112 красных, `…15-58-48Z-integration-8c02.log` | ✅ **112/112** `…15-59-25Z…`, `…16-02-53Z…` и на полностью свежем сиде `…16-06-05Z-integration-af29.log` |
| unit (location-ref под финальную связь, property-ref цепочка) | — (красный фазы снят интеграционным) | ✅ 2115/2118 `…16-00-11Z-unit-2602.log` |
| typecheck / lint | — | ✅ `…15-57-33Z-typecheck-35ac.log` (и после правки сида), `…15-58-00Z-lint-599e.log` |
| e2e — полный Hospitality suite на стенде с миграцией 030 | — | ✅ **25/25** `…16-01-29Z-e2e-4627.log` |
| `check-migrations.sh` (чистый PG16): цепочка …026→…027→…028→**…030**, prisma diff-паритет, откаты снимок-в-снимок | — | **RESULT: OK** |

Прозрачность для Luxx: поведение стойки не менялось (полный suite и e2e зелёные без правок продуктового кода);
фолбэк резолвера сохраняет прежний путь до применения миграции.

## 2а. Утверждение владельцем (27.09.2026, поздний вечер) — три условия приёмки

«Platform P1 утверждаю. Можно готовить production rollout по плану 027 + 028 + 030», с условиями:

1. **`reporting_currency` — UNRESOLVED.** Если валюту существующей Organization нельзя определить
   однозначно, строка в отчёте — `UNRESOLVED`; DEFAULT не считается фактически подтверждённой валютой.
   Сделано: `scripts/ops/platform-p1-report.sql` показывает `confirmed_iz_valyuty_obektov / UNRESOLVED`
   и перечисляет UNRESOLVED-организации с причиной; уточнение внесено в DATA_MODEL §18.4.
   Для Luxx ожидаемо: confirmed KZT.
2. **Фолбэк в резолвере — только миграционное окно.** После production backfill и `broken_chain = 0`
   фолбэк по `properties.organization_id` снимается в следующей platform-фазе — окончательный переход
   на `Organization → Business → Location → Property`. Зафиксировано в коде (`property-ref.ts`,
   `location-ref.ts`) и в §5; новых зависимостей от фолбэка не заводить.
3. **RLS gate.** Таблицы/политики применять можно сейчас, но публичную регистрацию и первого внешнего
   Partner на общей базе НЕ открывать, пока: роли `wetop_app`/`wetop_service` реально созданы на
   production; API использует `DATABASE_APP_URL`; smoke/integration isolation под `wetop_app` зелёный;
   сделан замер производительности после включения (порядок — `docs/ops/rls.md`, допуск RLS-3 ≤ 20 %).

## 3. Инструкция владельцу — применение на рабочей базе (сам НЕ применяю)

Формула владельца: `backup → migrate 027/028/030 → deploy → platform-p1-report → inventory 88/88 →
day self-check 0 → RLS smoke`. Ни один Hospitality ID/FK не меняется.

```
0) Mac, папка WETOP, ветка PR #98 (или main после влития): git pull; npm ci --no-audit --no-fund
1) BACKUP: штатный бэкап Supabase (Dashboard → Database → Backups), убедиться в свежем.
2) MIGRATE 027/028/030: npm run migrate:deploy -w packages/database
   Ожидаемо: применяются 20260927000027_tenant_columns, 20260927000028_rls_policies (ADR-103)
   и 20260927000030_platform_p1_business_location. Миграции 029 в списке быть НЕ должно.
3) DEPLOY кода — обычным порядком (npm run build -w apps/web; kickstart api/web — docs/deploy.md §1).
4) PLATFORM-P1-REPORT: scripts/ops/platform-p1-report.sql (SQL Editor — вставить целиком, один запрос).
   Ожидание: businesses 1/1/1; locations 1/1; properties 1/1/0; broken_chain 0;
   reporting_currency — Luxx confirmed KZT; строки UNRESOLVED допустимы ТОЛЬКО у организаций без
   объектов (перечисляются с причиной; неоднозначных валют быть не должно). Результат прислать сюда.
   Итог для Luxx: 1 Organization → 1 Business(HOSPITALITY) → 1 Location → существующий Property.
5) INVENTORY: npx tsx scripts/reconciliation/src/cli-inventory.ts            — фонд 88/88, расхождение 0
6) DAY SELF-CHECK: APP_API_URL=http://127.0.0.1:3001 npm run reconcile:selfcheck — сутки в ноль
   (плюс стойка глазами: /today, /guests, /journal, /channels — как до миграции)
7) RLS SMOKE (в объёме уже применённого; полный ввод RLS в строй — этапами docs/ops/rls.md):
   политики пассивны до входа wetop_app, поэтому smoke здесь = проверка, что применение их не включило
   для текущих подключений: стойка работает (шаги 4–6 зелёные), и под ролью из DATABASE_URL
   SELECT count(*) FROM businesses / locations отдаёт строки (роль вне wetop_app политиками не режется).
   Когда владелец решит включать RLS по-настоящему (роль LOGIN + DATABASE_APP_URL, docs/ops/rls.md
   этап 1–2) — smoke этапа: e2e со входом на wetop_app (26/26, как в журнале …14-15-22Z) и замер
   производительности; до этого публичную регистрацию и внешнего Partner не открывать (§2а условие 3).
8) ROLLBACK: откатить код; при необходимости снять схему —
   psql -f packages/database/prisma/migrations/20260927000030_platform_p1_business_location/down.sql
   и DELETE FROM _prisma_migrations WHERE migration_name='20260927000030_platform_p1_business_location';
   крайний случай — restore из бэкапа шага 1.
```

После зелёных шагов 4–7 **Platform P1 закрывается**.

## 4. Риски

- Низкий: чисто additive; деньги/брони/фонд миграция не читает и не пишет (кроме чтения валют объектов
  для reporting_currency); старый код с новыми таблицами совместим.
- До применения миграции резолвер делает один дополнительный пустой рейс на организацию на процесс
  (путь по цепочке перед фолбэком); после применения рейс снова один.
- RLS-политики новых таблиц активны только для роли `wetop_app` (вход у неё на проде выключен до этапа
  `DATABASE_APP_URL` — docs/ops/rls.md); текущие подключения не задеты.
- `Property.location_id` NOT NULL — отдельной миграцией после проверки на проде (§18.4), не в этой фазе.

## 5. После закрытия P1 — зафиксированные следующие шаги (порядок владельца, 27.09.2026)

- **Снятие фолбэка резолвера** (условие 2 приёмки): после production backfill и `broken_chain = 0` —
  отдельной задачей следующей platform-фазы убрать путь по `properties.organization_id` из
  `organizationPropertyRef()` и «прежний путь» из семантики `location-ref` — окончательный переход на
  `Organization → Business → Location → Property`. Вместе с ним — NOT NULL на `properties.location_id`
  отдельной миграцией (§18.4).
- **Platform P2 — RequestActor / scope** — следующий этап, только по отдельной команде владельца.
- **Switcher / onboarding / Partners UI — НЕ начинать до закрытия P2** (прямое указание владельца).
- RLS-gate (§2а условие 3) держится до полного ввода RLS в строй по `docs/ops/rls.md`.

## 6. Production rollout и закрытие — Platform P1 ЗАКРЫТА (28.09.2026)

Владелец выполнил rollout по утверждённой формуле: `backup → migrate 026_rls_roles/027/028/030 → deploy`
(27.09, `npm run migrate:deploy` — «All migrations have been successfully applied»; миграции `…029` в списке
не было), затем 28.09 снял post-deploy проверки:

| Проверка | Ожидание | Факт |
|---|---|---|
| Службы (`status.sh`, curl) | api/web running, 200/200 | api running, web running; 3001 → 200, 3000 → 200 |
| `platform-p1-report.sql`: businesses | 1 / 1 / 1 | **1 / 1 / 1** |
| locations | 1 / 1 | **1 / 1** |
| properties (total / linked / without_location) | 1 / 1 / 0 | **1 / 1 / 0** |
| broken_chain | 0 | **0** |
| reporting_currency (orgs / confirmed / UNRESOLVED) | Luxx confirmed KZT; UNRESOLVED только у организаций без объектов | **2 / 1 / 1** — Luxx подтверждена по валюте объекта (KZT); одна организация без объектов — `UNRESOLVED` («нет объектов, DEFAULT KZT не подтверждён»), по условию 1 допустимо |
| RLS smoke: роли | wetop_app / wetop_service без входа | `wetop_app` bypassrls=f login=f; `wetop_service` bypassrls=t login=f |
| RLS smoke: политики `rls_tenant` | 43 | **43** (41 ADR-103 + 2 Platform P1) |
| RLS smoke: видимость текущей роли | 1 / 1 | businesses 1, locations 1 — текущее подключение политиками не режется |
| Фонд `cli-inventory` | 88/88, расхождение 0 | **RESULT: OK — расхождение 0 по всем строкам** (88/88, 16/16, 72/72, 92/92) |
| Сутки `cli-day-selfcheck` | в ноль | **RESULT: OK — сутки внутри PMS сходятся** |

Итог для Luxx: **1 Organization → 1 Business (HOSPITALITY) → 1 Location → существующий Property**;
ни один Hospitality ID/FK не изменён. Все условия закрытия выполнены — **Platform P1 закрыта 28.09.2026.**

Остаётся в силе:
- **RLS-gate** (§2а условие 3): публичная регистрация и первый внешний Partner на общей базе — только после
  включения входа `wetop_app` и `DATABASE_APP_URL` в API, зелёного isolation-smoke под `wetop_app` и замера
  производительности (`docs/ops/rls.md`).
- **Снятие фолбэка резолвера** (§2а условие 2): `broken_chain = 0` на рабочей базе зафиксирован — снятие пути по
  `properties.organization_id` идёт отдельным маленьким PR по команде владельца.
- **Platform P2 (RequestActor/scope)** — не начинается без отдельной команды; Switcher/onboarding/Partners UI —
  не раньше закрытия P2.
