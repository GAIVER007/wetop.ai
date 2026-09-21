import { describe, expect, it } from 'vitest';
import { buildHotelSetupPlan, OnboardingError, type HotelSetup } from './plan';

const base = (over: Partial<HotelSetup> = {}): HotelSetup => ({
  currency: 'KZT',
  categories: [
    {
      name: 'Двухместный номер',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 2,
      units: 3,
      priceMinor: 2100000,
    },
    {
      name: 'Койко-место, общий',
      kind: 'DORM_BED',
      capacityAdults: 1,
      units: 8,
      priceMinor: 900000,
    },
  ],
  ...over,
});

describe('buildHotelSetupPlan', () => {
  it('заводит категории, места и цены под ту же запись, что и импорт', () => {
    const plan = buildHotelSetupPlan(base());
    expect(plan.inventory.buildingName).toBe('Основной корпус');
    expect(plan.inventory.accommodationTypes.map((t) => t.code)).toEqual(['cat-1', 'cat-2']);
    // 3 номера + 8 коек = 11 мест
    expect(plan.inventory.units).toHaveLength(11);
    // койки — BED и isDorm, номера — ROOM
    const beds = plan.inventory.units.filter((u) => u.accommodationTypeCode === 'cat-2');
    expect(beds.every((u) => u.kind === 'BED' && u.isDorm && u.roomCapacity === 1)).toBe(true);
    const rooms = plan.inventory.units.filter((u) => u.accommodationTypeCode === 'cat-1');
    expect(rooms.every((u) => u.kind === 'ROOM' && !u.isDorm && u.roomCapacity === 2)).toBe(true);
  });

  it('коды мест уникальны и читаемы: категория 1 → 101.., категория 2 → 201..', () => {
    const plan = buildHotelSetupPlan(base());
    const codes = plan.inventory.units.map((u) => u.code);
    expect(codes.slice(0, 3)).toEqual(['101', '102', '103']);
    expect(codes.filter((c) => c.startsWith('2')).slice(0, 2)).toEqual(['201', '202']);
    expect(new Set(codes).size).toBe(codes.length);
    // номер комнаты совпадает с кодом места (PhysicalRoom 1:1)
    expect(plan.inventory.units.every((u) => u.roomNumber === u.code)).toBe(true);
  });

  it('цена — строкой на каждый occupancy 1..вместимость: бронь на любое число гостей найдёт цену', () => {
    const plan = buildHotelSetupPlan(base());
    const cat1 = plan.rates.filter((r) => r.accommodationTypeCode === 'cat-1');
    expect(cat1).toEqual([
      { accommodationTypeCode: 'cat-1', occupancy: 1, priceMinor: '2100000' },
      { accommodationTypeCode: 'cat-1', occupancy: 2, priceMinor: '2100000' },
    ]);
    const cat2 = plan.rates.filter((r) => r.accommodationTypeCode === 'cat-2');
    expect(cat2).toEqual([{ accommodationTypeCode: 'cat-2', occupancy: 1, priceMinor: '900000' }]);
    expect(plan.ratePlan).toEqual({ code: 'main', name: 'Основной тариф', currency: 'KZT' });
  });

  it('ширина номера растёт под число мест: 100 мест → 001..100', () => {
    const plan = buildHotelSetupPlan(
      base({
        categories: [
          { name: 'Общий', kind: 'DORM_BED', capacityAdults: 1, units: 100, priceMinor: 500000 },
        ],
      }),
    );
    const codes = plan.inventory.units.map((u) => u.code);
    expect(codes[0]).toBe('1001');
    expect(codes[99]).toBe('1100');
    expect(new Set(codes).size).toBe(100);
  });

  it.each([
    [{ categories: [] }, /хотя бы одну категорию/],
    [{ currency: 'тенге' }, /Валюта — три латинские буквы/],
  ])('негодный ввод отклоняется до записи (%#)', (over, re) => {
    expect(() => buildHotelSetupPlan(base(over as Partial<HotelSetup>))).toThrow(re);
  });

  it.each([
    [{ name: '  ' }, /укажите название/],
    [{ kind: 'СУПЕР' as never }, /неизвестный тип/],
    [{ capacityAdults: 0 }, /гостей на место/],
    [{ units: 0 }, /число мест/],
    [{ units: 1.5 }, /число мест/],
    [{ priceMinor: -1 }, /цена за ночь/],
    [{ priceMinor: 1.5 }, /цена за ночь/],
  ])('негодная категория отклоняется (%#)', (bad, re) => {
    const setup = base({
      categories: [
        {
          name: 'Номер',
          kind: 'PRIVATE_ROOM',
          capacityAdults: 2,
          units: 2,
          priceMinor: 1000,
          ...bad,
        },
      ],
    });
    expect(() => buildHotelSetupPlan(setup)).toThrow(OnboardingError);
    expect(() => buildHotelSetupPlan(setup)).toThrow(re);
  });

  it('повтор названия категории — отказ (регистр и пробелы не спасают)', () => {
    const setup = base({
      categories: [
        { name: 'Люкс', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 1, priceMinor: 1000 },
        { name: '  люкс ', kind: 'APARTMENT', capacityAdults: 4, units: 1, priceMinor: 2000 },
      ],
    });
    expect(() => buildHotelSetupPlan(setup)).toThrow(/повтор/i);
  });

  it('слишком много мест суммарно — отказ', () => {
    const setup = base({
      categories: Array.from({ length: 5 }, (_, k) => ({
        name: `Общий ${k}`,
        kind: 'DORM_BED' as const,
        capacityAdults: 1,
        units: 500,
        priceMinor: 1000,
      })),
    });
    expect(() => buildHotelSetupPlan(setup)).toThrow(/Всего мест не больше/);
  });
});
