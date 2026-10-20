import { resolveWorkingTime } from './schedule';
/**
 * Beauty-домен: чистые правила (DATA_MODEL §19 и §19.1, ADR-104, план `plans/beauty-phase3-2026-10-03.md`).
 *
 * Здесь только то, чего не выражает база. Пересечение записей одного мастера базе и остаётся: его держит
 * exclusion constraint на `appointments` (§19.1), а не код. Деньги целыми тиынами (ADR-008), моменты записи
 * в UTC, день и время считаются в часовом поясе филиала (AGENTS.md §13).
 *
 * Про Hospitality этот модуль не знает: у вертикалей раздельные домены (ADR-104, `ARCHITECTURE.md` §19).
 */

// ───────────── цена и длительность услуги в филиале ─────────────

/** Услуга каталога бизнеса: `beauty_services` */
export interface BeautyServiceRef {
  active: boolean;
  priceMinor: bigint;
  /** валюта каталога, ISO 4217 (Q-257) */
  currency: string;
  durationMinutes: number;
}

/** Строка филиала: `location_services`. Нет строки, значит филиал услугу не включал */
export interface LocationServiceRef {
  enabled: boolean;
  priceOverrideMinor?: bigint | null;
  durationOverrideMinutes?: number | null;
}

/** Почему услуга в филиале не продаётся */
export type ServiceUnavailable = 'SERVICE_INACTIVE' | 'NOT_ENABLED' | 'CURRENCY_MISMATCH';

export type EffectiveService =
  | {
      sellable: true;
      priceMinor: bigint;
      /** валюта филиала, когда цену задал филиал, иначе валюта каталога (они совпали) */
      currency: string;
      durationMinutes: number;
      /** цену или длительность задал филиал */
      overridden: boolean;
    }
  | { sellable: false; reason: ServiceUnavailable };

/**
 * Действующая цена и длительность услуги в филиале (§19.1, Q-257).
 *
 * Цену задал филиал, значит она в валюте филиала. Не задал, берётся цена каталога, и только если валюта
 * каталога совпала с валютой филиала: иначе это число в неизвестных деньгах, и услуга в этом филиале не
 * продаётся, пока филиал не поставит свою цену.
 */
export function effectiveService(input: {
  service: BeautyServiceRef;
  locationCurrency: string;
  locationService: LocationServiceRef | null;
}): EffectiveService {
  const { service, locationCurrency, locationService } = input;
  if (!service.active) return { sellable: false, reason: 'SERVICE_INACTIVE' };
  if (!locationService || !locationService.enabled) {
    return { sellable: false, reason: 'NOT_ENABLED' };
  }

  const priceOverride = locationService.priceOverrideMinor ?? null;
  const durationOverride = locationService.durationOverrideMinutes ?? null;
  if (priceOverride === null && service.currency !== locationCurrency) {
    return { sellable: false, reason: 'CURRENCY_MISMATCH' };
  }

  return {
    sellable: true,
    priceMinor: priceOverride ?? service.priceMinor,
    currency: priceOverride === null ? service.currency : locationCurrency,
    durationMinutes: durationOverride ?? service.durationMinutes,
    overridden: priceOverride !== null || durationOverride !== null,
  };
}

// ───────────── окно записи ─────────────

/** Конец записи от её длительности. Длительность целая и больше нуля, как требует CHECK в §19.1 */
export function appointmentWindow(
  startsAt: Date,
  durationMinutes: number,
): { startsAt: Date; endsAt: Date } {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Длительность услуги: целое число минут больше нуля');
  }
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) };
}

// ───────────── график мастера ─────────────

/**
 * Строка графика: `working_hours`. `weekday` как у `Date.getDay()`: 0 воскресенье, 1 понедельник.
 * `timeFrom` и `timeTo` в виде «ЧЧ:ММ» местного времени филиала.
 */
export interface WorkingHoursRef {
  weekday: number;
  timeFrom: string;
  timeTo: string;
}

/** Отсутствие мастера: `time_offs`, календарные даты «ГГГГ-ММ-ДД» включительно с обеих сторон */
export interface TimeOffRef {
  dateFrom: string;
  dateTo: string;
}

export type ScheduleMiss = 'OUTSIDE_WORKING_HOURS' | 'TIME_OFF';

export type ScheduleFit = { ok: true } | { ok: false; reason: ScheduleMiss };

/**
 * Запись укладывается в рабочий день мастера в этом филиале и не попадает в его отсутствие (§19.1).
 *
 * День недели и время берутся в поясе филиала: 23:30 UTC и 04:30 следующего дня в Алматы это один момент,
 * но разные дни недели, и график стоит по местным (AGENTS.md §13). Запись должна целиком лежать внутри
 * одного интервала графика: через перерыв между интервалами она не проходит.
 */
export function fitsSchedule(input: {
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  workingHours: readonly WorkingHoursRef[];
  timeOffs: readonly TimeOffRef[];
}): ScheduleFit {
  // Identity and branch assignment are checked by the existing booking/slot caller.
  const result = resolveWorkingTime({ ...input, supported: true, employeeActive: true, worksHere: true });
  return result.ok ? result : { ok: false, reason: result.reason === 'TIME_OFF' ? 'TIME_OFF' : 'OUTSIDE_WORKING_HOURS' };
}

/** Отсутствие: конец не раньше начала, как требует CHECK в §19.1 */
export function assertTimeOffRange(input: { dateFrom: string; dateTo: string }): void {
  if (input.dateTo < input.dateFrom) {
    throw new Error('Отсутствие: конец раньше начала, проверьте даты');
  }
}
