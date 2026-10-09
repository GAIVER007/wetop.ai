import { describe, expect, it } from 'vitest';
import { classifyOccupancy, computeTrend } from './inventory-insight';

/** Вымышленный фонд: 3 места, события и блокировки расставлены вокруг даты 2026-10-09 */
const units = [
  { code: 'A1', kind: 'ROOM' as const, createdAt: '2026-01-01', housekeepingStatus: 'CLEAN' as const },
  { code: 'A2', kind: 'ROOM' as const, createdAt: '2026-10-05', housekeepingStatus: 'DIRTY' as const },
  { code: 'B1', kind: 'BED' as const, createdAt: '2026-01-01', housekeepingStatus: 'DIRTY' as const },
];

describe('computeTrend', () => {
  const base = {
    today: '2026-10-09',
    days: 7,
    units,
    blocks: [{ code: 'A1', dateFrom: '2026-10-08', dateTo: '2026-10-12' }],
    // B1 стал грязным 5 октября; до этого был чистым
    hkEvents: [{ code: 'B1', at: '2026-10-05T10:00:00Z', from: 'CLEAN' as const, to: 'DIRTY' as const }],
  };

  it('сравнивает «сейчас» со значением на начало периода', () => {
    const t = computeTrend(base);
    expect(t.from).toBe('2026-10-02');
    expect(t.metrics.totalUnits).toMatchObject({ now: 3, before: 2, delta: 1, percent: 50 });
    expect(t.metrics.rooms).toMatchObject({ now: 2, before: 1, delta: 1, percent: 100 });
    expect(t.metrics.beds).toMatchObject({ now: 1, before: 1, delta: 0, percent: 0 });
  });

  it('недоступно считается по пересечению блокировок с датой', () => {
    const t = computeTrend(base);
    expect(t.metrics.unavailable).toMatchObject({ now: 1, before: 0, delta: 1, percent: null });
    expect(t.metrics.onSale).toMatchObject({ now: 2, before: 2, delta: 0 });
  });

  it('уборка на прошлую дату восстанавливается из журнала смен статуса', () => {
    const t = computeTrend(base);
    // сейчас грязные A2 и B1; два октября A2 не было, B1 был чистым
    expect(t.metrics.needsCleaning).toMatchObject({ now: 2, before: 0 });
  });

  it('процент от нуля не выдумывается', () => {
    expect(computeTrend(base).metrics.needsCleaning.percent).toBeNull();
  });
});

describe('classifyOccupancy', () => {
  const stay = (over: object) => ({
    confirmationNumber: 'C1',
    startDate: '2026-10-09',
    endDate: '2026-10-11',
    status: 'CONFIRMED',
    guest: 'Иванов А.',
    ...over,
  });
  it('заезд сегодня', () => {
    expect(classifyOccupancy('2026-10-09', [stay({})])).toMatchObject({ state: 'ARRIVING' });
  });
  it('проживает: уже заехал и выезд позже', () => {
    expect(
      classifyOccupancy('2026-10-09', [stay({ startDate: '2026-10-07', status: 'CHECKED_IN' })]),
    ).toMatchObject({ state: 'STAYING', guest: 'Иванов А.' });
  });
  it('выезд сегодня не занимает ночь', () => {
    expect(
      classifyOccupancy('2026-10-09', [stay({ startDate: '2026-10-07', endDate: '2026-10-09' })]),
    ).toMatchObject({ state: 'FREE' });
  });
  it('отменённая бронь игнорируется', () => {
    expect(classifyOccupancy('2026-10-09', [stay({ status: 'CANCELLED' })])).toMatchObject({
      state: 'FREE',
    });
  });
});
