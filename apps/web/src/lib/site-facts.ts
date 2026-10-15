/**
 * Факты филиала для первого экрана «Сайт и SEO» (SITE-1, `plans/site-seo-flow-2026-10-15.md` §1 шаг 1). Источник
 * правды: API `GET /marketing/site/facts?locationId=…` и `GET /marketing/site/locations` (делает соседний срез API).
 * Типы ниже повторяют его контракт поле в поле. Пока эндпоинта нет (404), факты собираются из уже существующих
 * запросов стойки по направлению: гостиница из брифа сайта, салон из услуг и мастеров, ресторан из меню и часов
 * работы. ИИ здесь нет: только то, что уже лежит в системе; чего нет, то идёт в «пробелы» со ссылкой «Дополнить».
 *
 * Деньги в каталоге: целые тиыны (ADR-008), числом или строкой, как пришло; на экран идут через `formatMoney`.
 */
export type SiteVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
export type SiteStatus = 'NONE' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
/** Сумма в тиынах: целое число или строка цифр */
export type MinorAmount = number | string;

export interface SiteFactsCatalogItem {
  name: string;
  price?: MinorAmount;
  priceFrom?: MinorAmount;
  durationMin?: number;
  category?: string;
}

export interface SiteFactsGap {
  key: string;
  label: string;
  href: string;
}

export interface SiteFacts {
  vertical: SiteVertical;
  location: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    city: string | null;
  };
  catalog: { kind: 'rooms' | 'services' | 'menu'; items: SiteFactsCatalogItem[] };
  staff: Array<{ name: string; role?: string }>;
  hours: string | string[] | null;
  photosCount: number;
  reviews: { avg: number; count: number } | null;
  gaps: SiteFactsGap[];
}

export interface SiteLocation {
  id: string;
  name: string;
  vertical: SiteVertical;
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
        accommodations: Array<{ categoryCode: string; name: string }>;
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
        name: string;
        category: string | null;
        durationMinutes: number;
        priceMinor: string;
        active: boolean;
        effective: { sellable: true; priceMinor: string; durationMinutes: number } | { sellable: false } | null;
      }>;
    }>;
    employees: () => Promise<{ locationId: string | null; items: Array<{ name: string; active: boolean; locationIds: string[] }> }>;
    hours: () => Promise<Array<{ weekday: number; intervals: Array<{ timeFrom: string; timeTo: string }> }>>;
  };
  food: {
    categories: () => Promise<Array<{ id: string; name: string; active: boolean }>>;
    items: () => Promise<Array<{ name: string; categoryId: string; priceMinor: string; active: boolean; photoUrl?: string | null }>>;
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

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
/** Неделя по дням с понедельника: «Пн 10:00–20:00»; одинаковые дни не склеиваются, чтобы не врать про исключения */
export function weekHours(rows: Array<{ weekday: number; from: string; to: string }>): string[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .map((day) => {
      const own = rows.filter((r) => r.weekday === day).sort((a, b) => (a.from < b.from ? -1 : 1));
      return own.length ? `${WEEKDAYS[day]} ${own.map((r) => `${r.from}–${r.to}`).join(', ')}` : null;
    })
    .filter((x): x is string => x !== null);
}

const GAP = {
  phone: (href: string): SiteFactsGap => ({ key: 'phone', label: 'Нет телефона: посетитель не сможет позвонить', href }),
  address: (href: string): SiteFactsGap => ({ key: 'address', label: 'Нет адреса: на сайте не будет карты и контактов', href }),
  photos: (href: string): SiteFactsGap => ({ key: 'photos', label: 'Нет фото: сайт соберётся без галереи', href }),
  hours: (href: string, label: string): SiteFactsGap => ({ key: 'hours', label, href }),
  catalog: (href: string, label: string): SiteFactsGap => ({ key: 'catalog', label, href }),
  staff: (href: string): SiteFactsGap => ({ key: 'staff', label: 'Нет мастеров: блок «Мастера» не появится', href }),
};

/** Гостиница: бриф сайта (то же, что видел первый экран MKT9.2), цены категорий и библиотека фото */
async function hospitalityFacts(locationId: string, src: SiteFactsSource): Promise<SiteFacts> {
  const brief = await src.hospitality.brief();
  const [prices, photos] = await Promise.all([optional(src.hospitality.prices, []), optional(src.hospitality.photos, 0)]);
  const id = brief.input.identity;
  const price = new Map(prices.map((p) => [p.code, p.priceMinor]));
  const items: SiteFactsCatalogItem[] = brief.input.accommodations.map((a) => {
    const minor = price.get(a.categoryCode);
    return minor ? { name: a.name, priceFrom: minor } : { name: a.name };
  });
  const stay = brief.input.stay;
  const hours = stay?.checkInTime || stay?.checkOutTime
    ? [stay.checkInTime ? `Заезд с ${stay.checkInTime}` : null, stay.checkOutTime ? `выезд до ${stay.checkOutTime}` : null].filter(Boolean).join(', ')
    : null;
  const photosCount = Math.max(photos, brief.input.channelContent?.photoSummary?.total ?? 0);
  const gaps: SiteFactsGap[] = [];
  if (!id.phone) gaps.push(GAP.phone('/hotel-settings'));
  if (!id.address) gaps.push(GAP.address('/hotel-settings'));
  if (!items.length) gaps.push(GAP.catalog('/rooms/categories', 'Нет категорий номеров: нечего показать в каталоге'));
  else if (!items.some((i) => i.priceFrom !== undefined)) gaps.push(GAP.catalog('/rates', 'Нет цен: на сайте не будет цены «от»'));
  if (!hours) gaps.push(GAP.hours('/hotel-settings/stay', 'Нет времени заезда и выезда'));
  if (!photosCount) gaps.push(GAP.photos('/marketing/site/assets'));
  return {
    vertical: 'HOSPITALITY',
    location: { id: locationId, name: id.displayNameCandidate, address: id.address ?? null, phone: id.phone ?? null, whatsapp: null, city: id.city ?? null },
    catalog: { kind: 'rooms', items },
    staff: [],
    hours,
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
    .map((s) => {
      const eff = s.effective as { priceMinor: string; durationMinutes: number };
      return { name: s.name, price: eff.priceMinor, durationMin: eff.durationMinutes, ...(s.category ? { category: s.category } : {}) };
    });
  const staff = employees.items.filter((e) => e.active && e.locationIds.includes(locationId)).map((e) => ({ name: e.name }));
  const week = weekHours(hours.flatMap((d) => d.intervals.map((i) => ({ weekday: d.weekday, from: i.timeFrom, to: i.timeTo }))));
  const gaps: SiteFactsGap[] = [];
  if (!branch?.address) gaps.push(GAP.address('/branches'));
  gaps.push(GAP.phone('/branches'));
  if (!items.length) gaps.push(GAP.catalog('/services', 'Нет услуг с ценой в этом филиале'));
  if (!staff.length) gaps.push(GAP.staff('/employees'));
  if (!week.length) gaps.push(GAP.hours('/beauty/schedule', 'Нет графика работы'));
  gaps.push(GAP.photos('/marketing/site/assets'));
  return {
    vertical: 'BEAUTY',
    location: { id: locationId, name: branch?.name ?? 'Салон', address: branch?.address ?? null, phone: null, whatsapp: null, city: null },
    catalog: { kind: 'services', items },
    staff,
    hours: week.length ? week : null,
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
  const items: SiteFactsCatalogItem[] = active.map((i) => {
    const category = categoryName.get(i.categoryId);
    return { name: i.name, price: i.priceMinor, ...(category ? { category } : {}) };
  });
  const week = weekHours(periods.filter((p) => p.active).map((p) => ({ weekday: p.weekday, from: p.timeFrom, to: p.timeTo })));
  const photosCount = active.filter((i) => i.photoUrl).length;
  const gaps: SiteFactsGap[] = [];
  if (!branch?.address) gaps.push(GAP.address('/branches'));
  gaps.push(GAP.phone('/branches'));
  if (!items.length) gaps.push(GAP.catalog('/menu', 'Меню пустое: на сайте не будет блюд и цен'));
  if (!week.length) gaps.push(GAP.hours('/restaurant-settings', 'Нет часов работы'));
  if (!photosCount) gaps.push(GAP.photos('/menu'));
  return {
    vertical: 'FOOD_SERVICE',
    location: { id: locationId, name: branch?.name ?? 'Ресторан', address: branch?.address ?? null, phone: null, whatsapp: null, city: null },
    catalog: { kind: 'menu', items },
    staff: [],
    hours: week.length ? week : null,
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
    if (statusOf(e) !== 404) return { ok: false, status: statusOf(e), message: messageOf(e, 'Не удалось получить данные филиала') };
  }
  try {
    const data =
      vertical === 'BEAUTY' ? await beautyFacts(locationId, src) : vertical === 'FOOD_SERVICE' ? await foodFacts(locationId, src) : await hospitalityFacts(locationId, src);
    return { ok: true, data, source: 'fallback' };
  } catch (e) {
    return { ok: false, status: statusOf(e), message: messageOf(e, 'Не удалось получить данные филиала') };
  }
}

/** Список филиалов: эндпоинт, без него филиалы стойки (статус сайта известен только у выбранного) */
export async function loadSiteLocations(
  src: Pick<SiteFactsSource, 'locations'>,
  fallback: () => Promise<Array<{ locationId: string; name: string; vertical: SiteVertical }>>,
  current: { locationId: string | null; siteStatus: SiteStatus | null },
): Promise<Loaded<SiteLocation[]>> {
  try {
    return { ok: true, data: (await src.locations()) as SiteLocation[], source: 'api' };
  } catch (e) {
    if (statusOf(e) !== 404) return { ok: false, status: statusOf(e), message: messageOf(e, 'Не удалось получить список филиалов') };
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
    return { ok: false, status: statusOf(e), message: messageOf(e, 'Не удалось получить список филиалов') };
  }
}

/** Цена позиции каталога для карточки: «12 500 ₸», «от 12 500 ₸»; без цены: null. Только целые тиыны */
export function catalogPrice(item: SiteFactsCatalogItem, format: (minor: string) => string): string | null {
  const raw = item.price ?? item.priceFrom;
  if (raw === undefined || raw === null) return null;
  const minor = String(raw);
  if (!/^-?\d+$/.test(minor)) return null;
  return item.price === undefined ? `от ${format(minor)}` : format(minor);
}
