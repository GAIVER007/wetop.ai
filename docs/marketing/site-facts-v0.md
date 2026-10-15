# «Что WETOP знает о филиале» и заготовка сайта (SITE-2)

Статус: **в коде с 15.10.2026, ветка `wt/site-domain`**. План `plans/site-seo-flow-2026-10-15.md` §1 шаги 1, 3, 4.
Контракт: `packages/domain/src/marketing/site-facts.ts` (экспорт `@pms/domain`); сборщик: `apps/api/src/marketing-site/site-facts.service.ts`;
заготовка: `packages/domain/src/marketing/starter.ts`.

## 1. `GET /marketing/site/locations`

Филиалы организации, где у человека есть право `settings` в этом месте (с областью доступа роль места, DATA_MODEL
§31.1). Вызывается до выбора филиала (`@ScopeAware`). Порядок: дата создания филиала, затем id.

```ts
{ items: Array<{ id: string; name: string; vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
                 siteStatus: 'NONE' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }> }
```

`siteStatus` из `marketing_sites.state` филиала: нет строки `NONE`; `PAUSED` показывается как `DRAFT` (сайт не открыт).

## 2. `GET /marketing/site/facts?locationId=<uuid>`

Для всех трёх направлений, без ИИ и без Channex. Неверный id 400; чужой, архивный или несуществующий филиал 404 (не
отличаются); нет права `settings` в этом месте 403.

```ts
interface SiteFacts {
  vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  location: { id: string; name: string; address: string | null; phone: string | null; whatsapp: string | null; city: string | null };
  catalog: { kind: 'rooms' | 'services' | 'menu';
             items: Array<{ code: string; name: string; price?: Money; priceFrom?: Money; durationMin?: number; category?: string;
                            capacityAdults?: number; weightGrams?: number; hasPhoto?: boolean }> };
  staff: Array<{ id: string; name: string; specialization: string | null }>;
  hours: { days: Array<{ weekday: number; open: string; close: string }>; checkInTime: string | null; checkOutTime: string | null };
  photosCount: number;
  reviews: { avg: number; count: number } | null;
  gaps: Array<{ key: 'address' | 'phone' | 'whatsapp' | 'catalog' | 'staff' | 'hours' | 'photos'; label: string; href: string }>;
}
type Money = { minor: string; currency: string }; // целые минимальные единицы строкой
```

| Поле | Гостиница | Салон | Ресторан |
|---|---|---|---|
| `location.address` | филиал, иначе объект | филиал | филиал |
| `location.city` | объект | `null` (поля нет) | `null` |
| `location.whatsapp` | `null`: поля WhatsApp у филиала в данных нет, всегда подсказка в `gaps` | то же | то же |
| `catalog` | `rooms`: активные категории, `code` = код категории, `capacityAdults`; цены нет (живая `B-FROMPRICE`) | `services`: услуги, которые продаются в филиале (`effectiveService`: включена, своя цена филиала или цена каталога в валюте филиала), `code` = id услуги, `price`, `durationMin` филиала, `category` | `menu`: блюда «в меню» в порядке ресторана (раздел, затем блюдо по `sort_order`, имени), `code` = id блюда, `price`, `category` = раздел, `weightGrams`, `hasPhoto` |
| `staff` | пусто | действующие мастера филиала; `specialization` = названия их услуг, продаваемых в филиале | пусто |
| `hours.days` | пусто; `checkInTime/checkOutTime` объекта | по дню самое раннее начало и самый поздний конец смен мастеров филиала | по дню сервис-периоды филиала; период до утра закрывает день «после полуночи» |
| `photosCount` | готовые фото библиотеки сайта филиала | то же | плюс фото блюд |
| `reviews` | `null` (источника оценок нет) | `null` | средняя оценка заказов филиала (`restaurant_order_ratings`), до десятых |

`gaps`: адрес, телефон, WhatsApp, пустой каталог, мастера (только салон), часы (гостиница: заезд и выезд), меньше 3 фото.
`href` ведёт на страницу стойки направления (`SITE_FACTS_HREF`).

## 3. Заготовка сайта: `starterSpecFromFacts(facts, design?, { locale? }) → SiteSpec`

Чистая функция `@pms/domain`, без ИИ, сети и времени; результат проходит `validateSiteSpec`. Главная «сайт для заявок»:

| Направление | Секции главной по порядку |
|---|---|
| гостиница | `hero`, `features`*, `accommodations`, `pricing`, `booking`, `contacts`*, `cta` |
| салон | `hero`, `features`*, `services`*, `staff`*, `leadForm` (`BEAUTY_APPOINTMENT`; без услуг `CALLBACK`), `hours`*, `contacts`*, `cta` |
| ресторан | `hero`, `features`*, `menu`*, `leadForm` (`TABLE_RESERVATION`), `hours`*, `contacts`*, `cta` |

\* только если есть данные. «Почему мы» (`features`) только из чисел данных: оценка, число мастеров, услуг, блюд, рабочих
дней; меньше двух фактов: секции нет. Тексты нейтральные подписи, имена и цены как в данных. Телефон в документ
только если однозначно приводится к E.164. `navigation.mobileBar = { book: true, whatsapp: <есть номер> }`.

`STARTER_DESIGNS`: три направления оформления «Светлый минимал», «Глубокий премиум», «Яркий тёплый» (`DesignDirection`,
только словари темы); `design` применяется `applyDesignDirection`, содержимое страниц не меняется.

`siteFactsFromBrief(input)`: те же факты из брифа генерации.

## 4. Мгновенное превью в стойке

Рендер одной страницы SiteSpec в HTML-строку: `renderDraftPreview({ spec, pageId, locale, assets, editorPaths? })` из
`apps/sites/src/draft-preview.ts` → `{ ok: true, html, pageId } | { ok: false }`. Стойка уже импортирует его напрямую
(`apps/web/src/app/marketing/site/editor/preview.tsx`, ленивый `import('../../../../../../sites/src/draft-preview')`;
пакетного экспорта `@pms/sites` нет). HTML самодостаточный (стили внутри), без скриптов WETOP, `noindex`, форма
заявки выключена; для `<iframe srcDoc sandbox="allow-same-origin">`. Три карточки дизайна:

```ts
const facts = await api('/marketing/site/facts?locationId=…');
const previews = STARTER_DESIGNS.map((d) => renderDraftPreview({ spec: starterSpecFromFacts(facts, d), pageId: null, locale: 'ru', assets: {} }));
```

## 5. Бриф генерации

`SiteBriefInput` получил необязательные `vertical`, `services`, `staff`, `menu`, `hours` (только салон и ресторан;
у гостиницы полей нет, хэш брифа гостиницы прежний) и `capabilities: { booking, fromPrice }` (у салона и ресторана
`false`). Сборщик тот же, что у `facts`. Порядок детерминирован (услуги по группе, имени, коду; мастера по имени, id;
меню в порядке ресторана; часы по дню), пределы 60 услуг, 30 мастеров, 30 разделов и 300 блюд с записью в `truncations`.
Предлагаемая структура (`proposedStructure`) повторяет §3.
