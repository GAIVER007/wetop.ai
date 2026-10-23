import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Станции ресторана (DATA_MODEL §33.6, миграция 142): строка заказа получает станцию категории, кухня и бар двигают
 * свои строки, статус заказа выводится из строк, склад списывается по строке при «Готово» ровно один раз, прежнее
 * действие со статусом заказа целиком двигает все строки. Вымышленные данные (ADR-010).
 */
describe('станции ресторана: строки заказа (integration, §33.6)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: RestaurantService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location = randomUUID();
  const ids = { tea: '', soup: '', teaLeaf: '', beef: '', table: '' };
  const at = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', businessId: business, locationId: location, vertical: 'FOOD_SERVICE' },
      fn,
    );
  type View = Awaited<ReturnType<RestaurantService['createOrder']>>;
  const create = (items: Array<{ menuItemId: string; qty: number }>) =>
    at(() => svc.createOrder({ tableId: ids.table, guestCount: 2, items }));
  const item = (o: View, menuItemId: string) => o.items.find((i) => i.menuItemId === menuItemId)!;
  const move = (o: View, itemId: string, status: string) =>
    at(() => svc.orderItemStatus(o.id, itemId, { status, expectedUpdatedAt: o.updatedAt.toISOString() }));
  const consumed = async (orderId: string, productId: string) =>
    (await db.kitchenStockMovement.findMany({ where: { orderId, productId } })).reduce((s, m) => s + Number(m.qty), 0);

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: org, name: 'Станции', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `stations-${user}@example.invalid` } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Synthetic food', vertical: 'FOOD_SERVICE' } });
    await db.location.create({ data: { id: location, businessId: business, name: 'Synthetic branch', timezone: 'Asia/Almaty', currency: 'KZT' } });
    const area = await db.diningArea.create({ data: { locationId: location, name: 'Зал' } });
    ids.table = (await db.diningTable.create({ data: { areaId: area.id, name: '1', capacity: 4 } })).id;
    // категория «Чай» станет баром по выбору, «Горячее» остаётся кухней по умолчанию
    const drinks = await at(() => svc.createCategory({ name: 'Напитки дня', station: 'BAR' }));
    const hot = await at(() => svc.createCategory({ name: 'Горячее' }));
    expect(drinks.station).toBe('BAR');
    expect(hot.station).toBe('KITCHEN');
    ids.tea = (await db.menuItem.create({ data: { businessId: business, categoryId: drinks.id, name: 'Чай чёрный', price: 80000n, currency: 'KZT' } })).id;
    ids.soup = (await db.menuItem.create({ data: { businessId: business, categoryId: hot.id, name: 'Борщ', price: 250000n, currency: 'KZT' } })).id;
    ids.teaLeaf = (await db.kitchenProduct.create({ data: { businessId: business, name: 'Заварка', unit: 'г' } })).id;
    ids.beef = (await db.kitchenProduct.create({ data: { businessId: business, name: 'Говядина', unit: 'г' } })).id;
    for (const productId of [ids.teaLeaf, ids.beef])
      await db.kitchenStockLot.create({
        data: { locationId: location, productId, receivedOn: new Date('2026-10-20'), receivedQty: '10000', remainingQty: '10000', unitCost: 100000n },
      });
    await db.menuItemIngredient.create({ data: { menuItemId: ids.tea, name: 'Заварка', normQty: '5', unit: 'г', unitCost: 100000n, productId: ids.teaLeaf } });
    await db.menuItemIngredient.create({ data: { menuItemId: ids.soup, name: 'Говядина', normQty: '150', unit: 'г', unitCost: 100000n, productId: ids.beef } });
  });
  afterAll(async () => db?.$disconnect());

  it('строки получают станцию категории; бар и кухня двигают свои; статус заказа из строк; склад по строке один раз', async () => {
    const o = await create([
      { menuItemId: ids.tea, qty: 2 },
      { menuItemId: ids.soup, qty: 1 },
    ]);
    expect(o.status).toBe('NEW');
    expect(item(o, ids.tea)).toMatchObject({ station: 'BAR', status: 'NEW', readyAt: null });
    expect(item(o, ids.soup)).toMatchObject({ station: 'KITCHEN', status: 'NEW' });

    // бар сразу отдаёт чай: строка готова, заказ в работе (кухня не начала), склад списан только по чаю
    const a = await move(o, item(o, ids.tea).id, 'READY');
    expect(item(a, ids.tea).status).toBe('READY');
    expect(item(a, ids.tea).readyAt).not.toBeNull();
    expect(a.status).toBe('COOKING');
    expect(await consumed(o.id, ids.teaLeaf)).toBe(-10);
    expect(await consumed(o.id, ids.beef)).toBe(0);

    // повтор «Готово» по той же строке недоступен: второго списания нет
    await expect(move(a, item(a, ids.tea).id, 'READY')).rejects.toThrow('Переход позиции недоступен');
    // устаревшая отметка заказа: конфликт
    await expect(move(o, item(o, ids.soup).id, 'COOKING')).rejects.toThrow('обновите данные');

    const b = await move(a, item(a, ids.soup).id, 'COOKING');
    expect(b.status).toBe('COOKING');
    const c = await move(b, item(b, ids.soup).id, 'READY');
    expect(c.status).toBe('READY');
    expect(c.readyAt).not.toBeNull();
    expect(await consumed(o.id, ids.beef)).toBe(-150);
    expect(await consumed(o.id, ids.teaLeaf)).toBe(-10);

    // официант подаёт чай, затем борщ: заказ «Подан» после последней строки
    const d = await move(c, item(c, ids.tea).id, 'SERVED');
    expect(d.status).toBe('READY');
    const e = await move(d, item(d, ids.soup).id, 'SERVED');
    expect(e.status).toBe('SERVED');
    expect(e.servedAt).not.toBeNull();
    // чужая строка у заказа не найдена
    await expect(move(e, randomUUID(), 'SERVED')).rejects.toThrow('Позиция не найдена');
  });

  it('прежнее действие со статусом заказа двигает все строки, склад не списывает второй раз', async () => {
    const o = await create([
      { menuItemId: ids.tea, qty: 1 },
      { menuItemId: ids.soup, qty: 2 },
    ]);
    const a = await move(o, item(o, ids.tea).id, 'READY');
    expect(await consumed(o.id, ids.teaLeaf)).toBe(-5);
    const status = (v: View, next: string) =>
      at(() => svc.orderStatus(v.id, { expectedStatus: v.status, expectedUpdatedAt: v.updatedAt.toISOString(), status: next }));
    const b = await status(a, 'READY');
    expect(b.status).toBe('READY');
    expect(b.items.map((i) => i.status)).toEqual(['READY', 'READY']);
    expect(await consumed(o.id, ids.teaLeaf)).toBe(-5);
    expect(await consumed(o.id, ids.beef)).toBe(-300);
    const c = await status(b, 'SERVED');
    expect(c.items.map((i) => i.status)).toEqual(['SERVED', 'SERVED']);

    // NEW → COOKING целиком: все новые строки в работе
    const n = await create([{ menuItemId: ids.soup, qty: 1 }]);
    const m = await status(n, 'COOKING');
    expect(m.items.map((i) => i.status)).toEqual(['COOKING']);
    // отмена после частичной готовности возвращает списанное
    const t = await create([
      { menuItemId: ids.tea, qty: 1 },
      { menuItemId: ids.soup, qty: 1 },
    ]);
    const t1 = await move(t, item(t, ids.tea).id, 'READY');
    expect(await consumed(t.id, ids.teaLeaf)).toBe(-5);
    await status(t1, 'CANCELLED');
    expect(await consumed(t.id, ids.teaLeaf)).toBe(0);
  });

  it('дозаказ к готовому заказу: новая строка на своей станции, готовые строки остаются, заказ снова в работе', async () => {
    const o = await create([{ menuItemId: ids.tea, qty: 1 }]);
    const a = await move(o, item(o, ids.tea).id, 'READY');
    expect(a.status).toBe('READY');
    const readyId = item(a, ids.tea).id;
    const b = await at(() =>
      svc.updateOrder(a.id, {
        expectedStatus: a.status,
        expectedUpdatedAt: a.updatedAt.toISOString(),
        items: [
          { menuItemId: ids.tea, qty: 1 },
          { menuItemId: ids.soup, qty: 1 },
        ],
      }),
    );
    expect(b.status).toBe('COOKING');
    expect(b.items).toHaveLength(2);
    expect(b.items.find((i) => i.id === readyId)).toMatchObject({ status: 'READY', station: 'BAR' });
    expect(item(b, ids.soup)).toMatchObject({ station: 'KITCHEN', status: 'NEW' });
    expect(b.totalMinor).toBe('330000');
    // уменьшить готовую позицию нельзя: она уже приготовлена и списана со склада
    await expect(
      at(() =>
        svc.updateOrder(b.id, {
          expectedStatus: b.status,
          expectedUpdatedAt: b.updatedAt.toISOString(),
          items: [{ menuItemId: ids.soup, qty: 1 }],
        }),
      ),
    ).rejects.toThrow('Готовые позиции убрать нельзя');
  });

  it('станция строки это снимок: перенос категории на бар не трогает уже отправленные строки', async () => {
    const hot = await db.menuCategory.findFirstOrThrow({ where: { businessId: business, name: 'Горячее' } });
    const o = await create([{ menuItemId: ids.soup, qty: 1 }]);
    const moved = await at(() => svc.updateCategory(hot.id, { station: 'BAR' }));
    expect(moved.station).toBe('BAR');
    const rows = await db.restaurantOrderItem.findMany({ where: { orderId: o.id } });
    expect(rows.map((r) => r.station)).toEqual(['KITCHEN']);
    await at(() => svc.updateCategory(hot.id, { station: 'KITCHEN' }));
  });
});
