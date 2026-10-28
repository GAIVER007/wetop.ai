import { freeSlots } from './free-slots';

/**
 * Карта дня мастеров справа в окне «Новая запись» (решение владельца 26.10.2026, вариант C «весь фонд одной
 * картой», единый вид окна брони): строка на мастера, ячейка на 30 минут рабочего дня салона. Свободная ячейка
 * значит, что визит нужной длительности помещается с этого времени; занятая пересекается с живой записью;
 * закрытая вне смены, в прошлом или визит не успевает до конца смены. Занятость окончательно проверяет сервер.
 */
const STEP = 30;
const DEAD = new Set(['CANCELLED', 'NO_SHOW']);

export type MasterCell = { time: string; state: 'free' | 'busy' | 'closed' };
export interface MasterRow {
  id: string;
  name: string;
  timeOff: boolean;
  free: number;
  cells: MasterCell[];
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function masterDayMap(
  columns: ReadonlyArray<{
    id: string;
    name: string;
    intervals: Array<{ timeFrom: string; timeTo: string }>;
    timeOff: boolean;
    serviceIds: string[];
  }>,
  appointments: Parameters<typeof freeSlots>[1],
  durationMinutes: number,
  /** только мастера, которые делают эту услугу; пусто значит все */
  serviceId: string,
  nowMinutes?: number,
): { times: string[]; rows: MasterRow[] } {
  const masters = columns.filter((c) => !serviceId || c.serviceIds.includes(serviceId));
  const bounds = masters.flatMap((c) =>
    c.timeOff ? [] : c.intervals.map((i) => [toMinutes(i.timeFrom), toMinutes(i.timeTo)] as const),
  );
  if (bounds.length === 0)
    return {
      times: [],
      rows: masters.map((c) => ({ id: c.id, name: c.name, timeOff: c.timeOff, free: 0, cells: [] })),
    };
  const from = Math.floor(Math.min(...bounds.map(([a]) => a)) / STEP) * STEP;
  const to = Math.max(...bounds.map(([, b]) => b));
  const times: string[] = [];
  for (let m = from; m < to; m += STEP) times.push(toTime(m));
  const rows = masters.map((c) => {
    const free = new Set(freeSlots(c, appointments, durationMinutes, nowMinutes));
    const taken = appointments
      .filter((a) => !DEAD.has(a.status))
      .flatMap((a) =>
        a.items?.length
          ? a.items.filter((i) => i.employeeId === c.id)
          : a.employeeId === c.id
            ? [a]
            : [],
      );
    const cells = times.map((time): MasterCell => {
      const start = toMinutes(time);
      if (free.has(time)) return { time, state: 'free' };
      const busy = taken.some((a) => a.startMinutes < start + STEP && start < a.endMinutes);
      return { time, state: busy && !c.timeOff ? 'busy' : 'closed' };
    });
    return { id: c.id, name: c.name, timeOff: c.timeOff, free: free.size, cells };
  });
  return { times, rows };
}
