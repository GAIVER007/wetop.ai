import { describe, expect, it } from 'vitest';
import { masterDayMap } from './master-map';

const columns = [
  { id: 'a', name: 'Алия', intervals: [{ timeFrom: '09:00', timeTo: '12:00' }], timeOff: false, serviceIds: ['cut'] },
  { id: 'd', name: 'Дина', intervals: [{ timeFrom: '10:00', timeTo: '13:00' }], timeOff: false, serviceIds: ['nails'] },
  { id: 'm', name: 'Мария', intervals: [{ timeFrom: '09:00', timeTo: '13:00' }], timeOff: true, serviceIds: ['cut'] },
];
const appointments = [{ employeeId: 'a', startMinutes: 600, endMinutes: 660, status: 'BOOKED' }];

describe('masterDayMap: карта дня мастеров в окне записи (решение 26.10.2026)', () => {
  it('шкала от раннего начала до позднего конца смен, шаг 30 минут', () => {
    const { times } = masterDayMap(columns, appointments, 60, '');
    expect(times[0]).toBe('09:00');
    expect(times.at(-1)).toBe('12:30');
    expect(times).toHaveLength(8);
  });
  it('свободно там, где визит помещается целиком; занято по записи; вне смены закрыто', () => {
    const row = masterDayMap(columns, appointments, 60, '').rows.find((r) => r.id === 'a')!;
    const at = (t: string) => row.cells.find((c) => c.time === t)!.state;
    expect(at('09:00')).toBe('free');
    // 09:30 само не занято, но часовой визит упрётся в запись 10:00: нажать нельзя
    expect(at('09:30')).toBe('closed');
    expect(at('10:00')).toBe('busy');
    expect(at('10:30')).toBe('busy');
    expect(at('11:00')).toBe('free');
    expect(at('11:30')).toBe('closed');
    expect(at('12:00')).toBe('closed');
    expect(row.free).toBe(2);
  });
  it('выбрана услуга: только мастера, которые её делают; выходной без свободных ячеек', () => {
    const { rows } = masterDayMap(columns, appointments, 30, 'cut');
    expect(rows.map((r) => r.id)).toEqual(['a', 'm']);
    const off = rows.find((r) => r.id === 'm')!;
    expect(off.timeOff).toBe(true);
    expect(off.cells.every((c) => c.state === 'closed')).toBe(true);
  });
  it('прошедшее время сегодня закрыто', () => {
    const row = masterDayMap(columns, [], 30, '', 10 * 60).rows.find((r) => r.id === 'a')!;
    expect(row.cells.find((c) => c.time === '09:30')!.state).toBe('closed');
    expect(row.cells.find((c) => c.time === '10:00')!.state).toBe('free');
  });
});
