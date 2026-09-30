/**
 * Производный тариф и промокод — чистые правила (DATA_MODEL §20, ADR-128, срез D4; решения владельца 29.09.2026:
 * Q-233 минимальный набор, Q-231 одна большая скидка без суммирования). Деньги — integer minor units (ADR-008),
 * процент — целый; float не участвует. Ни HTTP, ни Prisma: только числа, даты и слова отказа.
 */
import { ReservationRuleError } from '../reservations/reservations';

export const MAX_DISCOUNT_PERCENT = 90;

const isPercent = (value: number) =>
  Number.isInteger(value) && value >= 1 && value <= MAX_DISCOUNT_PERCENT;

/** Цена со скидкой: `price · (100 − процент) / 100`, к ближайшему тиыну, половина — вверх. */
export function discountedMinor(priceMinor: bigint, percent: number): bigint {
  if (!isPercent(percent))
    throw new ReservationRuleError(`Скидка — целое число от 1 до ${MAX_DISCOUNT_PERCENT} процентов`);
  return (priceMinor * BigInt(100 - percent) + 50n) / 100n;
}

/** Правило производного тарифа: поля `RatePlan` из §20. `null` — условия нет. */
export interface DerivedRule {
  discountPercent: number;
  minDaysBeforeArrival: number | null;
  maxDaysBeforeArrival: number | null;
  minNights: number | null;
}

/** Слова ошибки или `null`, если правило верное. Проверяет только то, что можно проверить без базы. */
export function validateDerivedRule(rule: DerivedRule): string | null {
  if (!isPercent(rule.discountPercent))
    return `Скидка — целое число от 1 до ${MAX_DISCOUNT_PERCENT} процентов`;
  const days = [
    ['Раннее бронирование', rule.minDaysBeforeArrival],
    ['Last minute', rule.maxDaysBeforeArrival],
  ] as const;
  for (const [name, value] of days)
    if (value !== null && (!Number.isInteger(value) || value < 0))
      return `${name}: число дней — целое, не меньше нуля`;
  if (
    rule.minDaysBeforeArrival !== null &&
    rule.maxDaysBeforeArrival !== null &&
    rule.minDaysBeforeArrival > rule.maxDaysBeforeArrival
  )
    return 'Окно продаж пустое: «не раньше чем за» больше, чем «не позже чем за»';
  if (rule.minNights !== null && (!Number.isInteger(rule.minNights) || rule.minNights < 1))
    return 'Минимум ночей — целое число, не меньше 1';
  return null;
}

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  );

/**
 * Можно ли продать проживание по производному тарифу. `today` — сегодня по часовому поясу объекта (AGENTS.md §13),
 * его считает вызывающий. Границы окон включаются. Отказ — `ReservationRuleError` со словами для человека.
 */
export function assertDerivedRuleAllows(
  rule: DerivedRule,
  input: { planName: string; today: string; arrivalDate: string; nights: number },
): void {
  const daysBefore = daysBetween(input.today, input.arrivalDate);
  if (daysBefore < 0)
    throw new ReservationRuleError(`${input.planName}: заезд ${input.arrivalDate} уже в прошлом`);
  if (rule.minDaysBeforeArrival !== null && daysBefore < rule.minDaysBeforeArrival)
    throw new ReservationRuleError(
      `${input.planName}: заезд не раньше чем через ${rule.minDaysBeforeArrival} дн., до заезда ${daysBefore} дн.`,
    );
  if (rule.maxDaysBeforeArrival !== null && daysBefore > rule.maxDaysBeforeArrival)
    throw new ReservationRuleError(
      `${input.planName}: заезд не позже чем через ${rule.maxDaysBeforeArrival} дн., до заезда ${daysBefore} дн.`,
    );
  if (rule.minNights !== null && input.nights < rule.minNights)
    throw new ReservationRuleError(
      `${input.planName}: минимум ${rule.minNights} ноч., запрошено ${input.nights}`,
    );
}

/** Код промокода: верхний регистр, 3–32 знака из A–Z, 0–9, «-» и «_». Иначе `null`. */
export function normalizePromoCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}

/** Промокод: строка `PromoCode` из §20 плюс сколько раз он уже использован (число броней с `promo_code_id`). */
export interface PromoRule {
  code: string;
  discountPercent: number;
  /** Первая и последняя ночь периода проживания, включительно; `null` — без границы */
  stayFrom: string | null;
  stayTo: string | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
}

const previousDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Действует ли промокод на проживание: выключен, исчерпан или проживание вне периода — отказ словами. */
export function assertPromoAllows(
  promo: PromoRule,
  stay: { arrivalDate: string; departureDate: string },
): void {
  if (!promo.active) throw new ReservationRuleError(`Промокод ${promo.code} не действует`);
  if (promo.maxUses !== null && promo.uses >= promo.maxUses)
    throw new ReservationRuleError(`Промокод ${promo.code} исчерпан`);
  const lastNight = previousDay(stay.departureDate);
  if (
    (promo.stayFrom !== null && stay.arrivalDate < promo.stayFrom) ||
    (promo.stayTo !== null && lastNight > promo.stayTo)
  )
    throw new ReservationRuleError(`Промокод ${promo.code} не действует на этот период проживания`);
}

export type DiscountSource = 'PLAN' | 'PROMO' | null;

/** Q-231: скидки не суммируются — применяется одна, большая; при равных — скидка тарифа. */
export function pickDiscount(
  planPercent: number | null,
  promoPercent: number | null,
): { percent: number; source: DiscountSource } {
  if (planPercent === null && promoPercent === null) return { percent: 0, source: null };
  if (promoPercent !== null && (planPercent === null || promoPercent > planPercent))
    return { percent: promoPercent, source: 'PROMO' };
  return { percent: planPercent ?? 0, source: 'PLAN' };
}
