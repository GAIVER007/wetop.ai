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
 * Добавки списывают продукты (DATA_MODEL §62.2, срез K2, миграция 156): «кофе + молоко 50 мл» при «Готово» списывает
 * и кофе по техкарте, и молоко добавки, тем же FIFO; отмена возвращает оба; продукт добавки только своего бизнеса.
 * Вымышленные данные (ADR-010).
 */
describe('добавки со списанием со склада (integration, §62.2)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: RestaurantService, mods: MenuModifiersService, stock: StockService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location = randomUUID(),
    otherBusiness = randomUUID(),
    otherLocation = randomUUID();
  const ids = { coffee: '', beans: '', milk: '', syrup: '', foreignMilk: '', extras: '', milkMod: '', syrupMod: '', bigMod: '', table: '' };
  const ctx = (b: string, l: string) => ({ userId: user, organizationId: org, role: 'OWNER' as const, scope: 'LOCATION' as const, businessId: b, locationId: l, vertical: 'FOOD_SERVICE' as const });
  const at = <T>(fn: () => Promise<T>) => withSignedInUser(ctx(business, location), fn);
  const atOther = <T>(fn: () => Promise<T>) => withSignedInUser(ctx(otherBusiness, otherLocation), fn);
  type View = Awaited<ReturnType<RestaurantService['createOrder']>>;
  const token = (o: View) => ({ expectedStatus: o.status, expectedUpdatedAt: o.updatedAt.toISOString() });
  const step = (o: View, status: string) => at(() => svc.orderStatus(o.id, { ...token(o), status }));
  const onHand = async () =>
    Object.fromEntries((await at(() => stock.products())).items.map((p) => [p.name, p.onHand]));

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    stock = new StockService(prisma);
    svc = new RestaurantService(prisma, null, stock);
    mods = new MenuModifiersService(prisma);
    await db.organization.create({ data: { id: org, name: 'Добавки склад', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `modstock-${user}@example.invalid` } });
    for (const [b, l] of [[business, location], [otherBusiness, otherLocation]] as const) {
      await db.business.create({ data: { id: b, organizationId: org, name: `Synthetic food ${b.slice(0, 4)}`, vertical: 'FOOD_SERVICE' } });
      await db.location.create({ data: { id: l, businessId: b, name: 'Synthetic branch', timezone: 'Asia/Almaty', currency: 'KZT' } });
    }
    const area = await db.diningArea.create({ data: { locationId: location, name: 'Зал' } });
    ids.table = (await db.diningTable.create({ data: { areaId: area.id, name: '1', capacity: 4 } })).id;
    ids.beans = (await at(() => stock.createProduct({ name: 'Кофе зерно', unit: 'г' }))).id;
    ids.milk = (await at(() => stock.createProduct({ name: 'Молоко', unit: 'мл' }))).id;
    ids.syrup = (await at(() => stock.createProduct({ name: 'Сироп', unit: 'мл' }))).id;
    ids.foreignMilk = (await atOther(() => stock.createProduct({ name: 'Чужое молоко', unit: 'мл' }))).id;
    // кофе 1 кг по 10 000 ₸/кг; молоко двумя партиями: 100 мл по 500 ₸/л, затем 1 л по 600 ₸/л; сироп 0.5 л по 4 000 ₸/л
    await at(() => stock.receipt({ receivedOn: '2026-10-20', lines: [{ productId: ids.beans, qty: '1000', unitCost: 1_000_000 }, { productId: ids.milk, qty: '100', unitCost: 50_000 }] }));
    await at(() => stock.receipt({ receivedOn: '2026-10-21', lines: [{ productId: ids.milk, qty: '1000', unitCost: 60_000 }, { productId: ids.syrup, qty: '500', unitCost: 400_000 }] }));
    const bar = await at(() => svc.createCategory({ name: 'Кофе', station: 'BAR' }));
    ids.coffee = (await at(() => svc.createMenuItem({ categoryId: bar.id, name: 'Американо', price: 80000 }))).id;
    await at(() => svc.replaceIngredients(ids.coffee, { ingredients: [{ name: 'Кофе', normQty: '18', unit: 'г', unitCost: 1_000_000, productId: ids.beans }] }));
  });
  afterAll(async () => db?.$disconnect());

  it('группа добавок хранит продукты склада и отдаёт их обратно; продукт чужого бизнеса: отказ', async () => {
    const g = await at(() =>
      mods.createGroup({
        name: 'Добавки',
        minSelect: 0,
        maxSelect: 3,
        modifiers: [
          { name: 'Молоко', priceDeltaMinor: 20000, ingredients: [{ productId: ids.milk, normQty: '50' }] },
          { name: 'Сироп', priceDeltaMinor: 15000, ingredients: [{ productId: ids.syrup, normQty: '20' }] },
          { name: 'Двойной', priceDeltaMinor: 30000, ingredients: [{ productId: ids.beans, normQty: '18' }, { productId: ids.milk, normQty: '30' }] },
        ],
      }),
    );
    ids.extras = g.id;
    [ids.milkMod, ids.syrupMod, ids.bigMod] = g.modifiers.map((m) => m.id) as [string, string, string];
    expect(g.modifiers.map((m) => [m.name, m.ingredients.map((i) => [i.productName, i.unit, i.normQty])])).toEqual([
      ['Молоко', [['Молоко', 'мл', '50']]],
      ['Сироп', [['Сироп', 'мл', '20']]],
      ['Двойной', [['Кофе зерно', 'г', '18'], ['Молоко', 'мл', '30']]],
    ]);
    await at(() => mods.setItemGroups(ids.coffee, { groupIds: [ids.extras] }));
    await expect(
      at(() => mods.createGroup({ name: 'Чужое', modifiers: [{ name: 'X', priceDeltaMinor: 0, ingredients: [{ productId: ids.foreignMilk, normQty: '1' }] }] })),
    ).rejects.toThrow(/продукт склада не найден/);
    // правка без поля ingredients оставляет продукты; пустой список снимает
    const kept = await at(() => mods.updateGroup(ids.extras, { modifiers: g.modifiers.map((m) => ({ id: m.id, name: m.name, priceDeltaMinor: Number(m.priceDeltaMinor) })) }));
    expect(kept.modifiers[0]!.ingredients).toHaveLength(1);
  });

  it('«Готово»: кофе 2 шт с молоком и сиропом списывает зерно, молоко FIFO и сироп; отмена возвращает всё', async () => {
    const o = await at(() => svc.createOrder({ tableId: ids.table, guestCount: 1, items: [{ menuItemId: ids.coffee, qty: 2, modifierIds: [ids.milkMod, ids.syrupMod] }] }));
    const ready = await step(await step(o, 'COOKING'), 'READY');
    expect(await onHand()).toMatchObject({ 'Кофе зерно': '964', Молоко: '1000', Сироп: '460' });
    const moves = await db.kitchenStockMovement.findMany({ where: { orderId: o.id, kind: 'CONSUMPTION' } });
    // молоко 100 мл: сначала вся старая партия (100 мл по 500 ₸/л = 5 000 тиынов)
    const milk = moves.filter((m) => m.productId === ids.milk);
    expect(milk.map((m) => [m.qty.toString(), m.cost.toString()])).toEqual([['-100', '-5000']]);
    expect(milk[0]!.reason).toBe(`Заказ №${o.number}`);
    await step(ready, 'CANCELLED');
    expect(await onHand()).toMatchObject({ 'Кофе зерно': '1000', Молоко: '1100', Сироп: '500' });
  });

  it('добавка из двух продуктов («Двойной»: зерно и молоко) складывается с техкартой блюда', async () => {
    const o = await at(() => svc.createOrder({ tableId: ids.table, guestCount: 1, items: [{ menuItemId: ids.coffee, qty: 1, modifierIds: [ids.bigMod, ids.milkMod] }] }));
    await step(await step(o, 'COOKING'), 'READY');
    expect(await onHand()).toMatchObject({ 'Кофе зерно': '964', Молоко: '1020' });
  });
});
