import { foodInt, foodObject, foodText } from './food';
import { stockDate } from './stock';

/** Правила брони столов филиала (DATA_MODEL §43, ADR-177); умолчания равны прежнему поведению */
export interface BookingRules {
  bufferMinutes: number;
  horizonDays: number | null;
  maxPartySize: number | null;
}
export const DEFAULT_BOOKING_RULES: BookingRules = { bufferMinutes: 0, horizonDays: null, maxPartySize: null };

const optional = (v: unknown, min: number, max: number) => (v == null ? null : foodInt(v, min, max));

export function parseBookingRules(raw: unknown): BookingRules {
  const b = foodObject(raw, ['bufferMinutes', 'horizonDays', 'maxPartySize']);
  return {
    bufferMinutes: foodInt(b.bufferMinutes, 0, 240),
    horizonDays: optional(b.horizonDays, 1, 730),
    maxPartySize: optional(b.maxPartySize, 1, 500),
  };
}

export function parseClosedDay(raw: unknown): { day: string; reason: string | null } {
  const b = foodObject(raw, ['day', 'reason']);
  return {
    day: stockDate(b.day),
    reason: typeof b.reason === 'string' && b.reason.trim() ? foodText(b.reason, 200) : null,
  };
}

/** 1 день, 2 дня, 5 дней */
const plural = (n: number, [one, few, many]: [string, string, string]) => {
  const d = n % 10,
    h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/** Почему бронь на этот день и столько гостей не принимается; `null` значит принимается */
export function bookingRuleViolation(input: {
  /** дата начала брони в поясе филиала */
  day: string;
  today: string;
  partySize: number;
  rules: BookingRules;
  closed: boolean;
}): string | null {
  const { rules } = input;
  if (input.closed) return 'В этот день заведение не принимает брони';
  if (rules.horizonDays !== null && dayNumber(input.day) - dayNumber(input.today) > rules.horizonDays)
    return `Бронь принимается не дальше чем на ${rules.horizonDays} ${plural(rules.horizonDays, ['день', 'дня', 'дней'])} вперёд`;
  if (rules.maxPartySize !== null && input.partySize > rules.maxPartySize)
    return `В одной брони не больше ${rules.maxPartySize} ${plural(rules.maxPartySize, ['гостя', 'гостей', 'гостей'])}`;
  return null;
}
