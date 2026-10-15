**15.10.2026, ветка `wt/site-domain`, SITE-2: блоки сайта для салона и ресторана без миграций.**

Что сделано (план `plans/site-seo-flow-2026-10-15.md`, срез SITE-2):
- SiteSpec (`site-spec/0`, обратно совместимо): направления `BEAUTY`, `FOOD_SERVICE`; секции `services`, `staff`, `menu`,
  `hours`, `leadForm` (режимы `HOTEL_BOOKING`, `BEAUTY_APPOINTMENT`, `TABLE_RESERVATION`, `CALLBACK`);
  `navigation.mobileBar`; цены `Money` целыми minor units строкой; тип schema.org и секции по направлению.
  Документ: `docs/marketing/sitespec-v1-verticals.md`.
- Контракт тела заявок `/w/beauty/book`, `/w/food/reserve`, `/w/lead` и строгий разбор: `site-lead.ts`,
  `docs/marketing/site-leads-v0.md` (приём на API за SITE-4/SITE-5).
- Рантайм `apps/sites`: рендер новых секций, форма заявки своим файлом `/_wetop/lead-<хэш>.js` (CSP без
  `unsafe-inline`), закреплённая кнопка и WhatsApp, JSON-LD `BeautySalon`/`Restaurant` + `hasMenu`,
  `OpeningHoursSpecification`.
- API: `GET /marketing/site/facts?locationId=` (все направления, право `settings` в месте) и
  `GET /marketing/site/locations`; бриф салона и ресторана из реальных таблиц тем же сборщиком; воркер ставит цены и
  часы из брифа поверх ответа модели; промпт ИИ-продавца с правилами салона и ресторана.
  Контракт: `site-facts.ts`, `docs/marketing/site-facts-v0.md`.
- `starterSpecFromFacts(facts, design?)` и `STARTER_DESIGNS` для мгновенного превью трёх дизайнов.

Не включено (ждёт миграций SITE-3, делает другой агент): доступ салона и ресторана к конструктору
(`scope.ts` HOSPITALITY, `editor/page.tsx`), публикация (`tracked_sites.property_id`, триггер лицензии), рантайм
`sites-runtime.repository.ts` пока выбирает только гостиничные сайты.

Доказательства: юнит-тесты домена, рантайма и API (`site-spec-v1.test.ts`, `starter.test.ts`, `site-lead.test.ts`,
`sections-vertical.test.ts`, `site-facts.service.test.ts`), интеграционный `tests/integration/site-facts.test.ts` на
локальной базе, прогоны в отчёте сессии.
