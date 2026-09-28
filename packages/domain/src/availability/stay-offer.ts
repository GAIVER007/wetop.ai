import {
  assertRestrictionsAllow,
  priceStay,
  ReservationRuleError,
  RestrictionViolationError,
  type NightRate,
  type StayRestriction,
} from '../reservations/reservations';

/** Тариф категории с ценами и ограничениями на даты проживания — как их читает бронь стойки */
export interface PlanForStay {
  code: string;
  currency: string;
  rates: readonly NightRate[];
  restrictions: readonly StayRestriction[];
}

export interface StayOffer {
  /** Сколько тарифов допустимо для этого проживания */
  plans: number;
  /** Полная стоимость проживания на весь запрос по самому дешёвому допустимому тарифу */
  totalMinor: bigint;
  /** Самая низкая цена одной ночи за единицу продажи (номер целиком или одна койка) */
  perNightMinor: bigint;
  ratePlanCode: string;
  currency: string;
}

/**
 * Цена «от» на экране «Свободные места» (ADR-110; правило владельца — закрытый Q-204). Своих расчётов нет:
 * тариф допустим, если `assertRestrictionsAllow` не запрещает проживание и `priceStay` находит цену
 * требуемой occupancy на каждую ночь — те же проверки, что у создания брони стойки. `units` — сколько
 * единиц продажи нужно запросу: номер — один на всех гостей, койка — по одной на гостя; групповая бронь
 * коек стоит столько же (N проживаний по одной койке). Сравниваются только тарифы в валюте объекта.
 */
export function stayOffer(input: {
  arrivalDate: string;
  departureDate: string;
  categoryName: string;
  occupancy: number;
  units: number;
  currency: string;
  plans: readonly PlanForStay[];
}): StayOffer | null {
  const eligible: Array<{ code: string; totalMinor: bigint; perNightMinor: bigint }> = [];
  for (const plan of input.plans) {
    if (plan.currency !== input.currency) continue;
    try {
      assertRestrictionsAllow({
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        categoryName: input.categoryName,
        restrictions: plan.restrictions,
      });
    } catch (e) {
      if (e instanceof RestrictionViolationError) continue;
      throw e;
    }
    let price: ReturnType<typeof priceStay>;
    try {
      price = priceStay({
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        occupancy: input.occupancy,
        rates: [...plan.rates],
      });
    } catch (e) {
      if (e instanceof ReservationRuleError) continue;
      throw e;
    }
    eligible.push({
      code: plan.code,
      totalMinor: price.totalMinor * BigInt(input.units),
      perNightMinor: price.nights.reduce(
        (min, n) => (n.priceMinor < min ? n.priceMinor : min),
        price.nights[0]!.priceMinor,
      ),
    });
  }
  if (!eligible.length) return null;
  const cheapest = eligible.reduce((a, b) => (b.totalMinor < a.totalMinor ? b : a));
  return {
    plans: eligible.length,
    totalMinor: cheapest.totalMinor,
    perNightMinor: eligible.reduce(
      (min, p) => (p.perNightMinor < min ? p.perNightMinor : min),
      eligible[0]!.perNightMinor,
    ),
    ratePlanCode: cheapest.code,
    currency: input.currency,
  };
}
