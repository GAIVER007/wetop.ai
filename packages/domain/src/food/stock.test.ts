import { describe, expect, it } from 'vitest';
import { ingredientCost } from './restaurant';
import {
  allocateStock,
  dishPortions,
  inventoryDelta,
  milliOf,
  milliText,
  parseInventory,
  surplusUnitCost,
  parseKitchenProduct,
  parseKitchenReceipt,
  parseWriteOff,
  stockCost,
  stockQty,
  type StockLot,
} from './stock';

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('количество склада кухни', () => {
  it('тысячные доли целым числом, без float', () => {
    expect(stockQty('2.5')).toBe(2500n);
    expect(stockQty('0,125')).toBe(125n);
    expect(stockQty(3)).toBe(3000n);
    expect(milliText(2500n)).toBe('2.5');
    expect(milliText(3000n)).toBe('3');
    expect(milliText(-1250n)).toBe('-1.25');
    expect(milliOf('12.340')).toBe(12340n);
    expect(milliOf('-0.5')).toBe(-500n);
  });
  it('ноль, отрицательное и четыре знака отклоняются', () => {
    expect(() => stockQty('0')).toThrow('больше нуля');
    expect(stockQty('0', true)).toBe(0n);
    expect(() => stockQty('-1')).toThrow('Количество');
    expect(() => stockQty('1.2345')).toThrow('Количество');
  });
});

describe('стоимость склада совпадает с техкартой §33.1', () => {
  it('граммы по цене за кг и штуки по цене за штуку', () => {
    // 250 г говядины по 6 000 ₸/кг = 1 500 ₸
    expect(stockCost(250_000n, 'г', 600_000n)).toBe(150_000n);
    expect(stockCost(2_000n, 'шт', 15_000n)).toBe(30_000n);
    expect(stockCost(0n, 'г', 600_000n)).toBe(0n);
  });
  it('та же функция, что строка техкарты: расхождение невозможно', () => {
    for (const [qty, unit, cost] of [
      ['5', 'г', 80_000n],
      ['2.5', 'мл', 180_000n],
      ['3', 'шт', 1_234n],
    ] as const)
      expect(stockCost(stockQty(qty), unit, cost)).toBe(
        ingredientCost({ normQty: qty, unit, unitCost: cost }),
      );
  });
});

describe('FIFO по партиям', () => {
  const lots: StockLot[] = [
    { id: id(2), receivedOn: '2026-10-05', createdAt: new Date('2026-10-05T10:00Z'), remaining: 1_000_000n, unitCost: 700_000n },
    { id: id(1), receivedOn: '2026-10-01', createdAt: new Date('2026-10-01T10:00Z'), remaining: 400_000n, unitCost: 600_000n },
  ];
  it('сначала ранняя партия, затем следующая, себестоимость по цене каждой', () => {
    const r = allocateStock(lots, 600_000n, 'г');
    expect(r.allocations).toEqual([
      { lotId: id(1), milli: 400_000n, cost: 240_000n },
      { lotId: id(2), milli: 200_000n, cost: 140_000n },
    ]);
    expect(r.cost).toBe(380_000n);
  });
  it('ниже нуля нельзя, сообщение называет остаток', () => {
    expect(() => allocateStock(lots, 1_400_001n, 'г')).toThrow('есть 1400 г, нужно 1400.001 г');
  });
});

describe('инвентаризация', () => {
  it('недостача, излишек, совпадение', () => {
    expect(inventoryDelta(5000n, 4200n)).toEqual({ kind: 'shortage', milli: 800n });
    expect(inventoryDelta(5000n, 5100n)).toEqual({ kind: 'surplus', milli: 100n });
    expect(inventoryDelta(5000n, 5000n)).toEqual({ kind: 'equal' });
  });
});

describe('разбор форм склада', () => {
  it('ингредиент: единица только г, мл, шт', () => {
    expect(parseKitchenProduct({ name: 'Говядина Рибай', unit: 'г', minQty: '1000' })).toEqual({
      name: 'Говядина Рибай',
      unit: 'г',
      minQty: 1_000_000n,
    });
    expect(() => parseKitchenProduct({ name: 'Соль', unit: 'кг' })).toThrow('Единица');
  });
  it('приход: строки, цена целыми тиынами, даты календарные', () => {
    const r = parseKitchenReceipt({
      supplier: 'ООО Тестовое мясо',
      receivedOn: '2026-10-10',
      lines: [{ productId: id(1), qty: '12.5', unitCost: 600000, expiresOn: '2026-10-20' }],
    });
    expect(r.lines[0]).toEqual({ productId: id(1), qty: 12_500n, unitCost: 600_000n, expiresOn: '2026-10-20' });
    expect(r.document).toBeNull();
    expect(() => parseKitchenReceipt({ lines: [] })).toThrow('от 1 до 50');
    expect(() =>
      parseKitchenReceipt({ lines: [{ productId: id(1), qty: '1', unitCost: 60.5 }] }),
    ).toThrow('Цена');
    expect(() =>
      parseKitchenReceipt({ receivedOn: '2026-02-30', lines: [{ productId: id(1), qty: '1', unitCost: 1 }] }),
    ).toThrow('календарная');
  });
  it('списание требует причину, инвентаризация принимает ноль', () => {
    expect(() => parseWriteOff({ productId: id(1), qty: '1' })).toThrow('Некорректный текст');
    expect(parseInventory({ productId: id(1), actualQty: '0' }).actualQty).toBe(0n);
  });
});

describe('излишек при инвентаризации (Q-KITCHEN-9, ADR-175)', () => {
  it('цена: средняя по остатку партий, взвешенная количеством; без остатка нет', () => {
    expect(
      surplusUnitCost([
        { remaining: 2_000_000n, unitCost: 600_000n },
        { remaining: 1_000_000n, unitCost: 700_000n },
      ]),
    ).toBe(633_333n);
    expect(surplusUnitCost([])).toBeNull();
    expect(surplusUnitCost([{ remaining: 0n, unitCost: 600_000n }])).toBeNull();
    // самая дешёвая партия не даёт нулевой цены: в базе цена партии больше нуля
    expect(surplusUnitCost([{ remaining: 1n, unitCost: 1n }, { remaining: 1_000_000n, unitCost: 0n }])).toBe(1n);
  });
  it('ручная цена в инвентаризации необязательна и в тех же единицах, что у прихода', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(parseInventory({ productId: id, actualQty: '100' }).unitCost).toBeNull();
    expect(parseInventory({ productId: id, actualQty: '100', unitCost: 500_000 }).unitCost).toBe(500_000n);
    expect(() => parseInventory({ productId: id, actualQty: '100', unitCost: 0 })).toThrow();
  });
});


describe('порций блюда из остатков склада (ADR-STOCK-ALL)', () => {
  const onHand = new Map<string, bigint>([
    ['flour', 12_000_000n],
    ['cream', 1_500_000n],
    ['parmesan', 180_000n],
  ]);
  it('берёт наименьшее число целых порций и называет продукт, который ограничивает', () => {
    const r = dishPortions(
      [
        { productId: 'flour', name: 'Мука', normQty: '120' },
        { productId: 'cream', name: 'Сливки', normQty: '50' },
        { productId: 'parmesan', name: 'Пармезан', normQty: '20' },
      ],
      onHand,
    );
    expect(r).toEqual({ portions: 9, limiting: 'Пармезан' });
  });
  it('нехватка до целой порции даёт ноль, а не дробь', () => {
    expect(dishPortions([{ productId: 'parmesan', name: 'Пармезан', normQty: '200' }], onHand)).toEqual({
      portions: 0,
      limiting: 'Пармезан',
    });
  });
  it('строки без связи со складом ничего не ограничивают; без единой связи порции неизвестны', () => {
    expect(
      dishPortions(
        [
          { productId: null, name: 'Соль', normQty: '2' },
          { productId: 'cream', name: 'Сливки', normQty: '50' },
        ],
        onHand,
      ),
    ).toEqual({ portions: 30, limiting: 'Сливки' });
    expect(dishPortions([{ productId: null, name: 'Соль', normQty: '2' }], onHand)).toEqual({ portions: null, limiting: null });
    expect(dishPortions([], onHand)).toEqual({ portions: null, limiting: null });
  });
  it('продукта нет в остатках: хватит на ноль порций', () => {
    expect(dishPortions([{ productId: 'ghost', name: 'Трюфель', normQty: '5' }], onHand)).toEqual({
      portions: 0,
      limiting: 'Трюфель',
    });
  });
});
