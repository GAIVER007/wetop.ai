import { assertDerivedRuleAllows, type DerivedRule } from '../rates/discounts';
import {
  priceStay,
  ReservationRuleError,
  type NightRate,
  type StayRestriction,
} from '../reservations/reservations';

/**
 * Цена «от» на сайте без дат (`B-FROMPRICE`, Q-276, решение владельца 07.10.2026). Это подсказка тарифа, а не
 * обещание мест: свободные места, ограничения проживания и итог проверяет `/w/availability` после выбора дат.
 *
 * Правило: тариф брони сайта (выбирает вызывающий), окно сегодня по дате объекта и ещё 29 ночей, минимальная цена одной
 * ночи при полной вместимости категории. Ночь со стоп-продажей не участвует. Окно продаж производного тарифа
 * применяется к ночи как к дате заезда тем же правилом, что у брони; минимум ночей, закрытие на заезд или выезд и
 * пределы проживания относятся к конкретному проживанию и здесь не применяются.
 */
export const FROM_PRICE_WINDOW_NIGHTS = 30;

const plusDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Окно ночей: `from` и `to` включительно, `toExclusive` для выборок `[from, toExclusive)` */
export function fromPriceWindow(today: string): { from: string; to: string; toExclusive: string } {
  return {
    from: today,
    to: plusDays(today, FROM_PRICE_WINDOW_NIGHTS - 1),
    toExclusive: plusDays(today, FROM_PRICE_WINDOW_NIGHTS),
  };
}

export interface FromPriceInput {
  /** Сегодня по дате объекта */
  today: string;
  /** Вместимость категории: цена берётся для этой вместимости, как цена места целиком */
  capacityAdults: number;
  /** Цены ночей тарифа брони (производный тариф уже со своей скидкой, промокода нет) */
  rates: readonly NightRate[];
  restrictions: readonly StayRestriction[];
  /** Правило производного тарифа брони; null у обычного тарифа */
  derived: { planName: string; rule: DerivedRule } | null;
}

/** Минимальная цена одной ночи в окне в тиынах; `null`, если ни одна ночь не подошла */
export function fromPriceMinor(input: FromPriceInput): bigint | null {
  const stopped = new Set(input.restrictions.filter((r) => r.stopSell).map((r) => r.date));
  const windowRule = input.derived ? { ...input.derived.rule, minNights: null } : null;
  let min: bigint | null = null;
  for (let i = 0; i < FROM_PRICE_WINDOW_NIGHTS; i++) {
    const date = plusDays(input.today, i);
    if (stopped.has(date)) continue;
    try {
      if (windowRule)
        assertDerivedRuleAllows(windowRule, {
          planName: input.derived!.planName,
          today: input.today,
          arrivalDate: date,
          nights: 1,
        });
      const night = priceStay({
        arrivalDate: date,
        departureDate: plusDays(date, 1),
        occupancy: input.capacityAdults,
        rates: [...input.rates],
      });
      if (min === null || night.totalMinor < min) min = night.totalMinor;
    } catch (e) {
      if (!(e instanceof ReservationRuleError)) throw e;
    }
  }
  return min;
}
