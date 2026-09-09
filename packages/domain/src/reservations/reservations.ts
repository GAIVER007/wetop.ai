/**
 * Ручная бронь — чистые правила (plans/slice-3-step-3-4-manual-reservation.md).
 * Источники правил: DATA_MODEL §2 (статус на проживании, шапка производная), ADR-006, ADR-008.
 * Здесь нет ни HTTP, ни Prisma: только даты, статусы и деньги в minor units.
 */
import { dateRange } from '../chessboard/build';

export type ReservationStatus =
  'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export type ReservationSource =
  'DESK' | 'PHONE' | 'WHATSAPP' | 'WALK_IN' | 'INSTAGRAM' | 'OTA' | 'WEBSITE';

export const RESERVATION_SOURCES: readonly ReservationSource[] = [
  'DESK',
  'PHONE',
  'WHATSAPP',
  'WALK_IN',
  'INSTAGRAM',
  'OTA',
  'WEBSITE',
];

export class ReservationRuleError extends Error {
  override readonly name = 'ReservationRuleError';
}

export interface NightRate {
  date: string;
  occupancy: number;
  priceMinor: bigint;
}
export interface StayPrice {
  nights: Array<{ date: string; priceMinor: bigint }>;
  totalMinor: bigint;
}

const addDays = (iso: string, n: number): string => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Цена проживания = сумма DailyRate по ночам [arrival, departure) для нужного occupancy. Нет цены — ошибка. */
export function priceStay(input: {
  arrivalDate: string;
  departureDate: string;
  occupancy: number;
  rates: NightRate[];
}): StayPrice {
  if (input.departureDate <= input.arrivalDate)
    throw new ReservationRuleError(
      `Проживание должно содержать хотя бы одну ночь: заезд ${input.arrivalDate}, выезд ${input.departureDate}`,
    );
  const byDate = new Map(
    input.rates.filter((r) => r.occupancy === input.occupancy).map((r) => [r.date, r.priceMinor]),
  );
  const nights = dateRange(input.arrivalDate, addDays(input.departureDate, -1)).map((date) => {
    const priceMinor = byDate.get(date);
    if (priceMinor === undefined)
      throw new ReservationRuleError(`Нет цены на ночь ${date} (occupancy ${input.occupancy})`);
    return { date, priceMinor };
  });
  return { nights, totalMinor: nights.reduce((s, n) => s + n.priceMinor, 0n) };
}

const HEADER_PRIORITY: readonly ReservationStatus[] = [
  'CHECKED_IN',
  'CONFIRMED',
  'TENTATIVE',
  'CHECKED_OUT',
  'NO_SHOW',
];

/** Статус шапки из статусов проживаний (DATA_MODEL §2 v0.3). */
export function deriveReservationStatus(items: readonly ReservationStatus[]): ReservationStatus {
  if (items.length === 0) throw new ReservationRuleError('Бронь без проживаний');
  if (items.every((s) => s === 'CANCELLED')) return 'CANCELLED';
  for (const s of HEADER_PRIORITY) if (items.includes(s)) return s;
  return 'CANCELLED';
}

export function assertCanCancel(status: ReservationStatus): void {
  if (status === 'CANCELLED') throw new ReservationRuleError('Проживание уже отменено');
  if (status === 'CHECKED_IN')
    throw new ReservationRuleError('Гость заселён — отмена невозможна, нужен выезд');
  if (status !== 'TENTATIVE' && status !== 'CONFIRMED')
    throw new ReservationRuleError(`Отмена невозможна из статуса ${status}`);
}

export function assertCanChangeDates(status: ReservationStatus): void {
  if (status !== 'TENTATIVE' && status !== 'CONFIRMED')
    throw new ReservationRuleError(`Изменение дат невозможно из статуса ${status}`);
}

export function assertCanAssign(status: ReservationStatus): void {
  if (status !== 'TENTATIVE' && status !== 'CONFIRMED' && status !== 'CHECKED_IN')
    throw new ReservationRuleError(`Назначение ячейки невозможно из статуса ${status}`);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** `YYYYMMDD-XXXXXX`: дата создания в Asia/Almaty (UTC+5, без перехода на летнее время) + 6 символов. */
export function confirmationNumber(now: Date, random: () => number = Math.random): string {
  const almaty = new Date(now.getTime() + 5 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 6; i += 1)
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
  return `${almaty}-${suffix}`;
}
