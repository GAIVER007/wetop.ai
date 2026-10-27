/**
 * Официант с телефона (решение владельца 22.10.2026, docs/decisions/2026-10-22-waiter-stations.md, DATA_MODEL §33.6) на
 * настоящем HTTP: «Личный кабинет» (EMPLOYEE) ресторана с правом `orders` открывает заказ на стол только на себя,
 * дозаказывает, подаёт, видит только свои заказы и бронирует стол (бронь помнит, кто принял). Касса, оплата, отчёты,
 * зарплата, гости, чужие заказы и статус заказа целиком ему закрыты.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
// приложение мира поднято в scope-world.ts через `listen(0, '127.0.0.1')` (сторож supertest-loopback)
import { hashPassword } from '@pms/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, type ScopeWorld } from './scope-world';
import { openTestShift } from '../../tools/test-shift';

const ENABLED = !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)('«Личный кабинет» ресторана принимает заказы только на себя (HTTP + база + RLS)', () => {
  let w: ScopeWorld;
  let token = '';
  let userId = '';
  const ids = { me: '', other: '', table: '', tea: '', soup: '', period: '', foreignOrder: '' };
  const pointer = () => `business=${w.ids.foo};location=${w.ids.lf}`;
  const call = (method: 'get' | 'post' | 'patch' | 'put', path: string, body?: unknown) => {
    let req = request(w.app.getHttpServer())[method](path).set('Authorization', `Bearer ${token}`).set('X-Wetop-Scope', pointer());
    if (body !== undefined) req = req.send(body as object);
    return req;
  };

  beforeAll(async () => {
    w = await buildScopeWorld();
    const password = randomBytes(24).toString('base64url') + 'aA1!';
    const user = await w.db.user.create({
      data: { email: `waiter-${w.ids.m}@example.invalid`, emailVerifiedAt: new Date(), passwordHash: await hashPassword(password), name: 'Официант Тест' },
    });
    userId = user.id;
    await w.db.membership.create({ data: { organizationId: w.ids.orgA!, userId, role: 'EMPLOYEE' } });
    await w.db.membershipScope.create({
      data: { organizationId: w.ids.orgA!, userId, role: 'EMPLOYEE', businessId: w.ids.foo!, locationId: w.ids.lf! },
    });
    ids.me = (await w.db.employee.create({ data: { businessId: w.ids.foo!, name: 'Официант Тест', userId, personnelKind: 'OTHER_EMPLOYEE' } })).id;
    ids.other = (await w.db.employee.create({ data: { businessId: w.ids.foo!, name: 'Другой Официант', personnelKind: 'OTHER_EMPLOYEE' } })).id;
    for (const employeeId of [ids.me, ids.other]) await w.db.employeeLocation.create({ data: { employeeId, locationId: w.ids.lf! } });
    // официант принимает заказы в открытую смену филиала (владелец 27.10.2026, finance/shift-guard)
    await openTestShift(w.db, { organizationId: w.ids.orgA!, userId, locationId: w.ids.lf! });
    const area = await w.db.diningArea.create({ data: { locationId: w.ids.lf!, name: 'Зал' } });
    ids.table = (await w.db.diningTable.create({ data: { areaId: area.id, name: '5', capacity: 4 } })).id;
    const bar = await w.db.menuCategory.create({ data: { businessId: w.ids.foo!, name: 'Чай', station: 'BAR' } });
    const hot = await w.db.menuCategory.create({ data: { businessId: w.ids.foo!, name: 'Горячее' } });
    ids.tea = (await w.db.menuItem.create({ data: { businessId: w.ids.foo!, categoryId: bar.id, name: 'Чай зелёный', price: 70000n, currency: 'KZT' } })).id;
    ids.soup = (await w.db.menuItem.create({ data: { businessId: w.ids.foo!, categoryId: hot.id, name: 'Лагман', price: 220000n, currency: 'KZT' } })).id;
    ids.period = (
      await w.db.servicePeriod.create({
        data: { locationId: w.ids.lf!, name: 'Весь день', weekday: 4, timeFrom: new Date('1970-01-01T00:00:00Z'), timeTo: new Date('1970-01-01T23:59:00Z'), defaultDurationMinutes: 60 },
      })
    ).id;
    ids.foreignOrder = (
      await w.db.restaurantOrder.create({
        data: { locationId: w.ids.lf!, number: 900, waiterId: ids.other, total: 70000n, currency: 'KZT', items: { create: [{ menuItemId: ids.tea, name: 'Чай зелёный', price: 70000n, qty: 1, station: 'BAR' }] } },
      })
    ).id;
    const login = await request(w.app.getHttpServer()).post('/auth/login').send({ email: user.email, password });
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    token = login.body.token as string;
  }, 180_000);

  afterAll(async () => {
    if (w) await w.close();
  }, 60_000);

  it('видит столы зала и меню со станциями', async () => {
    const tables = await call('get', '/food-service/waiter/tables');
    expect(tables.status, tables.text.slice(0, 300)).toBe(200);
    const body = tables.body as { me: { id: string } | null; tables: Array<{ id: string; busy: boolean; mine: boolean }> };
    expect(body.me?.id).toBe(ids.me);
    expect(body.tables.map((t) => t.id)).toEqual([ids.table]);
    const cats = await call('get', '/food-service/menu/categories');
    expect(cats.status).toBe(200);
    expect((cats.body as { items: Array<{ name: string; station: string }> }).items.map((c) => `${c.name}:${c.station}`).sort()).toEqual(['Горячее:KITCHEN', 'Чай:BAR']);
    expect((await call('get', '/food-service/menu/items')).status).toBe(200);
  });

  let order: { id: string; status: string; updatedAt: string; waiter: { id: string }; items: Array<{ id: string; menuItemId: string; station: string; status: string }> };
  it('создаёт заказ на стол: официант принудительно он сам, позиции на своих станциях', async () => {
    const r = await call('post', '/food-service/orders', {
      tableId: ids.table,
      waiterId: ids.other,
      guestCount: 2,
      items: [
        { menuItemId: ids.tea, qty: 1 },
        { menuItemId: ids.soup, qty: 1 },
      ],
    });
    expect(r.status, r.text.slice(0, 300)).toBe(201);
    order = r.body;
    expect(order.waiter.id).toBe(ids.me);
    expect(order.items.map((i) => i.station).sort()).toEqual(['BAR', 'KITCHEN']);
    const busy = await call('get', '/food-service/waiter/tables');
    expect((busy.body as { tables: Array<{ busy: boolean; mine: boolean }> }).tables[0]).toMatchObject({ busy: true, mine: true });
  });

  it('видит только свои открытые заказы, чужой не меняет', async () => {
    const r = await call('get', '/food-service/orders?open=1');
    expect(r.status).toBe(200);
    expect((r.body as { items: Array<{ id: string }> }).items.map((o) => o.id)).toEqual([order.id]);
    const foreign = await w.db.restaurantOrder.findUniqueOrThrow({ where: { id: ids.foreignOrder } });
    const patch = await call('patch', `/food-service/orders/${ids.foreignOrder}`, {
      expectedStatus: foreign.status,
      expectedUpdatedAt: foreign.updatedAt.toISOString(),
      guestCount: 3,
    });
    expect(patch.status).toBe(404);
  });

  it('дозаказывает к своему заказу и подаёт готовую позицию, но не готовит за кухню', async () => {
    const add = await call('patch', `/food-service/orders/${order.id}`, {
      expectedStatus: order.status,
      expectedUpdatedAt: order.updatedAt,
      items: [
        { menuItemId: ids.tea, qty: 2 },
        { menuItemId: ids.soup, qty: 1 },
      ],
    });
    expect(add.status, add.text.slice(0, 300)).toBe(200);
    order = add.body;
    const tea = order.items.find((i) => i.menuItemId === ids.tea)!;
    const cook = await call('post', `/food-service/orders/${order.id}/items/${tea.id}/status`, { status: 'READY', expectedUpdatedAt: order.updatedAt });
    expect(cook.status).toBe(403);
    // бар (стойка) отдал чай
    await w.db.restaurantOrderItem.update({ where: { id: tea.id }, data: { status: 'READY', readyAt: new Date() } });
    const fresh = await w.db.restaurantOrder.findUniqueOrThrow({ where: { id: order.id } });
    const served = await call('post', `/food-service/orders/${order.id}/items/${tea.id}/status`, { status: 'SERVED', expectedUpdatedAt: fresh.updatedAt.toISOString() });
    expect(served.status, served.text.slice(0, 300)).toBe(200);
    expect((served.body as typeof order).items.find((i) => i.id === tea.id)!.status).toBe('SERVED');
  });

  it('бронирует стол: бронь помнит его как принявшего, в списке только свои брони', async () => {
    const startsAt = (() => {
  // полдень по Алматы через 2 суток: «сейчас + N часов» в 23:00+ по Алматы выводило бронь за период 00:00–23:59
  // (CI 22.10.2026 16:38 UTC: «Бронь не помещается в период обслуживания»)
  const d = new Date(Date.now() + 2 * 86_400_000);
  return new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(d)}T12:00:00+05:00`);
})();
    const period = await w.db.servicePeriod.update({ where: { id: ids.period }, data: { weekday: new Date(startsAt.getTime() + 5 * 3_600_000).getUTCDay() } });
    expect(period.id).toBe(ids.period);
    const r = await request(w.app.getHttpServer())
      .post('/food-service/reservations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Wetop-Scope', pointer())
      .set('Idempotency-Key', randomUUID())
      .send({ servicePeriodId: ids.period, startsAt: startsAt.toISOString(), partySize: 2, tableId: ids.table, customer: { firstName: 'Гость Тест', phone: '+77010000099' } });
    expect(r.status, r.text.slice(0, 300)).toBe(201);
    expect((r.body as { employee: { id: string; name: string } | null }).employee).toEqual({ id: ids.me, name: 'Официант Тест' });
    const row = await w.db.restaurantReservation.findUniqueOrThrow({ where: { id: (r.body as { id: string }).id } });
    expect(row.employeeId).toBe(ids.me);
  });

  it.each([
    ['get', '/food-service/cash'],
    ['get', '/food-service/report?date=2026-10-22'],
    ['get', '/food-service/period-report?from=2026-10-01&to=2026-10-31'],
    ['get', '/food-service/payroll?month=2026-10'],
    ['get', '/food-service/staff-revenue'],
    ['get', '/food-service/customers'],
    ['get', '/food-service/employees'],
  ] as const)('закрыто: %s %s', async (method, path) => {
    const r = await call(method, path);
    expect(r.status, r.text.slice(0, 200)).toBe(403);
  });

  it('закрыто: оплата заказа и статус заказа целиком', async () => {
    const fresh = await w.db.restaurantOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect((await call('post', `/food-service/orders/${order.id}/payments`, { method: 'CASH', amount: 1000, idempotencyKey: randomUUID() })).status).toBe(403);
    expect(
      (await call('post', `/food-service/orders/${order.id}/status`, { expectedStatus: fresh.status, expectedUpdatedAt: fresh.updatedAt.toISOString(), status: 'CANCELLED' })).status,
    ).toBe(403);
  });
});
