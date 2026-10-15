import { expect, it } from 'vitest';
import { soldDeparture } from './sold-period';

it('завершённое проживание удерживает только сохранённые ночи, не дольше планового выезда', () => {
  expect(
    soldDeparture({
      status: 'CHECKED_OUT',
      departureDate: '2026-10-08',
      allocationEndDates: ['2026-10-03', '2026-10-05'],
    }),
  ).toBe('2026-10-05');
  expect(
    soldDeparture({
      status: 'CHECKED_OUT',
      departureDate: '2026-10-08',
      allocationEndDates: ['2026-10-10'],
    }),
  ).toBe('2026-10-08');
});

it('неразмещённая подтверждённая бронь удерживает категорию; отмена и незаезд не удерживают', () => {
  expect(
    soldDeparture({ status: 'CONFIRMED', departureDate: '2026-10-08', allocationEndDates: [] }),
  ).toBe('2026-10-08');
  for (const status of ['CANCELLED', 'NO_SHOW']) {
    expect(
      soldDeparture({ status, departureDate: '2026-10-08', allocationEndDates: ['2026-10-08'] }),
    ).toBeNull();
  }
});
