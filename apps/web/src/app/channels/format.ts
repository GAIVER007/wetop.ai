import type { PropertyClock } from '../../lib/property-time';

/** Время события по часам объекта с датой: `14.09 09:10` — DESIGN.md §14; пояс — объекта (С-13) */
export function eventTime(iso: string | null | undefined, clock: PropertyClock): string {
  if (!iso) return '—';
  if (!Number.isFinite(Date.parse(iso))) return iso;
  return clock.moment(iso);
}
/** Полная дата и время события по часам объекта: `14.09.2026 09:10` */
export function eventTimeFull(iso: string | null | undefined, clock: PropertyClock): string {
  if (!iso) return '—';
  if (!Number.isFinite(Date.parse(iso))) return iso;
  return clock.full(iso);
}
export const EVENT_STATUS_RU: Record<string, string> = {
  PROCESSED: 'обработано',
  FAILED: 'ошибка',
  RECEIVED: 'получено',
  PROCESSING: 'в работе',
};
export const EVENT_STATUS_TONE: Record<string, 'ok' | 'danger' | 'info'> = {
  PROCESSED: 'ok',
  FAILED: 'danger',
  RECEIVED: 'info',
  PROCESSING: 'info',
};
export const VIA_RU: Record<string, string> = {
  WEBHOOK: 'webhook',
  PULL: 'опрос ленты',
  MANUAL: 'вручную',
};
export const EVENT_TYPE_RU: Record<string, string> = {
  booking_new: 'новая бронь',
  booking_modification: 'изменение',
  booking_cancellation: 'отмена',
};

/** Сверка давнее суток с запасом: сторож сверяет раз в сутки, после 36 часов это уже повод посмотреть */
export const RECONCILE_STALE_MS = 36 * 3_600_000;

export interface ReconciliationView {
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  value: string;
  sub: string;
}

/**
 * «Сверка с каналом» на обзоре (X3, ADR-144): ежедневная сверка остатков PMS с тем, что видит канал, словами.
 * Расхождение важнее давности; без данных API — «нет данных», не «всё хорошо».
 */
export function reconciliationView(
  r:
    | { lastCheckedAt: string | null; mismatch: { since: string; nights: number | null } | null }
    | null
    | undefined,
  clock: PropertyClock,
  now: number = Date.now(),
): ReconciliationView {
  if (!r) return { tone: 'muted', value: 'нет данных', sub: 'обновите страницу' };
  if (r.mismatch) {
    const nights = r.mismatch.nights;
    return {
      tone: 'danger',
      value: nights ? `расхождение: ${nights} ${nightsWord(nights)}` : 'есть расхождение',
      sub: `канал видит больше мест, чем есть, с ${eventTime(r.mismatch.since, clock)}; сторож запустил полную выгрузку`,
    };
  }
  if (!r.lastCheckedAt)
    return { tone: 'muted', value: 'ещё не было', sub: 'сверка идёт раз в сутки' };
  const stale = now - Date.parse(r.lastCheckedAt) > RECONCILE_STALE_MS;
  return stale
    ? {
        tone: 'warn',
        value: 'давно не было',
        sub: `последняя ${eventTime(r.lastCheckedAt, clock)}`,
      }
    : {
        tone: 'ok',
        value: 'расхождений нет',
        sub: `проверено ${eventTime(r.lastCheckedAt, clock)}`,
      };
}

function nightsWord(n: number): string {
  const tail = n % 10;
  const hundred = n % 100;
  if (tail === 1 && hundred !== 11) return 'ночь';
  if (tail >= 2 && tail <= 4 && (hundred < 12 || hundred > 14)) return 'ночи';
  return 'ночей';
}
