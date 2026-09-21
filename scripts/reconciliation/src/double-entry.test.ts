import { describe, expect, it } from 'vitest';
import { compareDay, exelyDeparture, type ExelyStay, type PmsStay } from './double-entry';

const DATE = '2026-09-20';

const ex = (p: Partial<ExelyStay> = {}): ExelyStay => ({
  bookingNumber: 'EX-1',
  roomTypeId: 'type-male',
  checkIn: '2026-09-19',
  checkOut: '2026-09-22',
  actualCheckOut: null,
  status: 'New',
  bookingStatus: 'Confirmed',
  ...p,
});

const pms = (p: Partial<PmsStay> = {}): PmsStay => ({
  number: 'EX-1',
  categoryKey: 'type-male',
  categoryName: 'Мужская общая',
  arrival: '2026-09-19',
  departure: '2026-09-22',
  status: 'CONFIRMED',
  fromExely: true,
  hasUnit: true,
  ...p,
});

describe('двойной ввод: сравнение суток', () => {
  it('одна и та же бронь в обеих системах — сутки сходятся', () => {
    const r = compareDay(DATE, [ex()], [pms()]);
    expect(r.ok).toBe(true);
    expect(r.pms.occupied).toBe(1);
    expect(r.exely.occupied).toBe(1);
  });

  it('две встречные ошибки не дают ноль: бронь только в PMS и бронь только в Exely названы', () => {
    // Числа сходятся: по одной занятой ночи с каждой стороны — но это разные брони
    const r = compareDay(
      DATE,
      [ex({ bookingNumber: 'EX-2' })],
      [pms({ number: 'WEB-7', fromExely: false })],
    );
    expect(r.pms.occupied).toBe(r.exely.occupied);
    expect(r.ok).toBe(false);
    expect(r.onlyPms.map((p) => p.number)).toEqual(['WEB-7']);
    expect(r.onlyPms[0]?.why).toContain('заведена в PMS');
    expect(r.onlyExely).toEqual(['EX-2']);
  });

  it('ранний выезд считается по фактической дате с обеих сторон', () => {
    // Плановый выезд 22-го, гость выехал 20-го: на ночь 20-го бронь уже не занимает место
    const stay = ex({ status: 'CheckedOut', actualCheckOut: '2026-09-20' });
    expect(exelyDeparture(stay)).toBe('2026-09-20');
    const r = compareDay(DATE, [stay], [pms({ departure: '2026-09-20', status: 'CHECKED_OUT' })]);
    expect(r.exely.occupied).toBe(0);
    expect(r.exely.departures).toBe(1);
    expect(r.ok).toBe(true);
  });

  it('незаезд назван, а не выброшен молча', () => {
    const r = compareDay(DATE, [ex()], [pms({ status: 'NO_SHOW' })]);
    expect(r.ok).toBe(false);
    expect(r.noShow.map((p) => p.number)).toEqual(['EX-1']);
    expect(r.pms.occupied).toBe(0);
  });

  it('проживание без ячейки — расхождение, даже когда числа сходятся', () => {
    const r = compareDay(DATE, [ex()], [pms({ hasUnit: false })]);
    expect(r.ok).toBe(false);
    expect(r.cellsOnGrid).toBe(0);
    expect(r.withoutUnit).toHaveLength(1);
  });

  it('отменённые брони Exely в счёт не идут', () => {
    const r = compareDay(
      DATE,
      [ex(), ex({ bookingNumber: 'EX-9', bookingStatus: 'Cancelled' })],
      [pms()],
    );
    expect(r.exely.occupied).toBe(1);
    expect(r.ok).toBe(true);
  });

  it('категории сравниваются по отдельности', () => {
    const r = compareDay(
      DATE,
      [ex({ roomTypeId: 'type-female' })],
      [pms({ categoryKey: 'type-male' })],
    );
    expect(r.ok).toBe(false);
    expect(r.pms.byCategory['type-male']).toBe(1);
    expect(r.exely.byCategory['type-female']).toBe(1);
  });
});
