/**
 * Пометка в колонке «Размещение» списка броней, когда номер назначен не на все места (аудит 22.10.2026 P1-13).
 * Будущей брони номер можно назначить позже, это не тревога; выехавшей, отменённой и незаезду номер уже не нужен.
 * Тревога остаётся там, где гость заезжает сегодня (или уже должен был) и ему некуда заселиться.
 */
const DONE = new Set(['CHECKED_OUT', 'CANCELLED', 'NO_SHOW']);

export function placementNote(
  r: { status: string; arrivalDate: string; unitCodes: string[]; itemsCount?: number | null },
  today: string,
): { text: string; warn: boolean } | null {
  const itemsCount = r.itemsCount ?? (r.unitCodes.length || 1);
  const missing = itemsCount - r.unitCodes.length;
  if (missing <= 0 || DONE.has(r.status)) return null;
  if (itemsCount > 1) return { text: `⚠ ${missing} без размещения`, warn: true };
  if (r.arrivalDate > today) return { text: 'Номер назначим позже', warn: false };
  return { text: '⚠ без номера', warn: true };
}
