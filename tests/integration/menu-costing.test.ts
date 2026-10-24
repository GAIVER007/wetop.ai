import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { MenuModifiersService } from '../../apps/api/src/food-service/modifiers';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Себестоимость и маржа меню (DATA_MODEL §62.4, срез K4): цена продукта со склада кухни (средняя по остатку партий),
 * заготовка по цене своих партий, без склада цена техкарты; добавки отдельно. Салон и гостиница. Вымышленные данные.
 */
describe('себестоимость меню (integration, §62.4)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const stock = new StockService(prisma);
  const menu = new RestaurantService(prisma, null, stock);
  const mods = new MenuModifiersService(prisma);
  const tag = randomUUID().slice(0, 8);
  const mk = (vertical: 'BEAUTY' | 'HOSPITALITY') => ({ vertical, org: randomUUID(), business: randomUUID(), location: randomUUID(), user: randomUUID() });
  const salon = mk('BEAUTY');
  const as = <T>(b: ReturnType<typeof mk>, fn: () => Promise<T>) =>
    withSignedInUser({ userId: b.user, organizationId: b.org, role: 'OWNER', scope: 'LOCATION', vertical: b.vertical, businessId: b.business, locationId: b.location }, fn);
  let coffee = '';
  let tea = '';

  beforeAll(async () => {
    const b = salon;
    await prisma.db.user.create({ data: { id: b.user, email: `costing-${b.user}@example.invalid`, name: 'Владелец' } });
    await prisma.db.organization.create({ data: { id: b.org, name: `Себестоимость ${tag}`, status: 'ACTIVE' } });
    await prisma.db.business.create({ data: { id: b.business, organizationId: b.org, name: `Салон ${tag}`, vertical: b.vertical } });
    await prisma.db.location.create({ data: { id: b.location, businessId: b.business, name: `Филиал ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    const beans = (await as(b, () => stock.createProduct({ name: 'Кофе зерно', unit: 'г' }))).id;
    const milk = (await as(b, () => stock.createProduct({ name: 'Молоко', unit: 'мл' }))).id;
    // две партии зерна: 600 г по 10 000 ₸/кг и 400 г по 15 000 ₸/кг, средняя 12 000 ₸/кг
    await as(b, () => stock.receipt({ lines: [{ productId: beans, qty: '600', unitCost: 1_000_000 }] }));
    await as(b, () => stock.receipt({ lines: [{ productId: beans, qty: '400', unitCost: 1_500_000 }, { productId: milk, qty: '1000', unitCost: 60_000 }] }));
    const cat = await as(b, () => menu.createCategory({ name: 'Кофе', station: 'BAR' }));
    coffee = (await as(b, () => menu.createMenuItem({ categoryId: cat.id, name: 'Американо', price: 80000 }))).id;
    // в техкарте записана старая цена 10 000 ₸/кг: отчёт берёт склад
    await as(b, () => menu.replaceIngredients(coffee, { ingredients: [{ name: 'Кофе', normQty: '18', unit: 'г', unitCost: 1_000_000, productId: beans }] }));
    const group = await as(b, () => mods.createGroup({ name: 'Добавки', minSelect: 0, maxSelect: 2, modifiers: [{ name: 'Молоко', priceDeltaMinor: 20000, ingredients: [{ productId: milk, normQty: '50' }] }] }));
    await as(b, () => mods.setItemGroups(coffee, { groupIds: [group.id] }));
    tea = (await as(b, () => menu.createMenuItem({ categoryId: cat.id, name: 'Чай', price: 50000 }))).id;
    await as(b, () => menu.replaceIngredients(tea, { ingredients: [{ name: 'Чай листовой', normQty: '5', unit: 'г', unitCost: 400_000 }] }));
  });
  afterAll(async () => prisma.onModuleDestroy());

  it('кофе: 18 г по средней 12 000 ₸/кг = 216 ₸, прибыль 584 ₸; молоко +200 ₸ стоит 30 ₸; чай по техкарте 20 ₸', async () => {
    const r = await as(salon, () => menu.menuCosting());
    expect(r.currency).toBe('KZT');
    const c = r.items.find((i) => i.id === coffee)!;
    expect(c).toMatchObject({ priceMinor: '80000', costMinor: '21600', profitMinor: '58400', foodCostPct: 27, marginPct: 270, missing: [] });
    expect(c.lines).toEqual([{ name: 'Кофе', normQty: '18', unit: 'г', costMinor: '21600', source: 'STOCK' }]);
    expect(c.modifiers).toEqual([{ id: expect.any(String), name: 'Молоко', priceDeltaMinor: '20000', costMinor: '3000', profitMinor: '17000' }]);
    const t = r.items.find((i) => i.id === tea)!;
    expect(t).toMatchObject({ costMinor: '2000', profitMinor: '48000', foodCostPct: 4 });
    expect(t.lines[0]!.source).toBe('CARD');
  });

  it('отчёт только читает: склад и техкарты не меняются', async () => {
    const before = await prisma.db.kitchenStockMovement.count({ where: { locationId: salon.location } });
    await as(salon, () => menu.menuCosting());
    expect(await prisma.db.kitchenStockMovement.count({ where: { locationId: salon.location } })).toBe(before);
  });
});
