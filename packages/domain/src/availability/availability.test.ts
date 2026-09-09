import { describe, expect, it } from 'vitest';
import type { ChessboardInput } from '../chessboard/index';
import { availableUnitsForStay } from './index';

/** Вымышленный фонд: 2 койки dorm и 1 номер. */
const base: Omit<ChessboardInput, 'from' | 'to'> = {
  units: [
    {
      id: 'u1',
      code: '9001',
      kind: 'ROOM',
      accommodationTypeCode: 'exely-900001',
      accommodationTypeName: 'Тестовая одиночная',
    },
    {
      id: 'u2',
      code: '9010',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Тестовый dorm',
    },
    {
      id: 'u3',
      code: '9011',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Тестовый dorm',
    },
  ],
  allocations: [
    {
      unitId: 'u2',
      startDate: '2026-09-11',
      endDate: '2026-09-13',
      itemId: 'i1',
      itemStatus: 'CONFIRMED',
      confirmationNumber: 'A',
      guestLabel: '',
    },
  ],
  blocks: [{ unitId: 'u3', dateFrom: '2026-09-12', dateTo: '2026-09-13', type: 'MAINTENANCE' }],
};

describe('availableUnitsForStay (заезд from, выезд to — ночи [from, to))', () => {
  it('a unit must be free on every night of the stay', () => {
    // 10→12: u2 занята 11 → недоступна; u3 свободна 10,11 → доступна; u1 свободна
    const r = availableUnitsForStay({
      ...base,
      arrivalDate: '2026-09-10',
      departureDate: '2026-09-12',
    });
    expect(r.byCategory['exely-900003']).toEqual({
      units: 2,
      available: 1,
      availableUnitCodes: ['9011'],
    });
    expect(r.byCategory['exely-900001']).toEqual({
      units: 1,
      available: 1,
      availableUnitCodes: ['9001'],
    });
    expect(r.total).toEqual({ units: 3, available: 2 });
  });
  it('a block on any night removes the unit; departure night is free', () => {
    // 12→13: u3 блок 12 → нет; u2 занята 12 → нет; u1 да
    expect(
      availableUnitsForStay({ ...base, arrivalDate: '2026-09-12', departureDate: '2026-09-13' })
        .byCategory['exely-900003']!.available,
    ).toBe(0);
    // 13→14: u2 освободилась (выезд 13), u3 свободна → 2
    expect(
      availableUnitsForStay({ ...base, arrivalDate: '2026-09-13', departureDate: '2026-09-14' })
        .byCategory['exely-900003']!.available,
    ).toBe(2);
  });
  it('rejects a zero-night or reversed stay', () => {
    expect(() =>
      availableUnitsForStay({ ...base, arrivalDate: '2026-09-12', departureDate: '2026-09-12' }),
    ).toThrow(/ночь/);
  });
});
