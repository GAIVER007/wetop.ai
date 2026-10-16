import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Возврат по закрытому заказу ресторана (DATA_MODEL §56): расход кассы филиала со ссылкой на заказ, только после
 * закрытия, с причиной, не больше чистой оплаты и остатка способа, повтор по ключу; ошибочный возврат аннулируется.
 * Вымышленные данные (ADR-010).
 */
describe('возврат по закрытому заказу (integration, §56)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: RestaurantService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location = randomUUID(),
    other = randomUUID();
  const at = <T>(locationId: string, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', businessId: business, locationId, vertical: 'FOOD_SERVICE' },
      fn,
    );
  let nextNumber = 1;
  const served = (locationId: string, total: bigint) =>
    db.restaurantOrder.create({
      data: { locationId, number: nextNumber++, guestCount: 2, status: 'SERVED', total, currency: 'KZT', openedAt: new Date(), servedAt: new Date() },
    });
  const pay = (id: string, amount: number, method = 'CASH') =>
    at(location, () => svc.payOrder(id, { method, amount, idempotencyKey: randomUUID() }));
  const refund = (id: string, amount: number, method = 'CASH', reason: unknown = 'Блюдо остыло', idempotencyKey: string = randomUUID()) =>
    at(location, () => svc.refundOrder(id, { method, amount, reason, idempotencyKey }));

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: org, name: 'Возврат заказа', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `refund-${user}@example.invalid` } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Synthetic food', vertical: 'FOOD_SERVICE' } });
    await db.location.createMany({
      data: [location, other].map((id) => ({ id, businessId: business, name: 'Synthetic branch', timezone: 'Asia/Almaty', currency: 'KZT' })),
    });
  });
  afterAll(async () => db?.$disconnect());

  it('до закрытия возврата нет; после: с причиной, не больше чистой оплаты и остатка способа, повтор по ключу', async () => {
    const o = await served(location, 300000n);
    await pay(o.id, 100000, 'CASH');
    await expect(refund(o.id, 1000)).rejects.toThrow('Возврат оформляют по закрытому заказу');
    const closed = await pay(o.id, 200000, 'KASPI');
    expect(closed).toMatchObject({ status: 'CLOSED', paidMinor: '300000', refundedMinor: '0' });
    await expect(refund(o.id, 1000, 'CASH', '   ')).rejects.toThrow();
    const key = randomUUID();
    await refund(o.id, 50000, 'CASH', 'Блюдо остыло', key);
    const replay = await refund(o.id, 50000, 'CASH', 'Блюдо остыло', key);
    expect(replay).toMatchObject({ refundedMinor: '50000' });
    expect(replay.refunds).toHaveLength(1);
    expect(replay.refunds[0]!.note).toContain('Причина: Блюдо остыло');
    await expect(refund(o.id, 250001, 'KASPI')).rejects.toThrow('Сумма больше оплаченного по заказу');
    // наличных в кассе 100 000 − 50 000 = 50 000: вернуть 60 000 наличными нельзя
    await expect(refund(o.id, 60000, 'CASH')).rejects.toThrow('В кассе по этому способу меньше этой суммы');
    // ошибочный возврат аннулируется в кассе; платёж закрытого заказа по-прежнему нет
    const op = await db.restaurantCashOperation.findFirstOrThrow({ where: { orderId: o.id } });
    await at(location, () => svc.voidCashOperation(op.id));
    const payment = await db.restaurantPayment.findFirstOrThrow({ where: { orderId: o.id, status: 'COMPLETED' } });
    await expect(at(location, () => svc.voidPayment(payment.id, { reason: 'ошибка' }))).rejects.toThrow('Заказ закрыт');
    const after = await db.restaurantOrder.findUniqueOrThrow({ where: { id: o.id }, include: { refunds: true } });
    expect(after.refunds.map((r) => r.status)).toEqual(['VOIDED']);
  });

  it('база: возврат только расходом и только по заказу своего филиала, ссылка не меняется', async () => {
    const o = await served(location, 1000n);
    const base = { method: 'CASH' as const, amount: 1n, currency: 'KZT', orderId: o.id };
    await expect(db.restaurantCashOperation.create({ data: { ...base, locationId: location, kind: 'INCOME' } })).rejects.toThrow(
      /restaurant_cash_operations_order/,
    );
    await expect(db.restaurantCashOperation.create({ data: { ...base, locationId: other, kind: 'EXPENSE' } })).rejects.toThrow(
      /Order refund belongs to another location/,
    );
    const op = await db.restaurantCashOperation.create({ data: { ...base, locationId: location, kind: 'EXPENSE' } });
    await expect(db.restaurantCashOperation.update({ where: { id: op.id }, data: { orderId: null } })).rejects.toThrow(/immutable/);
  });
});
