/**
 * Факты филиала для первого экрана «Сайт и SEO» (SITE-1, `plans/site-seo-flow-2026-10-15.md` §1 шаг 1). Источник
 * правды: API `GET /marketing/site/facts?locationId=…` и `GET /marketing/site/locations` (SITE-2), контракт `SiteFacts`
 * домена. Пока эндпоинта нет (404, старый сервер), факты собираются из уже существующих запросов стойки по
 * направлению в тот же контракт: гостиница из брифа сайта, салон из услуг и мастеров, ресторан из меню и часов работы.
 * ИИ здесь нет: только то, что уже лежит в системе; чего нет, то идёт в «пробелы» со ссылкой «Дополнить».
 *
 * Деньги в каталоге: целые тиыны строкой с валютой (ADR-008); на экран идут через `formatMoney`.
 */
import type {
  SiteFacts,
  SiteFactsCatalogItem,
  SiteFactsGap,
  SiteFactsHoursDay,
  SiteFactsSiteStatus,
  SiteFactsVertical,
  SiteLocationListItem,
} from '@pms/domain';
import { msg, translator, type Translate } from '../i18n';

export type { SiteFacts, SiteFactsCatalogItem, SiteFactsGap };
export type SiteVertical = SiteFactsVertical;
export type SiteStatus = SiteFactsSiteStatus;

export interface SiteLocation extends Omit<SiteLocationListItem, 'siteStatus'> {
  /** `null`: статус неизвестен (список собран без эндпоинта, сайт читается только у выбранного филиала) */
  siteStatus: SiteStatus | null;
}

/** Ответ на чтение: отказ сервера словами, без падения страницы */
export type Loaded<T> = { ok: true; data: T; source: 'api' | 'fallback' } | { ok: false; status: number; message: string };

/** Запросы, на которых держится сборка без эндпоинта; страница даёт настоящие, тест подставные */
export interface SiteFactsSource {
  facts: (locationId: string) => Promise<unknown>;
  locations: () => Promise<unknown>;
  hospitality: {
    brief: () => Promise<{
      input: {
        identity: { displayNameCandidate: string; address?: string | null; phone?: string | null; city?: string | null };
        stay?: { checkInTime: string | null; checkOutTime: string | null };
        accommodations: Array<{ categoryCode: string; name: string; capacityAdults?: number }>;
        channelContent?: { photoSummary?: { total: number } } | null;
      };
    }>;
    /** Цена категории сегодня (основной тариф); нет доступа к фонду: без цен */
    prices: () => Promise<Array<{ code: string; priceMinor: string | null }>>;
    photos: () => Promise<number>;
  };
  beauty: {
    services: () => Promise<{
      items: Array<{
        id?: string;
        name: string;
        category: string | null;
        durationMinutes: number;
        priceMinor: string;
        active: boolean;
        effective: { sellable: true; priceMinor: string; durationMinutes: number } | { sellable: false } | null;
      }>;
    }>;
    employees: () => Promise<{ locationId: string | null; items: Array<{ id?: string; name: string; active: boolean; locationIds: string[] }> }>;
    hours: () => Promise<Array<{ weekday: number; intervals: Array<{ timeFrom: string; timeTo: string }> }>>;
  };
  food: {
    categories: () => Promise<Array<{ id: string; name: string; active: boolean }>>;
    items: () => Promise<Array<{ id?: string; name: string; categoryId: string; priceMinor: string; active: boolean; photoUrl?: string | null }>>;
    periods: () => Promise<Array<{ name: string; weekday: number; timeFrom: string; timeTo: string; active: boolean }>>;
  };
  /** Филиал как его знает список филиалов стойки: имя, адрес */
  branch: () => Promise<{ name: string; address: string | null } | null>;
}

const statusOf = (e: unknown): number =>
  typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status: unknown }).status === 'number'
    ? (e as { status: number }).status
    : 0;
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
/** Необязательная часть фактов: сбой одного источника не роняет карточку целиком */
async function optional<T>(load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch {
    return empty;
  }
}

const KZT = 'KZT';
const money = (minor: string) => ({ minor, currency: KZT });
/** Код позиции каталога для документа сайта: id из данных, иначе порядковый */
const code = (id: string | undefined, prefix: string, i: number) => (id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : `${prefix}-${i + 1}`);

const WEEKDAYS = [msg('Вс'), msg('Пн'), msg('Вт'), msg('Ср'), msg('Чт'), msg('Пт'), msg('Сб')];
/** Строки недели для карточки с понедельника: «Пн 10:00–20:00»; одинаковые дни не склеиваются, чтобы не врать */
export function weekHours(days: SiteFactsHoursDay[], t: Translate = translator('ru')): string[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .map((day) => {
      const own = days.filter((r) => r.weekday === day).sort((a, b) => (a.open < b.open ? -1 : 1));
      return own.length ? `${t(WEEKDAYS[day] ?? '')} ${own.map((r) => `${r.open}–${r.close}`).join(', ')}` : null;
    })
    .filter((x): x is string => x !== null);
}

/** Часы для карточки: у гостиницы заезд и выезд, у остальных неделя */
export function hoursLines(facts: SiteFacts, t: Translate = translator('ru')): string[] {
  if (facts.vertical === 'HOSPITALITY') {
    const { checkInTime: inT, checkOutTime: outT } = facts.hours;
    const line = [inT ? t('Заезд с {time}', { time: inT }) : null, outT ? t('выезд до {time}', { time: outT }) : null]
      .filter(Boolean)
      .join(', ');
    return line ? [line] : [];
  }
  return weekHours(facts.hours.days, t);
}

/** Один интервал на день: самое раннее начало и самый поздний конец */
function dayHull(rows: Array<{ weekday: number; from: string; to: string }>): SiteFactsHoursDay[] {
  const byDay = new Map<number, SiteFactsHoursDay>();
  for (const r of rows) {
    const was = byDay.get(r.weekday);
    byDay.set(r.weekday, {
      weekday: r.weekday,
      open: !was || r.from < was.open ? r.from : was.open,
      close: !was || r.to > was.close ? r.to : was.close,
    });
  }
  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
}

const GAP = {
  phone: (href: string): SiteFactsGap => ({ key: 'phone', label: msg('Нет телефона: посетитель не сможет позвонить'), href }),
  address: (href: string): SiteFactsGap => ({ key: 'address', label: msg('Нет адреса: на сайте не будет карты и контактов'), href }),
  photos: (href: string): SiteFactsGap => ({ key: 'photos', label: msg('Нет фото: сайт соберётся без галереи'), href }),
  hours: (href: string, label: string): SiteFactsGap => ({ key: 'hours', label, href }),
  catalog: (href: string, label: string): SiteFactsGap => ({ key: 'catalog', label, href }),
  staff: (href: string): SiteFactsGap => ({ key: 'staff', label: msg('Нет мастеров: блок «Мастера» не появится'), href }),
};
const emptyHours = { days: [] as SiteFactsHoursDay[], checkInTime: null, checkOutTime: null };

/** Гостиница: бриф сайта (то же, что видел первый экран MKT9.2), цены категорий и библиотека фото */
async function hospitalityFacts(locationId: string, src: SiteFactsSource): Promise<SiteFacts> {
  const brief = await src.hospitality.brief();
  const [prices, photos] = await Promise.all([optional(src.hospitality.prices, []), optional(src.hospitality.photos, 0)]);
  const id = brief.input.identity;
  const price = new Map(prices.map((p) => [p.code, p.priceMinor]));
  const items: SiteFactsCatalogItem[] = brief.input.accommodations.map((a, i) => {
    const minor = price.get(a.categoryCode);
    return {
      code: code(a.categoryCode, 'room', i),
      name: a.name,
      ...(minor && /^\d+$/.test(minor) ? { priceFrom: money(minor) } : {}),
      ...(a.capacityAdults ? { capacityAdults: a.capacityAdults } : {}),
    };
  });
  const stay = brief.input.stay;
  const photosCount = Math.max(photos, brief.input.channelContent?.photoSummary?.total ?? 0);
  const gaps: SiteFactsGap[] = [];
  if (!id.phone) gaps.push(GAP.phone('/hotel-settings'));
  if (!id.address) gaps.push(GAP.address('/hotel-settings'));
  if (!items.length) gaps.push(GAP.catalog('/rooms/categories', msg('Нет категорий номеров: нечего показать в каталоге')));
  else if (!items.some((i) => i.priceFrom)) gaps.push(GAP.catalog('/rates', msg('Нет цен: на сайте не будет цены «от»')));
  if (!stay?.checkInTime && !stay?.checkOutTime) gaps.push(GAP.hours('/hotel-settings/stay', msg('Нет времени заезда и выезда')));
  if (!photosCount) gaps.push(GAP.photos('/marketing/site/assets'));
  return {
    vertical: 'HOSPITALITY',
    location: { id: locationId, name: id.displayNameCandidate, address: id.address ?? null, phone: id.phone ?? null, whatsapp: null, city: id.city ?? null },
    catalog: { kind: 'rooms', items },
    staff: [],
    hours: { days: [], checkInTime: stay?.checkInTime ?? null, checkOutTime: stay?.checkOutTime ?? null },
    photosCount,
    reviews: null,
    gaps,
  };
}

/** Салон: услуги филиала с его ценой и длительностью, мастера филиала и их общая неделя */
async function beautyFacts(locationId: string, src: SiteFactsSource): Promise<SiteFacts> {
  const [services, employees, hours, branch] = await Promise.all([
    src.beauty.services(),
    optional(src.beauty.employees, { locationId: null, items: [] }),
    optional(src.beauty.hours, []),
    optional(src.branch, null),
  ]);
  const items: SiteFactsCatalogItem[] = services.items
    .filter((s) => s.effective?.sellable === true)
    .map((s, i) => {
      const eff = s.effective as { priceMinor: string; durationMinutes: number };
      return { code: code(s.id, 'svc', i), name: s.name, price: money(eff.priceMinor), durationMin: eff.durationMinutes, ...(s.category ? { category: s.category } : {}) };
    });
  const staff = employees.items
    .filter((e) => e.active && e.locationIds.includes(locationId))
    .map((e, i) => ({ id: e.id ?? `staff-${i + 1}`, name: e.name, specialization: null }));
  const days = dayHull(hours.flatMap((d) => d.intervals.map((i) => ({ weekday: d.weekday, from: i.timeFrom, to: i.timeTo }))));
  const gaps: SiteFactsGap[] = [];
  if (!branch?.address) gaps.push(GAP.address('/branches'));
  gaps.push(GAP.phone('/branches'));
  if (!items.length) gaps.push(GAP.catalog('/services', msg('Нет услуг с ценой в этом филиале')));
  if (!staff.length) gaps.push(GAP.staff('/employees'));
  if (!days.length) gaps.push(GAP.hours('/beauty/schedule', msg('Нет графика работы')));
  gaps.push(GAP.photos('/marketing/site/assets'));
  return {
    vertical: 'BEAUTY',
    location: { id: locationId, name: branch?.name ?? msg('Салон'), address: branch?.address ?? null, phone: null, whatsapp: null, city: null },
    catalog: { kind: 'services', items },
    staff,
    hours: { ...emptyHours, days },
    photosCount: 0,
    reviews: null,
    gaps,
  };
}

/** Ресторан: блюда меню по категориям и сервис-периоды как часы работы */
async function foodFacts(locationId: string, src: SiteFactsSource): Promise<SiteFacts> {
  const [categories, menu, periods, branch] = await Promise.all([
    optional(src.food.categories, []),
    src.food.items(),
    optional(src.food.periods, []),
    optional(src.branch, null),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const active = menu.filter((i) => i.active);
  const items: SiteFactsCatalogItem[] = active.map((i, n) => {
    const category = categoryName.get(i.categoryId);
    return { code: code(i.id, 'dish', n), name: i.name, price: money(i.priceMinor), ...(category ? { category } : {}), hasPhoto: !!i.photoUrl };
  });
  const days = dayHull(periods.filter((p) => p.active).map((p) => ({ weekday: p.weekday, from: p.timeFrom, to: p.timeTo })));
  const photosCount = active.filter((i) => i.photoUrl).length;
  const gaps: SiteFactsGap[] = [];
  if (!branch?.address) gaps.push(GAP.address('/branches'));
  gaps.push(GAP.phone('/branches'));
  if (!items.length) gaps.push(GAP.catalog('/menu', msg('Меню пустое: на сайте не будет блюд и цен')));
  if (!days.length) gaps.push(GAP.hours('/restaurant-settings', msg('Нет часов работы')));
  if (!photosCount) gaps.push(GAP.photos('/menu'));
  return {
    vertical: 'FOOD_SERVICE',
    location: { id: locationId, name: branch?.name ?? msg('Ресторан'), address: branch?.address ?? null, phone: null, whatsapp: null, city: null },
    catalog: { kind: 'menu', items },
    staff: [],
    hours: { ...emptyHours, days },
    photosCount,
    reviews: null,
    gaps,
  };
}

/**
 * Факты филиала: эндпоинт, а без него (404) сборка из существующих запросов. Сборка читает данные ВЫБРАННОГО филиала
 * стойки (все эти запросы в строгом scope), поэтому годится только для текущего `locationId`; другой филиал сначала
 * выбирается тем же переключателем, что в шапке
 */
export async function loadSiteFacts(locationId: string, vertical: SiteVertical, src: SiteFactsSource): Promise<Loaded<SiteFacts>> {
  try {
    return { ok: true, data: (await src.facts(locationId)) as SiteFacts, source: 'api' };
  } catch (e) {
    if (statusOf(e) !== 404) return { ok: false, status: statusOf(e), message: messageOf(e, msg('Не удалось получить данные филиала')) };
  }
  try {
    const data =
      vertical === 'BEAUTY' ? await beautyFacts(locationId, src) : vertical === 'FOOD_SERVICE' ? await foodFacts(locationId, src) : await hospitalityFacts(locationId, src);
    return { ok: true, data, source: 'fallback' };
  } catch (e) {
    return { ok: false, status: statusOf(e), message: messageOf(e, msg('Не удалось получить данные филиала')) };
  }
}

/** Список филиалов: эндпоинт (`{ items }`), без него филиалы стойки (статус сайта известен только у выбранного) */
export async function loadSiteLocations(
  src: Pick<SiteFactsSource, 'locations'>,
  fallback: () => Promise<Array<{ locationId: string; name: string; vertical: SiteVertical }>>,
  current: { locationId: string | null; siteStatus: SiteStatus | null },
): Promise<Loaded<SiteLocation[]>> {
  try {
    const reply = (await src.locations()) as { items: SiteLocation[] } | SiteLocation[];
    return { ok: true, data: Array.isArray(reply) ? reply : reply.items, source: 'api' };
  } catch (e) {
    if (statusOf(e) !== 404) return { ok: false, status: statusOf(e), message: messageOf(e, msg('Не удалось получить список филиалов')) };
  }
  try {
    const branches = await fallback();
    return {
      ok: true,
      source: 'fallback',
      data: branches.map((b) => ({
        id: b.locationId,
        name: b.name,
        vertical: b.vertical,
        siteStatus: b.locationId === current.locationId ? current.siteStatus : null,
      })),
    };
  } catch (e) {
    return { ok: false, status: statusOf(e), message: messageOf(e, msg('Не удалось получить список филиалов')) };
  }
}

/** Цена позиции каталога для карточки: «12 500 ₸», «от 12 500 ₸»; без цены: null. Только целые тиыны */
export function catalogPrice(
  item: SiteFactsCatalogItem,
  format: (minor: string) => string,
  t: Translate = translator('ru'),
): string | null {
  const m = item.price ?? item.priceFrom;
  if (!m || !/^\d+$/.test(m.minor)) return null;
  return item.price ? format(m.minor) : t('от {price}', { price: format(m.minor) });
}
