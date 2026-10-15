import { describe, expect, it } from 'vitest';
import { occupancyByKind } from './occupancy-kinds';

const cat = (
  kind: 'ROOM' | 'BED',
  unitNights: number,
  occupiedNights: number,
  blockedNights: number,
) => ({ kind, unitNights, occupiedNights, blockedNights }) as never;

describe('загрузка номеров и коек раздельно (ADR-155, Q-287)', () => {
  it('номера и койки считаются каждый в своём знаменателе, закрытые ночи вычтены', () => {
    const r = occupancyByKind([
      cat('ROOM', 40, 20, 0),
      cat('ROOM', 20, 10, 0),
      cat('BED', 100, 40, 20),
    ]);
    expect(r.rooms).toMatchObject({
      unitNights: 60,
      occupiedNights: 30,
      sellableNights: 60,
      percent: 50,
    });
    expect(r.beds).toMatchObject({
      unitNights: 100,
      occupiedNights: 40,
      blockedNights: 20,
      sellableNights: 80,
      percent: 50,
    });
  });

  it('нет коек: койки отсутствуют, а не ноль процентов', () => {
    const r = occupancyByKind([cat('ROOM', 10, 5, 0)]);
    expect(r.beds).toBeNull();
    expect(r.rooms?.percent).toBe(50);
  });

  it('всё закрыто: процент 0, без деления на ноль', () => {
    expect(occupancyByKind([cat('BED', 10, 0, 10)]).beds?.percent).toBe(0);
  });

  it('целая арифметика: 2 из 3 ночей это 66,7', () => {
    expect(occupancyByKind([cat('ROOM', 3, 2, 0)]).rooms?.percent).toBe(66.7);
  });
});
