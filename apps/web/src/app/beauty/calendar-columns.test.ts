import { describe, expect, it } from 'vitest';
import { mobileDefaultMaster } from './calendar-columns';

const col = (id: string, intervals: Array<{ timeFrom: string; timeTo: string }> = [], timeOff = false) => ({
  id,
  name: id,
  intervals,
  timeOff,
  timeOffReason: null,
  serviceIds: [],
});

/** Живой сайт 21.10.2026, телефон: «Все специалисты», первым шёл мастер с выходным, а запись была у третьего и не видна */
describe('мастер журнала на телефоне без выбора', () => {
  it('первый мастер, у которого есть записи дня', () => {
    const columns = [col('a'), col('b', [{ timeFrom: '10:00', timeTo: '19:00' }]), col('c', [{ timeFrom: '10:00', timeTo: '19:00' }])];
    expect(mobileDefaultMaster(columns, [{ employeeId: 'c', status: 'BOOKED' }])).toBe('c');
  });
  it('без записей: первый, кто работает в этот день', () => {
    const columns = [col('a'), col('b', [], true), col('c', [{ timeFrom: '10:00', timeTo: '19:00' }])];
    expect(mobileDefaultMaster(columns, [])).toBe('c');
  });
  it('отменённые записи не в счёт', () => {
    const columns = [col('a', [{ timeFrom: '10:00', timeTo: '19:00' }]), col('b')];
    expect(mobileDefaultMaster(columns, [{ employeeId: 'b', status: 'CANCELLED' }])).toBe('a');
  });
  it('никто не работает: первый по списку, пусто без мастеров', () => {
    expect(mobileDefaultMaster([col('a'), col('b')], [])).toBe('a');
    expect(mobileDefaultMaster([], [])).toBe('');
  });
});
