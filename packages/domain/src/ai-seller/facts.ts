import { createHash } from 'node:crypto';
import { localDate } from '../web-analytics/metrics';

/**
 * Факты объекта для ИИ-продавца (ТЗ ред. 1 П8, Б7; docs/assistant/README.md §4): адрес, заезд и выезд, категории и цены
 * по тарифу виджета сайта — из самой платформы. Руками их не перепечатывают: второй прайс в боте разошёлся бы с
 * первым в день смены тарифа (ТЗ §2 п. 1).
 *
 * Наличия мест в фактах нет: занятость меняется каждую минуту, её отдаст котировка в части 3 ТЗ.
 */

export const SELLER_FACTS_SOURCE = 'platform:facts';
/** Окно цен — от сегодняшнего дня объекта */
export const SELLER_FACTS_DAYS = 60;

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
    /** Активных единиц продажи категории */
    units: number;
  }>;
  /** Тариф виджета бронирования на сайте объекта; `null` — не выбран */
  ratePlan: { code: string; name: string } | null;
  rates: Array<{ categoryCode: string; date: string; occupancy: number; priceMinor: bigint }>;
  window: { from: string; to: string };
}

export interface SellerFactsPayload {
  source: typeof SELLER_FACTS_SOURCE;
  generated_at: string;
  property: {
    name: string;
    address: string | null;
    timezone: string;
    currency: string;
    check_in_time: string;
    check_out_time: string;
  };
  categories: Array<{
    code: string;
    name: string;
    kind: string;
    capacity_adults: number;
    units: number;
  }>;
  rate_plan: { code: string; name: string } | null;
  window: { from: string; to: string };
  prices: Array<{
    category_code: string;
    date: string;
    guests: number;
    price_minor: string;
    price_text: string;
  }>;
}

/**
 * Сумма словами для продавца — как деньги на экранах стойки (DESIGN.md §14, `formatMoney` стойки): «12 500 ₸» без
 * тиынов, если сумма целая; «12 500,50 ₸», если нет. Только целые числа: float здесь нет (ADR-008).
 */
export function priceText(minor: bigint, currency: string): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cents = abs % 100n;
  const tail = cents === 0n ? '' : `,${cents.toString().padStart(2, '0')}`;
  return `${neg ? '−' : ''}${whole}${tail} ${currency === 'KZT' ? '₸' : currency}`;
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

/** Тело `PUT /seller/facts`. Цены — по коду категории, дате и числу гостей: порядок не зависит от выборки */
export function buildSellerFacts(source: SellerFactsSource, generatedAt: Date): SellerFactsPayload {
  const currency = source.property.currency;
  const address = source.property.address?.trim() ?? '';
  const prices = source.ratePlan
    ? [...source.rates]
        .sort(
          (a, b) =>
            a.categoryCode.localeCompare(b.categoryCode) ||
            a.date.localeCompare(b.date) ||
            a.occupancy - b.occupancy,
        )
        .map((r) => ({
          category_code: r.categoryCode,
          date: r.date,
          guests: r.occupancy,
          price_minor: r.priceMinor.toString(),
          price_text: priceText(r.priceMinor, currency),
        }))
    : [];
  return {
    source: SELLER_FACTS_SOURCE,
    generated_at: generatedAt.toISOString(),
    property: {
      name: source.property.name,
      address: address === '' ? null : address,
      timezone: source.property.timezone,
      currency,
      check_in_time: source.property.checkInTime,
      check_out_time: source.property.checkOutTime,
    },
    categories: source.categories.map((c) => ({
      code: c.code,
      name: c.name,
      kind: c.kind,
      capacity_adults: c.capacityAdults,
      units: c.units,
    })),
    rate_plan: source.ratePlan ? { code: source.ratePlan.code, name: source.ratePlan.name } : null,
    window: { from: source.window.from, to: source.window.to },
    prices,
  };
}

/** Отпечаток фактов — SHA-256 без времени сборки: по нему служба сверки решает, слать ли продавцу заново */
export function sellerFactsHash(payload: SellerFactsPayload): string {
  // undefined JSON.stringify пропускает: время сборки в отпечаток не попадает
  const stable = { ...payload, generated_at: undefined };
  return createHash('sha256').update(JSON.stringify(stable), 'utf8').digest('hex');
}
