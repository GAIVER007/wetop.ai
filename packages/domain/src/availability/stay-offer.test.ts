import { describe, expect, it } from 'vitest';
import type { NightRate, StayRestriction } from '../reservations/reservations';
import { stayOffer, type PlanForStay } from './stay-offer';

/** Правило «от» на экране «Свободные места» — закрытый Q-204 (ADR-110). Вымышленные тарифы и цены. */
const nights = ['2026-10-01', '2026-10-02', '2026-10-03'];
const rates = (occupancy: number, prices: number[]): NightRate[] =>
  nights.map((date, i) => ({ date, occupancy, priceMinor: BigInt(prices[i]!) }));
const plan = (code: string, r: NightRate[], restrictions: StayRestriction[] = []): PlanForStay => ({
  code,
  currency: 'KZT',
  rates: r,
  restrictions,
});
const restriction = (date: string, patch: Partial<StayRestriction>): StayRestriction => ({
  date,
  minStay: null,
  maxStay: null,
  stopSell: false,
  closedToArrival: false,
  closedToDeparture: false,
  ...patch,
});
const stay = {
  arrivalDate: '2026-10-01',
  departureDate: '2026-10-04',
  categoryName: 'Тестовая категория',
  currency: 'KZT',
};

describe('stayOffer — цена «от» (Q-204)', () => {
  it('номер: полная стоимость по самому дешёвому допустимому тарифу, число тарифов и цена ночи', () => {
    const offer = stayOffer({
      ...stay,
      occupancy: 2,
      units: 1,
      plans: [
        plan('A', rates(2, [3_200_000, 3_200_000, 3_200_000])),
        plan('B', rates(2, [2_500_000, 2_500_000, 2_500_000])),
        plan('C', rates(2, [2_600_000, 2_400_000, 2_600_000])),
      ],
    });
    expect(offer).toEqual({
      plans: 3,
      totalMinor: 7_500_000n,
      perNightMinor: 2_400_000n,
      ratePlanCode: 'B',
      currency: 'KZT',
    });
  });

  it('койки: итог — на всех гостей запроса, цена ночи — за одну койку', () => {
    const offer = stayOffer({
      ...stay,
      occupancy: 1,
      units: 2,
      plans: [plan('BED', rates(1, [800_000, 800_000, 800_000]))],
    });
    expect(offer).toMatchObject({ plans: 1, totalMinor: 4_800_000n, perNightMinor: 800_000n });
  });

  it('тариф с дырой хотя бы на одной ночи в «от» не участвует', () => {
    const holed = rates(2, [100, 100, 100]).slice(0, 2);
    const offer = stayOffer({
      ...stay,
      occupancy: 2,
      units: 1,
      plans: [plan('HOLE', holed), plan('FULL', rates(2, [500, 500, 500]))],
    });
    expect(offer).toMatchObject({ plans: 1, totalMinor: 1_500n, ratePlanCode: 'FULL' });
  });

  it('цена считается для требуемой occupancy: цена на одного гостя не подставляется за двоих', () => {
    const offer = stayOffer({
      ...stay,
      occupancy: 2,
      units: 1,
      plans: [plan('SINGLE', rates(1, [100, 100, 100]))],
    });
    expect(offer).toBeNull();
  });

  it('тариф, которому ограничения запрещают это проживание, в «от» не участвует', () => {
    const cheap = rates(2, [100, 100, 100]);
    const offer = stayOffer({
      ...stay,
      occupancy: 2,
      units: 1,
      plans: [
        plan('STOP', cheap, [restriction('2026-10-02', { stopSell: true })]),
        plan('CTA', cheap, [restriction('2026-10-01', { closedToArrival: true })]),
        plan('MIN', cheap, [restriction('2026-10-01', { minStay: 5 })]),
        plan('CTD', cheap, [restriction('2026-10-04', { closedToDeparture: true })]),
        plan('OK', rates(2, [900, 900, 900])),
      ],
    });
    expect(offer).toMatchObject({ plans: 1, totalMinor: 2_700n, ratePlanCode: 'OK' });
  });

  it('тариф в другой валюте с ценами объекта не сравнивается', () => {
    const offer = stayOffer({
      ...stay,
      occupancy: 2,
      units: 1,
      plans: [
        { ...plan('USD', rates(2, [1, 1, 1])), currency: 'USD' },
        plan('KZT', rates(2, [900, 900, 900])),
      ],
    });
    expect(offer).toMatchObject({ plans: 1, ratePlanCode: 'KZT' });
  });

  it('ни один тариф не прошёл — цены нет', () => {
    expect(stayOffer({ ...stay, occupancy: 2, units: 1, plans: [] })).toBeNull();
  });
});
