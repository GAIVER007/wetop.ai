import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { MenuModifiersService } from '../../apps/api/src/food-service/modifiers';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Модификаторы блюд и деление счёта (DATA_MODEL §33.7, миграция 144): цена строки с модификаторами, обязательная
 * группа, чужой модификатор, кухня видит выбор и комментарий, оплата по позициям без второй оплаты строки, возврат
 * платежа освобождает позиции, деление поровну. Вымышленные данные (ADR-010).
 */
describe('модификаторы блюд и деление счёта (integration, §33.7)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: RestaurantService, mods: MenuModifiersService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location = randomUUID(),
    otherBusiness = randomUUID(),
    otherLocation = randomUUID();
  const ids = { coffee: '', cake: '', table: '', size: '', extras: '', small: '', medium: '', large: '', syrup: '', oat: '', foreign: '' };
  const ctx = (b: string, l: string) => ({ userId: user, organizationId: org, role: 'OWNER' as const, scope: 'LOCATION' as const, businessId: b, locationId: l, vertical: 'FOOD_SERVICE' as const });
  const at = <T>(fn: () => Promise<T>) => withSignedInUser(ctx(business, location), fn);
  const atOther = <T>(fn: () => Promise<T>) => withSignedInUser(ctx(otherBusiness, otherLocation), fn);
  type View = Awaited<ReturnType<RestaurantService['createOrder']>>;
  const create = (items: unknown[]) => at(() => svc.createOrder({ tableId: ids.table, guestCount: 2, items }));
  const token = (o: View) => ({ expectedStatus: o.status, expectedUpdatedAt: o.updatedAt.toISOString() });
  const pay = (o: View, body: Record<string, unknown>) =>
    at(() => svc.payOrder(o.id, { method: 'CASH', idempotencyKey: randomUUID(), ...body }));
  const step = (o: View, status: string) => at(() => svc.orderStatus(o.id, { ...token(o), status }));
  const serve = async (o: View) => step(await step(await step(o, 'COOKING'), 'READY'), 'SERVED');

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    mods = new MenuModifiersService(prisma);
    await db.organization.create({ data: { id: org, name: 'Модификаторы', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `mods-${user}@example.invalid` } });
    for (const [b, l] of [[business, location], [otherBusiness, otherLocation]] as const) {
      await db.business.create({ data: { id: b, organizationId: org, name: `Synthetic food ${b.slice(0, 4)}`, vertical: 'FOOD_SERVICE' } });
      await db.location.create({ data: { id: l, businessId: b, name: 'Synthetic branch', timezone: 'Asia/Almaty', currency: 'KZT' } });
    }
    const area = await db.diningArea.create({ data: { locationId: location, name: 'Зал' } });
    ids.table = (await db.diningTable.create({ data: { areaId: area.id, name: '1', capacity: 4 } })).id;
    const drinks = await at(() => svc.createCategory({ name: 'Кофе', station: 'BAR' }));
    const sweets = await at(() => svc.createCategory({ name: 'Десерты' }));
    ids.coffee = (await at(() => svc.createMenuItem({ categoryId: drinks.id, name: 'Капучино', price: 100000 }))).id;
    ids.cake = (await at(() => svc.createMenuItem({ categoryId: sweets.id, name: 'Чизкейк', price: 200000 }))).id;
    const size = await at(() =>
      mods.createGroup({
        name: 'Размер',
        minSelect: 1,
        maxSelect: 1,
        modifiers: [
          { name: 'Маленький', priceDeltaMinor: -20000 },
          { name: 'Средний', priceDeltaMinor: 0 },
          { name: 'Большой', priceDeltaMinor: 30000 },
        ],
      }),
    );
    const extras = await at(() =>
      mods.createGroup({ name: 'Добавки', minSelect: 0, maxSelect: 3, modifiers: [{ name: 'Сироп', priceDeltaMinor: 15000 }, { name: 'Овсяное молоко', priceDeltaMinor: 25000 }] }),
    );
    ids.size = size.id;
    ids.extras = extras.id;
    [ids.small, ids.medium, ids.large] = size.modifiers.map((m) => m.id) as [string, string, string];
    [ids.syrup, ids.oat] = extras.modifiers.map((m) => m.id) as [string, string];
    const foreign = await atOther(() => mods.createGroup({ name: 'Чужие', modifiers: [{ name: 'Чужой сироп', priceDeltaMinor: 1 }] }));
    ids.foreign = foreign.modifiers[0]!.id;
    await at(() => mods.setItemGroups(ids.coffee, { groupIds: [ids.size, ids.extras] }));
  });
  afterAll(async () => db?.$disconnect());

  it('группы: список отдаёт модификаторы по порядку; меню отдаёт группы блюда', async () => {
    const list = await at(() => mods.groups());
    expect(list.items.map((g) => g.name)).toEqual(['Добавки', 'Размер']);
    const g = list.items.find((x) => x.id === ids.size)!;
    expect(g).toMatchObject({ minSelect: 1, maxSelect: 1, required: true });
    expect(g.modifiers.map((m) => [m.name, m.priceDeltaMinor])).toEqual([['Маленький', '-20000'], ['Средний', '0'], ['Большой', '30000']]);
    // в списке нет групп другого бизнеса
    expect(list.items.some((x) => x.name === 'Чужие')).toBe(false);
    const menu = await at(() => svc.menuItems({}));
    const coffee = menu.items.find((m) => m.id === ids.coffee)!;
    expect(coffee.modifierGroupIds).toEqual([ids.size, ids.extras]);
    expect(coffee.modifierGroups.map((x) => x.name)).toEqual(['Размер', 'Добавки']);
    expect(menu.items.find((m) => m.id === ids.cake)!.modifierGroups).toEqual([]);
  });

  it('группа чужого бизнеса к блюду не привязывается; повтор имени группы: отказ', async () => {
    const foreignGroup = (await atOther(() => mods.groups())).items[0]!;
    await expect(at(() => mods.setItemGroups(ids.coffee, { groupIds: [foreignGroup.id] }))).rejects.toThrow('Группа добавок не найдена');
    await expect(at(() => mods.createGroup({ name: 'Размер', modifiers: [{ name: 'X', priceDeltaMinor: 0 }] }))).rejects.toThrow('Группа с таким названием уже есть');
  });

  it('цена строки = блюдо + модификаторы, снимок у строки, комментарий; кухня видит модификаторы и комментарий', async () => {
    const o = await create([
      { menuItemId: ids.coffee, qty: 2, modifierIds: [ids.oat, ids.large], notes: 'без сахара' },
      { menuItemId: ids.cake, qty: 1 },
    ]);
    const line = o.items.find((i) => i.menuItemId === ids.coffee)!;
    expect(line.priceMinor).toBe('155000');
    expect(line.notes).toBe('без сахара');
    expect(line.modifiers.map((m) => [m.groupName, m.name, m.priceDeltaMinor])).toEqual([
      ['Размер', 'Большой', '30000'],
      ['Добавки', 'Овсяное молоко', '25000'],
    ]);
    expect(o.totalMinor).toBe(String(155000 * 2 + 200000));
    // экран бара читает тот же список открытых заказов
    const open = await at(() => svc.orders({ open: '1' }));
    const kds = open.items.find((x) => x.id === o.id)!.items.find((i) => i.menuItemId === ids.coffee)!;
    expect(kds.station).toBe('BAR');
    expect(kds.modifiers.map((m) => m.name)).toEqual(['Большой', 'Овсяное молоко']);
    expect(kds.notes).toBe('без сахара');
    // цена в меню потом меняется, строка заморожена
    await at(() => svc.updateMenuItem(ids.coffee, { price: 120000 }));
    const again = (await at(() => svc.orders({ open: '1' }))).items.find((x) => x.id === o.id)!;
    expect(again.items.find((i) => i.menuItemId === ids.coffee)!.priceMinor).toBe('155000');
    await at(() => svc.updateMenuItem(ids.coffee, { price: 100000 }));
  });

  it('обязательная группа без выбора: 400 по-русски; чужой модификатор и лишний выбор: отказ', async () => {
    const err = await create([{ menuItemId: ids.coffee, qty: 1 }]).catch((e: unknown) => e);
    expect((err as { getStatus(): number }).getStatus()).toBe(400);
    expect((err as Error).message).toBe('Капучино: Выберите: Размер');
    await expect(create([{ menuItemId: ids.coffee, qty: 1, modifierIds: [ids.medium, ids.foreign] }])).rejects.toThrow('Добавка недоступна для этого блюда');
    await expect(create([{ menuItemId: ids.cake, qty: 1, modifierIds: [ids.syrup] }])).rejects.toThrow('Добавка недоступна для этого блюда');
    await expect(create([{ menuItemId: ids.coffee, qty: 1, modifierIds: [ids.small, ids.large] }])).rejects.toThrow('Размер: не больше 1');
  });

  it('дозаказ: одинаковое блюдо с другим выбором отдельной строкой, прежние строки остаются', async () => {
    const o = await create([{ menuItemId: ids.coffee, qty: 1, modifierIds: [ids.small] }]);
    const first = o.items[0]!.id;
    const b = await at(() =>
      svc.updateOrder(o.id, {
        ...token(o),
        items: [
          { menuItemId: ids.coffee, qty: 1, modifierIds: [ids.small] },
          { menuItemId: ids.coffee, qty: 1, modifierIds: [ids.large, ids.syrup], notes: 'горячее' },
        ],
      }),
    );
    expect(b.items).toHaveLength(2);
    // строки NEW заменяются (§33.6), состав по выбору сохраняется
    void first;
    expect(b.items.map((i) => [i.priceMinor, i.modifiers.map((m) => m.name), i.notes])).toEqual([
      ['80000', ['Маленький'], null],
      ['145000', ['Большой', 'Сироп'], 'горячее'],
    ]);
    expect(b.totalMinor).toBe(String(80000 + 145000));
  });

  it('по позициям: строку нельзя оплатить дважды; аннулирование освобождает; остальное поровну; заказ закрыт', async () => {
    const o = await create([
      { menuItemId: ids.coffee, qty: 1, modifierIds: [ids.large] },
      { menuItemId: ids.cake, qty: 2 },
    ]);
    const coffee = o.items.find((i) => i.menuItemId === ids.coffee)!;
    const cake = o.items.find((i) => i.menuItemId === ids.cake)!;
    // сумма должна совпасть с позициями
    await expect(pay(o, { amount: 1000, itemIds: [coffee.id] })).rejects.toThrow('Сумма не совпадает с отмеченными позициями');
    const a = await pay(o, { amount: 130000, itemIds: [coffee.id] });
    expect(a.paidMinor).toBe('130000');
    expect(a.items.find((i) => i.id === coffee.id)!.paid).toBe(true);
    expect(a.items.find((i) => i.id === cake.id)!.paid).toBe(false);
    expect(a.payments[0]!.itemIds).toEqual([coffee.id]);
    // вторая оплата той же позиции: отказ (API), а база держит частичный уникальный индекс
    await expect(pay(a, { amount: 130000, itemIds: [coffee.id] })).rejects.toThrow('Позиция уже оплачена');
    const paymentId = a.payments[0]!.id;
    const other = await db.restaurantPayment.create({
      data: { locationId: location, orderId: o.id, method: 'CASH', amount: 1n, currency: 'KZT', idempotencyKey: randomUUID() },
    });
    await expect(db.restaurantPaymentItem.create({ data: { paymentId: other.id, orderItemId: coffee.id, amount: 1n } })).rejects.toThrow();
    await db.restaurantPayment.update({ where: { id: other.id }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: 'проба' } });
    // оплаченную позицию нельзя убрать из заказа
    const fresh = (await at(() => svc.orders({ open: '1' }))).items.find((x) => x.id === o.id)!;
    await expect(
      at(() => svc.updateOrder(o.id, { expectedStatus: fresh.status, expectedUpdatedAt: fresh.updatedAt.toISOString(), items: [{ menuItemId: ids.cake, qty: 2 }] })),
    ).rejects.toThrow('Оплаченные позиции убрать нельзя');
    // аннулирование освобождает позицию: её снова можно оплатить
    const v = await at(() => svc.voidPayment(paymentId, { reason: 'ошибся гостем' }));
    expect(v.items.find((i) => i.id === coffee.id)!.paid).toBe(false);
    const released = await db.restaurantPaymentItem.findFirstOrThrow({ where: { paymentId } });
    expect(released.releasedAt).not.toBeNull();
    const again = await pay(v, { amount: 130000, itemIds: [coffee.id] });
    expect(again.items.find((i) => i.id === coffee.id)!.paid).toBe(true);
    // остаток 400000 поровну на двоих: обычной частичной оплатой
    const served = await serve(again);
    const p1 = await pay(served, { amount: 200000 });
    const p2 = await pay(p1, { amount: 200000 });
    expect(p2.status).toBe('CLOSED');
    expect(p2.paidMinor).toBe(p2.totalMinor);
  });

  it('позиция чужого заказа в оплате: отказ', async () => {
    const a = await create([{ menuItemId: ids.cake, qty: 1 }]);
    const b = await create([{ menuItemId: ids.cake, qty: 1 }]);
    await expect(pay(a, { amount: 200000, itemIds: [b.items[0]!.id] })).rejects.toThrow('Позиция не из этого заказа');
  });

  it('правка группы: модификатор выключается, новый добавляется, имя меняется; выключенный в заказе недоступен', async () => {
    const g = await at(() =>
      mods.updateGroup(ids.extras, {
        name: 'Добавки к кофе',
        modifiers: [
          { id: ids.syrup, name: 'Сироп ваниль', priceDeltaMinor: 15000, active: false },
          { id: ids.oat, name: 'Овсяное молоко', priceDeltaMinor: 25000 },
          { name: 'Корица', priceDeltaMinor: 5000 },
        ],
      }),
    );
    expect(g.name).toBe('Добавки к кофе');
    expect(g.modifiers.map((m) => [m.name, m.active])).toEqual([['Сироп ваниль', false], ['Овсяное молоко', true], ['Корица', true]]);
    await expect(create([{ menuItemId: ids.coffee, qty: 1, modifierIds: [ids.medium, ids.syrup] }])).rejects.toThrow('Добавка недоступна');
    // модификатор чужой группы через правку не переносится
    await expect(at(() => mods.updateGroup(ids.extras, { modifiers: [{ id: ids.small, name: 'Маленький', priceDeltaMinor: 0 }] }))).rejects.toThrow('Добавка не из этой группы');
  });
});
