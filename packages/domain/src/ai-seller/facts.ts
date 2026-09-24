import { createHash } from 'node:crypto';
import { localDate } from '../web-analytics/metrics';

/**
 * Факты объекта для ИИ-продавца (ТЗ ред. 1 П8, Б7; ADR-077, ADR-080; docs/assistant/README.md §4): адрес, заезд и выезд,
 * категории и цены по тарифу виджета сайта — из самой платформы. Руками их не перепечатывают: второй прайс в боте
 * разошёлся бы с первым в день смены тарифа (ТЗ §2 п. 1).
 *
 * Тело — ровно модель бота `ObjectFacts` (`apps/ai-seller/src/knowledge/facts.py`, `extra='forbid'`): у неё одна
 * цена за ночь на категорию. Цена уходит, только если за окно она не меняется; иначе `null`, и бот говорит «уточнит
 * администратор» — названная им цена становится обещанием гостю (Q-179). Цены по датам — следующий шаг контракта Б7.
 *
 * Наличия мест в фактах нет: занятость меняется каждую минуту, её отдаст котировка в части 3 ТЗ.
 */

/** Окно цен — от сегодняшнего дня объекта */
export const SELLER_FACTS_DAYS = 60;
/** Так бот называет документ фактов в своих знаниях (источник ставит он сам) */
export const SELLER_FACTS_DOCUMENT = 'platform:facts.md';

/** Пределы модели бота `ObjectFacts` */
const LIMITS = { objectName: 120, address: 300, timezone: 64, categories: 50, categoryName: 120, capacity: 50 };

export interface SellerFactsSource {
  property: {
    name: string;
    address: string | null;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  };
  categories: Array<{
    code: string;
    name: string;
    kind: string;
    capacityAdults: number;
    /** Активных единиц продажи категории — для экрана; продавцу не уходит */
    units: number;
  }>;
  /** Тариф виджета бронирования на сайте объекта; `null` — не выбран */
  ratePlan: { code: string; name: string; currency: string } | null;
  rates: Array<{ categoryCode: string; date: string; occupancy: number; priceMinor: bigint }>;
  window: { from: string; to: string };
}

/** Тело `PUT /seller/facts` — модель бота `ObjectFacts` (Б7) */
export interface SellerFactsPayload {
  object_name: string;
  address: string;
  timezone: string;
  check_in: string;
  check_out: string;
  currency: string;
  categories: Array<{
    name: string;
    kind: 'room' | 'bed';
    capacity: number;
    /** Целые тиыны (ADR-008); `null` — цены нет, бот скажет «уточнит администратор» */
    price_minor: number | null;
  }>;
}

/** Цена категории глазами стойки: что уходит продавцу и почему (экран «Данные объекта») */
export interface SellerCategoryPrice {
  code: string;
  name: string;
  kind: string;
  capacity: number;
  units: number;
  /** Для скольких гостей цена; `null` — цен нет */
  occupancy: number | null;
  /** Что уходит продавцу, тиыны строкой; `null` — цена не уходит */
  priceMinor: string | null;
  /** `same` — одна весь срок, уходит; `varies` — меняется, не уходит; `none` — цен в тарифе сайта нет */
  reason: 'same' | 'varies' | 'none';
  min: string | null;
  max: string | null;
  /** Дней с ценой в окне */
  days: number;
}

const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Окно цен: сегодняшний день объекта и ещё `SELLER_FACTS_DAYS − 1` дней */
export function sellerFactsWindow(now: Date, timezone: string): { from: string; to: string } {
  const from = localDate(now, timezone);
  return { from, to: addDays(from, SELLER_FACTS_DAYS - 1) };
}

const byCode = <T extends { code: string }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => a.code.localeCompare(b.code));

/**
 * Какая цена уходит продавцу по каждой категории (ADR-080, Q-179): цена за ночь при наибольшем числе гостей, на которое
 * она есть в тарифе сайта (у «Двухместной» — за двоих; у остальных категорий цена от числа гостей не зависит, строка
 * одна), и только если за окно она ни разу не меняется. Сравнение — целыми (BigInt), без float.
 */
export function sellerCategoryPrices(source: SellerFactsSource): SellerCategoryPrice[] {
  return byCode(source.categories).map((c): SellerCategoryPrice => {
    const capacity = Math.max(1, c.capacityAdults);
    const rows = source.ratePlan
      ? source.rates.filter((r) => r.categoryCode === c.code && r.occupancy <= capacity)
      : [];
    const base = { code: c.code, name: c.name, kind: c.kind, capacity, units: c.units };
    if (rows.length === 0)
      return { ...base, occupancy: null, priceMinor: null, reason: 'none', min: null, max: null, days: 0 };
    const occupancy = Math.max(...rows.map((r) => r.occupancy));
    const at = rows.filter((r) => r.occupancy === occupancy);
    let min = at[0]!.priceMinor;
    let max = min;
    for (const r of at) {
      if (r.priceMinor < min) min = r.priceMinor;
      if (r.priceMinor > max) max = r.priceMinor;
    }
    const same = min === max;
    return {
      ...base,
      occupancy,
      priceMinor: same ? min.toString() : null,
      reason: same ? 'same' : 'varies',
      min: min.toString(),
      max: max.toString(),
      days: new Set(at.map((r) => r.date)).size,
    };
  });
}

/** Время заезда и выезда — ЧЧ:ММ, как требует бот (в карточке бывает и «14:00:00», и «9:30») */
const hhmm = (value: string): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : value.trim();
};

/** Цена числом для тела: тиыны больше безопасного целого JavaScript — не шлём, чем исказить */
const minorNumber = (minor: string | null): number | null => {
  if (minor === null) return null;
  const n = BigInt(minor);
  return n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= 0n ? Number(n) : null;
};

/**
 * Тело `PUT /seller/facts`. Категории — по коду: порядок не зависит от выборки. Адрес длиннее предела бота не режется,
 * а не шлётся: обрезанный адрес бот назвал бы гостю как настоящий.
 */
export function buildSellerFacts(source: SellerFactsSource): SellerFactsPayload {
  const address = source.property.address?.trim() ?? '';
  const prices = new Map(sellerCategoryPrices(source).map((p) => [p.code, p]));
  return {
    object_name: source.property.name.trim().slice(0, LIMITS.objectName),
    address: address.length > LIMITS.address ? '' : address,
    timezone: source.property.timezone.slice(0, LIMITS.timezone),
    check_in: hhmm(source.property.checkInTime),
    check_out: hhmm(source.property.checkOutTime),
    currency: source.ratePlan?.currency ?? source.property.currency,
    categories: byCode(source.categories)
      .slice(0, LIMITS.categories)
      .map((c) => ({
        name: c.name.trim().slice(0, LIMITS.categoryName),
        kind: c.kind === 'DORM_BED' ? ('bed' as const) : ('room' as const),
        capacity: Math.min(Math.max(1, c.capacityAdults), LIMITS.capacity),
        price_minor: minorNumber(prices.get(c.code)?.priceMinor ?? null),
      })),
  };
}

/** Отпечаток фактов — SHA-256 тела: по нему служба сверки решает, слать ли продавцу заново */
export function sellerFactsHash(payload: SellerFactsPayload): string {
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}
