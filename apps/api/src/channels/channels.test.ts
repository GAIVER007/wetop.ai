import { describe, expect, it } from 'vitest';
import {
  buildAvailabilityValues,
  buildRestrictionValues,
  compressRuns,
  freeUnitsPerNight,
  lastPricedDate,
  type LocalDailyRate,
} from './ari';
import { buildChannexSetup } from './setup-plan';

const property = {
  name: 'Тестовый хостел',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  country: 'KZ',
  city: 'Алматы',
  address: null,
  email: null,
  phone: null,
};
const categories = [
  {
    id: 't1',
    code: 'exely-900001',
    name: 'Тестовая одиночная',
    kind: 'PRIVATE_ROOM' as const,
    capacityAdults: 1,
    units: 1,
  },
  {
    id: 't2',
    code: 'exely-900002',
    name: 'Тестовая двойная',
    kind: 'PRIVATE_ROOM' as const,
    capacityAdults: 2,
    units: 1,
  },
  {
    id: 't3',
    code: 'exely-900003',
    name: 'Тестовый dorm',
    kind: 'DORM_BED' as const,
    capacityAdults: 1,
    units: 36,
  },
];
const ratePlan = { id: 'p2', code: 'exely-800002', name: 'Тестовый для ОТА +35%', currency: 'KZT' };

describe('buildChannexSetup', () => {
  it('maps categories to room types (dorm → room_kind dorm, capacity 18) and one manual per_room rate plan each', () => {
    const plan = buildChannexSetup({ property, categories, ratePlan });
    expect(plan.property).toMatchObject({
      title: 'Тестовый хостел',
      currency: 'KZT',
      timezone: 'Asia/Almaty',
      country: 'KZ',
      property_type: 'hostel',
    });
    expect(
      plan.roomTypes.map((r) => [
        r.attrs.title,
        r.attrs.count_of_rooms,
        r.attrs.occ_adults,
        r.attrs.room_kind,
        r.attrs.capacity,
      ]),
    ).toEqual([
      ['Тестовая одиночная', 1, 1, 'room', null],
      ['Тестовая двойная', 1, 2, 'room', null],
      ['Тестовый dorm', 36, 1, 'dorm', 18],
    ]);
    expect(plan.ratePlans[1]).toMatchObject({
      localCategoryId: 't2',
      localRatePlanId: 'p2',
      attrs: {
        title: 'Тестовый для ОТА +35% — Тестовая двойная',
        sell_mode: 'per_room',
        rate_mode: 'manual',
        currency: 'KZT',
        options: [{ occupancy: 2, is_primary: true }],
      },
    });
  });
  it('refuses a tariff in another currency than the property', () => {
    expect(() =>
      buildChannexSetup({ property, categories, ratePlan: { ...ratePlan, currency: 'USD' } }),
    ).toThrow(/USD/);
  });
});

describe('ARI values', () => {
  const units = [
    {
      id: 'u1',
      code: '9001',
      kind: 'ROOM' as const,
      accommodationTypeCode: 'exely-900001',
      accommodationTypeName: 'Одиночная',
    },
    {
      id: 'u2',
      code: '9010',
      kind: 'BED' as const,
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Dorm',
    },
    {
      id: 'u3',
      code: '9011',
      kind: 'BED' as const,
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Dorm',
    },
  ];
  it('compressRuns merges consecutive equal days and breaks on gaps', () => {
    const runs = compressRuns(
      ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
      (d) => (d === '2026-10-03' ? null : d < '2026-10-03' ? 5 : 7),
      String,
    );
    expect(runs).toEqual([
      { from: '2026-10-01', to: '2026-10-02', value: 5 },
      { from: '2026-10-04', to: '2026-10-04', value: 7 },
    ]);
  });
  it('availability = active units − allocated − blocked per night, per room type, as date ranges', () => {
    const free = freeUnitsPerNight({
      from: '2026-10-01',
      to: '2026-10-05',
      units,
      allocations: [
        {
          unitId: 'u2',
          startDate: '2026-10-02',
          endDate: '2026-10-04',
          itemId: 'i1',
          itemStatus: 'CONFIRMED',
          confirmationNumber: 'B',
          guestLabel: 'Гость',
        },
      ],
      blocks: [
        {
          unitId: 'u3',
          dateFrom: '2026-10-05',
          dateTo: '2026-10-06',
          type: 'MAINTENANCE',
          reason: null,
        },
      ],
    });
    const values = buildAvailabilityValues({
      propertyId: 'P',
      from: '2026-10-01',
      to: '2026-10-05',
      roomTypes: [
        { localCategoryCode: 'exely-900001', providerRoomTypeId: 'R1' },
        { localCategoryCode: 'exely-900003', providerRoomTypeId: 'R3' },
      ],
      free,
    });
    expect(values).toEqual([
      {
        property_id: 'P',
        room_type_id: 'R1',
        date_from: '2026-10-01',
        date_to: '2026-10-05',
        availability: 1,
      },
      {
        property_id: 'P',
        room_type_id: 'R3',
        date_from: '2026-10-01',
        date_to: '2026-10-01',
        availability: 2,
      },
      {
        property_id: 'P',
        room_type_id: 'R3',
        date_from: '2026-10-02',
        date_to: '2026-10-03',
        availability: 1,
      },
      {
        property_id: 'P',
        room_type_id: 'R3',
        date_from: '2026-10-04',
        date_to: '2026-10-04',
        availability: 2,
      },
      {
        property_id: 'P',
        room_type_id: 'R3',
        date_from: '2026-10-05',
        date_to: '2026-10-05',
        availability: 1,
      },
    ]);
  });
  it('restrictions: rate per range; days without a price are stop_sell but carry the last known rate', () => {
    const values = buildRestrictionValues({
      propertyId: 'P',
      from: '2026-10-01',
      to: '2026-10-04',
      ratePlans: [
        { localCategoryCode: 'exely-900001', localRatePlanId: 'p2', providerRatePlanId: 'RP1' },
      ],
      dailyRates: [
        {
          date: '2026-10-01',
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 1_540_000n,
        },
        {
          date: '2026-10-02',
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 1_540_000n,
        },
        {
          date: '2026-10-03',
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 1_600_000n,
        },
      ],
      restrictions: [
        {
          date: '2026-10-02',
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          minStay: 2,
          maxStay: null,
          stopSell: false,
          closedToArrival: true,
          closedToDeparture: false,
        },
      ],
      occupancyByCategory: { 'exely-900001': 1 },
    });
    expect(values).toEqual([
      {
        property_id: 'P',
        rate_plan_id: 'RP1',
        date_from: '2026-10-01',
        date_to: '2026-10-01',
        rate: 1540000,
        stop_sell: false,
        closed_to_arrival: false,
        closed_to_departure: false,
        min_stay_arrival: 1,
        min_stay_through: 1,
        max_stay: 0,
      },
      {
        property_id: 'P',
        rate_plan_id: 'RP1',
        date_from: '2026-10-02',
        date_to: '2026-10-02',
        rate: 1540000,
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
        min_stay_through: 2,
        max_stay: 0,
      },
      {
        property_id: 'P',
        rate_plan_id: 'RP1',
        date_from: '2026-10-03',
        date_to: '2026-10-03',
        rate: 1600000,
        stop_sell: false,
        closed_to_arrival: false,
        closed_to_departure: false,
        min_stay_arrival: 1,
        min_stay_through: 1,
        max_stay: 0,
      },
      {
        property_id: 'P',
        rate_plan_id: 'RP1',
        date_from: '2026-10-04',
        date_to: '2026-10-04',
        rate: 1600000,
        stop_sell: true,
        closed_to_arrival: false,
        closed_to_departure: false,
        min_stay_arrival: 1,
        min_stay_through: 1,
        max_stay: 0,
      },
    ]);
  });
});


describe('lastPricedDate — граница выгрузки ограничений (Channex требует rate в каждом объекте)', () => {
  const occ = { A: 2, B: 1 };
  const rate = (
    accommodationTypeCode: string,
    date: string,
    occupancy: number,
  ): LocalDailyRate => ({ date, accommodationTypeCode, ratePlanId: 'rp', occupancy, priceMinor: 1n });
  it('последний день с ценой по вместимости категории', () => {
    expect(
      lastPricedDate(
        [rate('A', '2026-11-01', 2), rate('A', '2026-11-05', 2), rate('B', '2026-11-03', 1)],
        occ,
      ),
    ).toBe('2026-11-05');
  });
  it('цена не по вместимости (1 гость в двухместной) не считается за горизонт', () => {
    expect(lastPricedDate([rate('A', '2026-12-31', 1)], occ)).toBeNull();
  });
  it('без цен — null: ограничения не выгружаются', () => {
    expect(lastPricedDate([], occ)).toBeNull();
  });
});


describe('Full Sync: ограничения тянутся до конца окна (Channex — end dates aligned)', () => {
  it('хвост без цены закрыт stop_sell, но с перенесённой ценой; конец окна = доступности', () => {
    const values = buildRestrictionValues({
      propertyId: 'P',
      from: '2026-10-01',
      to: '2026-10-06',
      ratePlans: [
        { localCategoryCode: 'exely-900001', localRatePlanId: 'p2', providerRatePlanId: 'RP1' },
      ],
      dailyRates: [
        {
          date: '2026-10-01',
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 1_540_000n,
        },
        {
          date: '2026-10-02',
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 1_600_000n,
        },
      ],
      restrictions: [],
      occupancyByCategory: { 'exely-900001': 1 },
    });
    const last = values[values.length - 1]!;
    // окно ограничений доходит до конца периода (как доступность), а не обрывается на последней цене
    expect(last.date_to).toBe('2026-10-06');
    // хвост 03–06 закрыт, но с перенесённой последней ценой — Channex требует rate в каждом объекте
    expect(last).toMatchObject({
      date_from: '2026-10-03',
      date_to: '2026-10-06',
      rate: 1600000,
      stop_sell: true,
    });
    // ни одного объекта ограничений без rate
    expect(values.every((v) => typeof v.rate === 'number')).toBe(true);
  });
});
