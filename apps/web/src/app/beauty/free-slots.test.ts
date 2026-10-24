import { describe, expect, it } from 'vitest';
import { freeSlots } from './free-slots';

const column = {
  id: 'm1',
  intervals: [{ timeFrom: '10:00', timeTo: '13:00' }],
  timeOff: false,
};
const busy = (start: number, end: number, status = 'BOOKED') => ({
  employeeId: 'm1',
  startMinutes: start,
  endMinutes: end,
  status,
});

describe('freeSlots: свободное время мастера справа в окне записи (решение 23.10.2026)', () => {
  it('шаг 30 минут внутри смены, услуга целиком помещается до конца смены', () => {
    expect(freeSlots(column, [], 60)).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00']);
  });
  it('занятое время и пересечения убраны, отменённые записи время не держат', () => {
    const out = freeSlots(column, [busy(660, 720), busy(600, 630, 'CANCELLED')], 60);
    expect(out).toEqual(['10:00', '12:00']);
  });
  it('строки многоуслужной записи у этого мастера тоже занимают время', () => {
    const out = freeSlots(
      column,
      [
        {
          employeeId: 'other',
          startMinutes: 600,
          endMinutes: 720,
          status: 'BOOKED',
          items: [{ employeeId: 'm1', startMinutes: 630, endMinutes: 690 }],
        },
      ],
      30,
    );
    expect(out).toEqual(['10:00', '11:30', '12:00', '12:30']);
  });
  it('выходной: времени нет', () => {
    expect(freeSlots({ ...column, timeOff: true }, [], 30)).toEqual([]);
  });
  it('прошедшее время сегодня не предлагается', () => {
    expect(freeSlots(column, [], 30, 11 * 60 + 5)).toEqual(['11:30', '12:00', '12:30']);
  });
});
