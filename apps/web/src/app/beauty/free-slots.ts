/**
 * Свободное время мастера справа в окне «Новая запись» (решение владельца 23.10.2026, окно брони вариант B):
 * начало каждые 30 минут внутри смены, услуга целиком до конца смены, без пересечения с живыми записями
 * мастера (и строками многоуслужных записей). Окончательно занятость проверяет сервер при сохранении.
 */
const STEP = 30;
const DEAD = new Set(['CANCELLED', 'NO_SHOW']);

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function freeSlots(
  column: {
    id: string;
    intervals: Array<{ timeFrom: string; timeTo: string }>;
    timeOff: boolean;
  },
  appointments: ReadonlyArray<{
    employeeId: string;
    startMinutes: number;
    endMinutes: number;
    status: string;
    items?: ReadonlyArray<{ employeeId: string; startMinutes: number; endMinutes: number }>;
  }>,
  durationMinutes: number,
  /** «сейчас» в минутах филиала, если выбран сегодняшний день */
  nowMinutes?: number,
): string[] {
  if (column.timeOff || durationMinutes <= 0) return [];
  const taken = appointments
    .filter((a) => !DEAD.has(a.status))
    .flatMap((a) =>
      a.items?.length
        ? a.items.filter((i) => i.employeeId === column.id)
        : a.employeeId === column.id
          ? [a]
          : [],
    );
  const out: string[] = [];
  for (const interval of column.intervals) {
    const from = toMinutes(interval.timeFrom);
    const to = toMinutes(interval.timeTo);
    for (let start = Math.ceil(from / STEP) * STEP; start + durationMinutes <= to; start += STEP) {
      if (nowMinutes !== undefined && start < nowMinutes) continue;
      const end = start + durationMinutes;
      if (taken.some((t) => t.startMinutes < end && start < t.endMinutes)) continue;
      out.push(toTime(start));
    }
  }
  return out;
}
