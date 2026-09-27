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
