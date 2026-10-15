import { describe, expect, it } from 'vitest';
import type { NightRate, StayRestriction } from '../reservations/reservations';
import { FROM_PRICE_WINDOW_NIGHTS, fromPriceMinor, fromPriceWindow } from './from-price';

/**
 * Q-276 (решение владельца 07.10.2026): цена «от» без дат. Тариф брони сайта, окно сегодня + 29 ночей, минимальная цена
 * одной ночи при полной вместимости категории; ночь со стоп-продажей не участвует; окно продаж производного тарифа
 * применяется к ночи как к дате заезда, минимум ночей нет. Это подсказка тарифа, а не обещание мест.
 */
const TODAY = '2026-10-07';
const day = (n: number) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const rate = (n: number, priceMinor: bigint, occupancy = 2): NightRate => ({ date: day(n), occupancy, priceMinor });
const stop = (n: number): StayRestriction => ({
  date: day(n),
  minStay: null,
  maxStay: null,
  stopSell: true,
  closedToArrival: false,
  closedToDeparture: false,
});
const base = { today: TODAY, capacityAdults: 2, restrictions: [] as StayRestriction[], derived: null };

describe('окно цены «от»', () => {
  it('30 ночей: сегодня и ещё 29, выезд последней ночи на 30-й день', () => {
    expect(FROM_PRICE_WINDOW_NIGHTS).toBe(30);
    expect(fromPriceWindow(TODAY)).toEqual({ from: '2026-10-07', to: '2026-11-05', toExclusive: '2026-11-06' });
  });
});

describe('fromPriceMinor', () => {
  it('минимум одной ночи в окне', () => {
    const rates = [rate(0, 30_000_00n), rate(5, 25_000_00n), rate(29, 27_000_00n)];
    expect(fromPriceMinor({ ...base, rates })).toBe(25_000_00n);
  });

  it('ночь 31 (за окном) и вчерашняя ночь не влияют', () => {
    const rates = [rate(-1, 1_000_00n), rate(0, 30_000_00n), rate(30, 1_000_00n)];
    expect(fromPriceMinor({ ...base, rates })).toBe(30_000_00n);
  });

  it('вместимость: цена при полной вместимости категории, дешёвая цена «за одного» не берётся', () => {
    const rates = [rate(0, 30_000_00n, 2), rate(0, 18_000_00n, 1)];
    expect(fromPriceMinor({ ...base, rates })).toBe(30_000_00n);
    expect(fromPriceMinor({ ...base, capacityAdults: 1, rates })).toBe(18_000_00n);
  });

  it('стоп-продажа исключает ночь', () => {
    const rates = [rate(0, 20_000_00n), rate(1, 26_000_00n)];
    expect(fromPriceMinor({ ...base, rates, restrictions: [stop(0)] })).toBe(26_000_00n);
  });

  it('все ночи со стоп-продажей или без цены: цены нет', () => {
    expect(fromPriceMinor({ ...base, rates: [rate(0, 20_000_00n)], restrictions: [stop(0)] })).toBeNull();
    expect(fromPriceMinor({ ...base, rates: [] })).toBeNull();
  });

  it('прочие ограничения (минимум ночей, закрыт заезд) цену ночи не прячут', () => {
    const restrictions: StayRestriction[] = [
      { date: day(0), minStay: 7, maxStay: null, stopSell: false, closedToArrival: true, closedToDeparture: true },
    ];
    expect(fromPriceMinor({ ...base, rates: [rate(0, 20_000_00n)], restrictions })).toBe(20_000_00n);
  });

  it('производный тариф: окно продаж к ночи как к дате заезда, минимум ночей не применяется', () => {
    const rates = [rate(0, 10_000_00n), rate(3, 20_000_00n), rate(20, 22_000_00n)];
    const derived = {
      planName: 'Раннее бронирование',
      rule: { discountPercent: 10, minDaysBeforeArrival: 3, maxDaysBeforeArrival: 10, minNights: 5 },
    };
    // ночь 0: до заезда 0 дней < 3; ночь 20: 20 > 10; остаётся ночь 3
    expect(fromPriceMinor({ ...base, rates, derived })).toBe(20_000_00n);
  });
});
