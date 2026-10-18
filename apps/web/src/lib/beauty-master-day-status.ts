import type { BeautyDay } from './api';

export type BeautyMasterDayStatus = {
  state: 'ON_SHIFT' | 'OFF' | 'UNAVAILABLE';
  hours: string | null;
};

export function beautyMasterDayStatus(
  day: Pick<BeautyDay, 'columns'> | null,
  employeeId: string,
): BeautyMasterDayStatus {
  if (!day) return { state: 'UNAVAILABLE', hours: null };
  const column = day.columns.find((item) => item.id === employeeId);
  if (!column || column.timeOff || column.intervals.length === 0)
    return { state: 'OFF', hours: null };
  return {
    state: 'ON_SHIFT',
    hours: column.intervals.map((interval) => `${interval.timeFrom}–${interval.timeTo}`).join(', '),
  };
}
