/**
 * «Что WETOP знает о филиале» для конструктора сайта (SITE-2, план `plans/site-seo-flow-2026-10-15.md` §1 шаг 1).
 * Контракт ответа `GET /marketing/site/facts?locationId=…` для всех трёх направлений: только данные системы, без ИИ,
 * без текстов модели, без данных гостей и денег за период. Из него стойка рисует карточку филиала и подсказки «Дополнить»,
 * а `starterSpecFromFacts` (`starter.ts`) строит мгновенное превью трёх дизайнов.
 *
 * Деньги целыми minor units строкой (ADR-008): `{ minor: '250000', currency: 'KZT' }` это 2 500,00 ₸. Время `ЧЧ:ММ`
 * по часам филиала, день недели 0 воскресенье (как `Date.getDay()` и `working_hours.weekday`).
 */
export type SiteFactsVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';

export interface SiteFactsMoney {
  /** Целое число минимальных единиц валюты строкой */
  minor: string;
  /** ISO 4217 */
  currency: string;
}

export interface SiteFactsLocation {
  id: string;
  name: string;
  address: string | null;
  /** Телефон филиала как записан в WETOP (не обязательно E.164) */
  phone: string | null;
  /** Номер WhatsApp филиала: в данных WETOP его поля пока нет, всегда `null` и подсказка в `gaps` */
  whatsapp: string | null;
  /** Город: у гостиницы из объекта; у салона и ресторана поля нет, `null` */
  city: string | null;
}

export interface SiteFactsCatalogItem {
  /** Код записи WETOP: код категории номеров, id услуги, id блюда; на него ссылается секция сайта */
  code: string;
  name: string;
  /** Точная цена из данных (услуга салона, блюдо) */
  price?: SiteFactsMoney;
  /** Цена «от» (нижняя граница); в SITE-2 сборщик её не ставит: цена номера живая (`B-FROMPRICE`) */
  priceFrom?: SiteFactsMoney;
  durationMin?: number;
  /** Группа услуги или раздел меню */
  category?: string;
  /** Номер: вместимость взрослых; блюдо: выход в граммах; есть ли фото у блюда */
  capacityAdults?: number;
  weightGrams?: number;
  hasPhoto?: boolean;
}

export interface SiteFactsCatalog {
  kind: 'rooms' | 'services' | 'menu';
  items: SiteFactsCatalogItem[];
}

export interface SiteFactsStaff {
  id: string;
  name: string;
  /** Названия услуг мастера в этом филиале через запятую; своего поля «специализация» у мастера нет */
  specialization: string | null;
}

export interface SiteFactsHoursDay {
  weekday: number;
  open: string;
  /** Может быть меньше `open`: работа после полуночи */
  close: string;
}

export interface SiteFactsHours {
  /** Салон: самое раннее начало и самый поздний конец смен мастеров филиала; ресторан: сервис-периоды; гостиница: пусто */
  days: SiteFactsHoursDay[];
  /** Только гостиница: заезд и выезд объекта */
  checkInTime: string | null;
  checkOutTime: string | null;
}

export interface SiteFactsReviews {
  /** Средняя оценка 1–5 с одним знаком после запятой */
  avg: number;
  count: number;
}

export type SiteFactsGapKey =
  | 'address'
  | 'phone'
  | 'whatsapp'
  | 'catalog'
  | 'staff'
  | 'hours'
  | 'photos';

export interface SiteFactsGap {
  key: SiteFactsGapKey;
  /** Что сделать, словами для человека */
  label: string;
  /** Где в стойке это дополнить */
  href: string;
}

export interface SiteFacts {
  vertical: SiteFactsVertical;
  location: SiteFactsLocation;
  catalog: SiteFactsCatalog;
  staff: SiteFactsStaff[];
  hours: SiteFactsHours;
  /** Готовые фото библиотеки сайта филиала (`site_assets` READY) и фото блюд ресторана */
  photosCount: number;
  /** Оценки: у ресторана оценки заказов; у гостиницы и салона источника оценок нет, `null` */
  reviews: SiteFactsReviews | null;
  gaps: SiteFactsGap[];
}

/** Ответ `GET /marketing/site/locations`: филиалы организации, где человек может вести сайт */
export type SiteFactsSiteStatus = 'NONE' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface SiteLocationListItem {
  id: string;
  name: string;
  vertical: SiteFactsVertical;
  siteStatus: SiteFactsSiteStatus;
}

/** Состояние `marketing_sites.state` в статус списка: пауза это не опубликованный сайт, показывается черновиком */
export function siteStatusOf(state: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED' | null | undefined): SiteFactsSiteStatus {
  if (!state) return 'NONE';
  if (state === 'PUBLISHED' || state === 'ARCHIVED') return state;
  return 'DRAFT';
}

/** Снимок, который читает API; функция ниже собирает из него ответ детерминированно */
export interface SiteFactsSnapshot {
  vertical: SiteFactsVertical;
  location: SiteFactsLocation;
  catalog: SiteFactsCatalog;
  staff: SiteFactsStaff[];
  hours: SiteFactsHours;
  photosCount: number;
  reviews: SiteFactsReviews | null;
}

/** Куда вести человека, чтобы дополнить данные: страницы стойки по направлению */
export const SITE_FACTS_HREF: Readonly<Record<SiteFactsVertical, Readonly<Record<SiteFactsGapKey, string>>>> = Object.freeze({
  HOSPITALITY: {
    address: '/branches',
    phone: '/branches',
    whatsapp: '/branches',
    catalog: '/rooms/categories',
    staff: '/branches',
    hours: '/hotel-settings/stay',
    photos: '/marketing/site/assets',
  },
  BEAUTY: {
    address: '/branches',
    phone: '/branches',
    whatsapp: '/branches',
    catalog: '/beauty/services',
    staff: '/beauty/masters',
    hours: '/beauty/schedule',
    photos: '/marketing/site/assets',
  },
  FOOD_SERVICE: {
    address: '/branches',
    phone: '/branches',
    whatsapp: '/branches',
    catalog: '/menu',
    staff: '/branches',
    hours: '/restaurant-settings',
    photos: '/marketing/site/assets',
  },
});

const GAP_LABEL: Readonly<Record<SiteFactsVertical, Readonly<Partial<Record<SiteFactsGapKey, string>>>>> = {
  HOSPITALITY: {
    catalog: 'Нет категорий номеров: добавьте их, чтобы показать номера на сайте',
    hours: 'Не указано время заезда и выезда',
  },
  BEAUTY: {
    catalog: 'Нет услуг в этом филиале: включите услуги и цены',
    staff: 'Нет мастеров в этом филиале: добавьте мастеров',
    hours: 'Нет графика мастеров: без него на сайте не будет часов работы',
  },
  FOOD_SERVICE: {
    catalog: 'Меню пустое: добавьте блюда с ценами',
    hours: 'Нет сервис-периодов: без них на сайте не будет часов работы',
  },
};

/** Минимум фото, чтобы сайт выглядел живым: галерея SiteSpec требует от трёх */
export const SITE_FACTS_MIN_PHOTOS = 3;

/** Подсказки «Дополнить»: только то, чего действительно нет в данных; порядок фиксированный */
export function siteFactsGaps(s: SiteFactsSnapshot): SiteFactsGap[] {
  const out: SiteFactsGap[] = [];
  const href = SITE_FACTS_HREF[s.vertical];
  const gap = (cond: boolean, key: SiteFactsGapKey, label: string) => {
    if (cond) out.push({ key, label, href: href[key] });
  };
  const own = GAP_LABEL[s.vertical];
  gap(!s.location.address, 'address', 'Не указан адрес филиала');
  gap(!s.location.phone, 'phone', 'Не указан телефон филиала');
  gap(!s.location.whatsapp, 'whatsapp', 'Не указан WhatsApp: на телефоне не будет кнопки WhatsApp');
  gap(s.catalog.items.length === 0, 'catalog', own.catalog ?? 'Каталог пуст');
  if (s.vertical === 'BEAUTY') gap(s.staff.length === 0, 'staff', own.staff ?? 'Нет сотрудников');
  const noHours = s.vertical === 'HOSPITALITY' ? !s.hours.checkInTime && !s.hours.checkOutTime : s.hours.days.length === 0;
  gap(noHours, 'hours', own.hours ?? 'Нет часов работы');
  gap(s.photosCount < SITE_FACTS_MIN_PHOTOS, 'photos', `Загрузите фото: для галереи нужно не меньше ${SITE_FACTS_MIN_PHOTOS}`);
  return out;
}

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Ответ целиком: каталог и люди в детерминированном порядке, часы по дню и времени, подсказки по пробелам */
export function buildSiteFacts(s: SiteFactsSnapshot): SiteFacts {
  const staff = [...s.staff].sort((a, b) => byCode(a.name, b.name) || byCode(a.id, b.id));
  const days = [...s.hours.days].sort((a, b) => a.weekday - b.weekday || byCode(a.open, b.open));
  const reviews = s.reviews && s.reviews.count > 0 ? { avg: Math.round(s.reviews.avg * 10) / 10, count: s.reviews.count } : null;
  const facts: SiteFacts = {
    vertical: s.vertical,
    location: { ...s.location },
    // порядок каталога задаёт сборщик (меню в порядке ресторана), здесь он не меняется
    catalog: { kind: s.catalog.kind, items: s.catalog.items.map((i) => ({ ...i })) },
    staff,
    hours: { ...s.hours, days },
    photosCount: s.photosCount,
    reviews,
    gaps: [],
  };
  facts.gaps = siteFactsGaps({ ...facts, reviews });
  return facts;
}

/**
 * Часы работы салона из смен мастеров филиала: по каждому дню самое раннее начало и самый поздний конец. Это факт
 * данных (когда в салоне есть хотя бы один мастер), а не обещание записи на любое время внутри
 */
export function hoursFromShifts(shifts: ReadonlyArray<{ weekday: number; timeFrom: string; timeTo: string }>): SiteFactsHoursDay[] {
  const byDay = new Map<number, SiteFactsHoursDay>();
  for (const s of shifts) {
    const day = byDay.get(s.weekday);
    if (!day) byDay.set(s.weekday, { weekday: s.weekday, open: s.timeFrom, close: s.timeTo });
    else {
      if (s.timeFrom < day.open) day.open = s.timeFrom;
      if (s.timeTo > day.close) day.close = s.timeTo;
    }
  }
  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
}

/**
 * Часы ресторана из сервис-периодов: по дню самое раннее начало и самый поздний конец; период до утра следующего дня
 * (`endsNextDay`) закрывается «после полуночи», и такой конец старше любого конца в тот же день
 */
export function hoursFromServicePeriods(
  periods: ReadonlyArray<{ weekday: number; timeFrom: string; timeTo: string; endsNextDay: boolean }>,
): SiteFactsHoursDay[] {
  const byDay = new Map<number, { open: string; close: string; late: boolean }>();
  for (const p of periods) {
    const day = byDay.get(p.weekday);
    if (!day) byDay.set(p.weekday, { open: p.timeFrom, close: p.timeTo, late: p.endsNextDay });
    else {
      if (p.timeFrom < day.open) day.open = p.timeFrom;
      if (p.endsNextDay && (!day.late || p.timeTo > day.close)) Object.assign(day, { close: p.timeTo, late: true });
      else if (!p.endsNextDay && !day.late && p.timeTo > day.close) day.close = p.timeTo;
    }
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([weekday, d]) => ({ weekday, open: d.open, close: d.close }));
}
