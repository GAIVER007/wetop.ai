/** Время объекта (Алматы, UTC+5) с датой: `14.09 09:10` — DESIGN.md §14 */
const fmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
export function almatyDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return fmt.format(d).replace(',', '');
}
/** Полная дата и время объекта: `14.09.2026 09:10` */
const fmtFull = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export function almatyDateTimeFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return fmtFull.format(d).replace(',', '');
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
