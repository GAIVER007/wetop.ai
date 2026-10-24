import { describe, expect, it } from 'vitest';
import {
  checkModifierChoice,
  itemsPaymentAmount,
  linePrice,
  orderLineKey,
  parseItemModifierGroups,
  parseModifierGroupInput,
  splitEvenly,
  type ModifierGroupRule,
} from './modifiers';
import { parseOrderItems } from './restaurant';
import { parseFoodPayment } from './cash';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const size: ModifierGroupRule = {
  id: ID(1),
  name: 'Размер',
  minSelect: 1,
  maxSelect: 1,
  modifiers: [
    { id: ID(11), name: 'Маленький', priceDelta: -20000n, active: true },
    { id: ID(12), name: 'Средний', priceDelta: 0n, active: true },
    { id: ID(13), name: 'Большой', priceDelta: 30000n, active: true },
  ],
};
const extras: ModifierGroupRule = {
  id: ID(2),
  name: 'Добавки',
  minSelect: 0,
  maxSelect: 2,
  modifiers: [
    { id: ID(21), name: 'Сироп', priceDelta: 15000n, active: true },
    { id: ID(22), name: 'Овсяное молоко', priceDelta: 25000n, active: true },
    { id: ID(23), name: 'Корица', priceDelta: 5000n, active: false },
  ],
};

/** DATA_MODEL §33.7: модификаторы блюд (миграция 144) */
describe('модификаторы: проверка выбора', () => {
  it('без групп у блюда выбор пустой', () => {
    expect(checkModifierChoice([], [])).toEqual([]);
  });

  it('обязательная группа без выбора: отказ по-русски с названием группы', () => {
    expect(() => checkModifierChoice([size, extras], [])).toThrow('Выберите: Размер');
  });

  it('больше максимума: отказ', () => {
    expect(() => checkModifierChoice([size], [ID(11), ID(12)])).toThrow('Размер: не больше 1');
    expect(() => checkModifierChoice([size, extras], [ID(12), ID(21), ID(22), ID(23)])).toThrow();
  });

  it('модификатор не из групп блюда (чужой бизнес, другое блюдо) и выключенный: отказ', () => {
    expect(() => checkModifierChoice([size], [ID(12), ID(99)])).toThrow('Добавка недоступна для этого блюда');
    expect(() => checkModifierChoice([size, extras], [ID(12), ID(23)])).toThrow('Добавка недоступна для этого блюда');
  });

  it('повтор одного модификатора: отказ', () => {
    expect(() => checkModifierChoice([extras], [ID(21), ID(21)])).toThrow('Добавка выбрана дважды');
  });

  it('выбор возвращает снимки в порядке групп блюда и модификаторов', () => {
    expect(checkModifierChoice([size, extras], [ID(22), ID(13)])).toEqual([
      { modifierId: ID(13), groupName: 'Размер', name: 'Большой', priceDelta: 30000n, sortOrder: 0 },
      { modifierId: ID(22), groupName: 'Добавки', name: 'Овсяное молоко', priceDelta: 25000n, sortOrder: 1 },
    ]);
  });

  it('минимум больше одного у необязательной по смыслу группы', () => {
    const two = { ...extras, minSelect: 2 };
    expect(() => checkModifierChoice([two], [ID(21)])).toThrow('Добавки: выберите не меньше 2');
  });
});

describe('модификаторы: цена строки', () => {
  it('цена блюда плюс прибавки, минус у маленького размера', () => {
    expect(linePrice(100000n, [30000n, 25000n])).toBe(155000n);
    expect(linePrice(100000n, [-20000n])).toBe(80000n);
    expect(linePrice(100000n, [])).toBe(100000n);
  });
  it('цена не может стать отрицательной', () => {
    expect(() => linePrice(10000n, [-20000n])).toThrow('Цена позиции с добавками меньше нуля');
  });
  it('ключ строки: блюдо, набор модификаторов без учёта порядка, комментарий', () => {
    expect(orderLineKey(ID(5), [ID(2), ID(1)], null)).toBe(orderLineKey(ID(5), [ID(1), ID(2)], null));
    expect(orderLineKey(ID(5), [ID(1)], null)).not.toBe(orderLineKey(ID(5), [ID(1)], 'без сахара'));
    expect(orderLineKey(ID(5), [], null)).not.toBe(orderLineKey(ID(6), [], null));
  });
});

describe('модификаторы: разбор запросов', () => {
  it('группа с модификаторами', () => {
    expect(
      parseModifierGroupInput({
        name: ' Размер ',
        minSelect: 1,
        maxSelect: 1,
        modifiers: [
          { name: 'Маленький', priceDeltaMinor: -20000 },
          { id: ID(12), name: 'Большой', priceDeltaMinor: 30000, active: false },
        ],
      }),
    ).toEqual({
      name: 'Размер',
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        { id: null, name: 'Маленький', priceDelta: -20000n, active: true, sortOrder: 0 },
        { id: ID(12), name: 'Большой', priceDelta: 30000n, active: false, sortOrder: 1 },
      ],
    });
  });
  it('минимум больше максимума, пустое имя, нецелая сумма, повтор имени: отказ', () => {
    expect(() => parseModifierGroupInput({ name: 'X', minSelect: 2, maxSelect: 1, modifiers: [] })).toThrow(
      'Минимум выбора больше максимума',
    );
    expect(() => parseModifierGroupInput({ name: '', modifiers: [] })).toThrow();
    expect(() =>
      parseModifierGroupInput({ name: 'X', modifiers: [{ name: 'A', priceDeltaMinor: 1.5 }] }),
    ).toThrow();
    expect(() =>
      parseModifierGroupInput({ name: 'X', modifiers: [{ name: 'A', priceDeltaMinor: 0 }, { name: 'a', priceDeltaMinor: 0 }] }),
    ).toThrow('Добавка «a» повторяется');
  });
  it('частичная правка: только переданные поля', () => {
    expect(parseModifierGroupInput({ active: false }, true)).toEqual({ active: false });
  });
  it('обязательная группа ровно с одним модификатором нельзя сделать без модификаторов в группе', () => {
    expect(() => parseModifierGroupInput({ name: 'X', minSelect: 3, maxSelect: 3, modifiers: [{ name: 'A', priceDeltaMinor: 0 }] })).toThrow(
      'В группе меньше добавок, чем минимум выбора',
    );
  });
  it('группы блюда: список без повторов', () => {
    expect(parseItemModifierGroups({ groupIds: [ID(1), ID(2)] })).toEqual([ID(1), ID(2)]);
    expect(() => parseItemModifierGroups({ groupIds: [ID(1), ID(1)] })).toThrow('Группа указана дважды');
    expect(parseItemModifierGroups({ groupIds: [] })).toEqual([]);
  });
  it('строка заказа принимает modifierIds и комментарий', () => {
    expect(parseOrderItems([{ menuItemId: ID(5), qty: 2, modifierIds: [ID(13)], notes: 'без льда' }])).toEqual([
      { menuItemId: ID(5), qty: 2, notes: 'без льда', modifierIds: [ID(13)] },
    ]);
    expect(parseOrderItems([{ menuItemId: ID(5), qty: 1 }])[0]!.modifierIds).toEqual([]);
  });
  it('оплата принимает позиции', () => {
    expect(parseFoodPayment({ method: 'CASH', amount: 100, idempotencyKey: 'k', itemIds: [ID(7)] }).itemIds).toEqual([ID(7)]);
    expect(parseFoodPayment({ method: 'CASH', amount: 100, idempotencyKey: 'k' }).itemIds).toBeNull();
    expect(() => parseFoodPayment({ method: 'CASH', amount: 100, idempotencyKey: 'k', itemIds: [] })).toThrow(
      'Отметьте хотя бы одну позицию',
    );
  });
});

describe('деление счёта', () => {
  it('поровну: остаток тиынов первому гостю', () => {
    expect(splitEvenly(100000n, 3)).toEqual([33334n, 33333n, 33333n]);
    expect(splitEvenly(100001n, 4)).toEqual([25001n, 25000n, 25000n, 25000n]);
    expect(splitEvenly(90000n, 1)).toEqual([90000n]);
    expect(splitEvenly(5n, 3)).toEqual([3n, 1n, 1n]);
  });
  it('поровну: гостей от 1 до 50, сумма больше нуля и не меньше числа гостей', () => {
    expect(() => splitEvenly(100n, 0)).toThrow('Гостей от 1 до 50');
    expect(() => splitEvenly(100n, 51)).toThrow('Гостей от 1 до 50');
    expect(() => splitEvenly(0n, 2)).toThrow('Нечего делить');
    expect(() => splitEvenly(2n, 3)).toThrow('Сумма меньше числа гостей');
  });
  it('сумма частей равна остатку', () => {
    for (const n of [2, 3, 7, 13]) expect(splitEvenly(1234567n, n).reduce((a, b) => a + b, 0n)).toBe(1234567n);
  });
  const lines = [
    { id: ID(31), price: 155000n, qty: 1, paid: false },
    { id: ID(32), price: 50000n, qty: 2, paid: false },
    { id: ID(33), price: 70000n, qty: 1, paid: true },
  ];
  it('по позициям: сумма выбранных строк (цена × количество)', () => {
    expect(itemsPaymentAmount(lines, [ID(31), ID(32)])).toBe(255000n);
  });
  it('по позициям: оплаченная, чужая, повтор, пусто: отказ', () => {
    expect(() => itemsPaymentAmount(lines, [ID(33)])).toThrow('Позиция уже оплачена');
    expect(() => itemsPaymentAmount(lines, [ID(99)])).toThrow('Позиция не из этого заказа');
    expect(() => itemsPaymentAmount(lines, [ID(31), ID(31)])).toThrow('Позиция отмечена дважды');
    expect(() => itemsPaymentAmount(lines, [])).toThrow('Отметьте хотя бы одну позицию');
  });
});

describe('§62.2 продукты добавки', () => {
  const P1 = '11111111-1111-4111-8111-111111111111',
    P2 = '22222222-2222-4222-8222-222222222222';
  it('без поля ingredients продукты не трогаются (undefined); список разбирается в тысячные доли', () => {
    const g = parseModifierGroupInput({
      name: 'Добавки',
      modifiers: [
        { name: 'Молоко', priceDeltaMinor: 20000, ingredients: [{ productId: P1, normQty: '50' }, { productId: P2, normQty: '0,5' }] },
        { name: 'Без продуктов', priceDeltaMinor: 0 },
        { name: 'Снять продукты', priceDeltaMinor: 0, ingredients: [] },
      ],
    });
    expect(g.modifiers!.map((m) => m.ingredients)).toEqual([
      [
        { productId: P1, normQty: 50_000n },
        { productId: P2, normQty: 500n },
      ],
      undefined,
      [],
    ]);
  });
  it('продукт дважды в одной добавке, ноль и больше 20 строк: отказ', () => {
    const one = (ingredients: unknown) => parseModifierGroupInput({ name: 'X', modifiers: [{ name: 'A', priceDeltaMinor: 0, ingredients }] });
    expect(() => one([{ productId: P1, normQty: '1' }, { productId: P1, normQty: '2' }])).toThrow(/один раз/);
    expect(() => one([{ productId: P1, normQty: '0' }])).toThrow(/больше нуля/);
    expect(() => one(Array.from({ length: 21 }, () => ({ productId: P1, normQty: '1' })))).toThrow(/до 20/);
  });
});
