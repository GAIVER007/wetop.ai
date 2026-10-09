import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { FoodModule } from '../../apps/api/src/food-service/food.module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { FoodService } from '../../apps/api/src/food-service/food.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('MV6 real PostgreSQL', () => {
  let db: Db, svc: FoodService, app: INestApplication, base: string;
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    business2 = randomUUID(),
    location = randomUUID(),
    location2 = randomUUID(),
    otherLocation = randomUUID(),
    customer = randomUUID();
  const actor = {
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId: location,
    vertical: 'FOOD_SERVICE' as const,
  };
  type Actor = Exclude<Parameters<typeof withSignedInUser>[0], string | null>;
  const run = <T>(
    fn: () => Promise<T>,
    patch: Partial<Omit<Actor, 'businessId' | 'locationId'>> & {
      businessId?: string | null;
      locationId?: string | null;
    } = {},
  ) =>
    withSignedInUser(
      (() => {
        const { businessId, locationId, ...rest } = { ...actor, ...patch };
        return {
          ...rest,
          ...(businessId ? { businessId } : {}),
          ...(locationId ? { locationId } : {}),
        };
      })(),
      fn,
    );
  let area: string, table: string, table2: string, period: string;
  const input = (extra: Record<string, unknown> = {}) => ({
    servicePeriodId: period,
    startsAt: '2026-10-12T18:00:00+05:00',
    partySize: 2,
    customerId: customer,
    ...extra,
  });
  const token = (r: { status: string; updatedAt: Date | string }) => ({
    expectedStatus: r.status,
    expectedUpdatedAt: new Date(r.updatedAt).toISOString(),
  });
  const book = (extra: Record<string, unknown> = {}, key = randomUUID()) =>
    run(() => svc.create(key, input(extra)));
  beforeAll(async () => {
    db = createPrismaClient(url);
    svc = new FoodService({ db } as PrismaService);
    const module = await Test.createTestingModule({ imports: [FoodModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .compile();
    app = module.createNestApplication();
    app.use(
      (
        req: { user?: object; headers: Record<string, string> },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = {
          id: user,
          organizationId: org,
          role: req.headers['x-test-role'] === 'STAFF' ? 'STAFF' : 'OWNER',
        };
        next();
      },
    );
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    await db.organization.createMany({
      data: [org, foreignOrg].map((id) => ({ id, name: 'MV6 synthetic', status: 'ACTIVE' })),
    });
    await db.user.create({
      data: { id: user, name: 'Synthetic owner', email: `mv6-${user}@example.invalid` },
    });
    await db.business.createMany({
      data: [business, business2].map((id) => ({
        id,
        organizationId: org,
        name: 'Synthetic food',
        vertical: 'FOOD_SERVICE',
      })),
    });
    await db.location.createMany({
      data: [
        [location, business],
        [location2, business],
        [otherLocation, business2],
      ].map(([id, businessId]) => ({
        id: id!,
        businessId: businessId!,
        name: 'Synthetic branch',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      })),
    });
    await db.customer.create({
      data: { id: customer, organizationId: org, firstName: 'Synthetic customer' },
    });
  });
  beforeEach(async () => {
    await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
    await db.business.update({
      where: { id: business },
      data: { status: 'ACTIVE', vertical: 'FOOD_SERVICE' },
    });
    await db.location.update({ where: { id: location }, data: { status: 'ACTIVE' } });
    await db.customer.update({ where: { id: customer }, data: { status: 'ACTIVE' } });
    await db.$transaction(async (tx) => {
      await tx.restaurantReservation.updateMany({
        where: { location: { business: { organizationId: org } } },
        data: { status: 'CANCELLED' },
      });
      await tx.tableAssignment.deleteMany({
        where: { reservation: { location: { business: { organizationId: org } } } },
      });
      await tx.restaurantReservation.deleteMany({
        where: { location: { business: { organizationId: org } } },
      });
    });
    area = (await run(() => svc.createCatalog('area', { name: 'Main' }))).id;
    table = (await run(() => svc.createCatalog('table', { areaId: area, name: 'A', capacity: 4 })))
      .id;
    table2 = (await run(() => svc.createCatalog('table', { areaId: area, name: 'B', capacity: 6 })))
      .id;
    period = (
      await run(() =>
        svc.createCatalog('period', {
          name: 'Dinner',
          weekday: 1,
          timeFrom: '18:00',
          timeTo: '02:00',
          endsNextDay: true,
          defaultDurationMinutes: 120,
        }),
      )
    ).id;
  });
  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await db.$transaction(async (tx) => {
      const own = { location: { business: { organizationId: org } } };
      await tx.restaurantReservation.updateMany({ where: own, data: { status: 'CANCELLED' } });
      await tx.tableAssignment.deleteMany({ where: { reservation: own } });
      await tx.restaurantReservation.deleteMany({ where: own });
      await tx.diningTable.deleteMany({ where: { area: own } });
      await tx.diningArea.deleteMany({ where: own });
      await tx.servicePeriod.deleteMany({ where: own });
      await tx.customerBusiness.deleteMany({ where: { business: { organizationId: org } } });
      await tx.customer.deleteMany({ where: { organizationId: { in: [org, foreignOrg] } } });
      await tx.location.deleteMany({ where: { business: { organizationId: org } } });
      await tx.business.deleteMany({ where: { organizationId: org } });
      await tx.$queryRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
      await tx.user.delete({ where: { id: user } });
      await tx.organization.deleteMany({ where: { id: { in: [org, foreignOrg] } } });
    });
    await db.$disconnect();
  });
  it('unassigned booking, assignment, move, confirm, seat, complete and persisted list', async () => {
    let r = await book();
    expect(r.table).toBeNull();
    r = await run(() => svc.assign(r.id, { ...token(r), tableId: table }));
    expect(r.table?.id).toBe(table);
    r = await run(() => svc.update(r.id, { ...token(r), startsAt: '2026-10-12T19:00:00+05:00' }));
    expect(new Date(r.endsAt).toISOString()).toBe('2026-10-12T16:00:00.000Z');
    for (const status of ['CONFIRMED', 'SEATED', 'COMPLETED'])
      r = await run(() => svc.status(r.id, { ...token(r), status }));
    expect(
      (await run(() => svc.reservations({ date: '2026-10-12' }))).items.find((x) => x.id === r.id)
        ?.status,
    ).toBe('COMPLETED');
    await expect(
      run(() => svc.status(r.id, { ...token(r), status: 'BOOKED' })),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('create idempotency includes concurrent duplicate, normalized offset and mismatch', async () => {
    const key = randomUUID();
    const rows = await Promise.all([book({}, key), book({}, key)]);
    expect(rows[0].id).toBe(rows[1].id);
    expect((await book({ startsAt: '2026-10-12T13:00:00Z' }, key)).id).toBe(rows[0].id);
    await expect(book({ partySize: 3 }, key)).rejects.toMatchObject({ status: 409 });
    expect(await db.restaurantReservation.count({ where: { locationId: location } })).toBe(1);
  });
  it('walk-in requires a table, starts SEATED, unassign denied', async () => {
    await expect(book({ source: 'WALK_IN' })).rejects.toMatchObject({ status: 400 });
    const r = await book({ source: 'WALK_IN', tableId: table });
    expect(r.status).toBe('SEATED');
    await expect(run(() => svc.unassign(r.id, token(r)))).rejects.toMatchObject({ status: 409 });
  });
  it('capacity and occupied target rollback create, customer and audit', async () => {
    await book({ tableId: table });
    const audits = await db.auditLog.count({ where: { organizationId: org } });
    const customers = await db.customer.count({ where: { organizationId: org } });
    await expect(
      run(() =>
        svc.create(randomUUID(), {
          ...input(),
          customerId: undefined,
          customer: { firstName: 'Rejected' },
          tableId: table,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(book({ tableId: table2, partySize: 8 })).rejects.toMatchObject({ status: 409 });
    expect(await db.auditLog.count({ where: { organizationId: org } })).toBe(audits);
    expect(await db.customer.count({ where: { organizationId: org } })).toBe(customers);
  });
  it('two concurrent creates on one overlapping table produce one conflict', async () => {
    const results = await Promise.allSettled([
      book({ tableId: table }),
      book({ tableId: table, startsAt: '2026-10-12T19:00:00+05:00' }),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((x) => x.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
  });
  it('concurrent reassign cannot double book target', async () => {
    const a = await book(),
      b = await book();
    const results = await Promise.allSettled([
      run(() => svc.assign(a.id, { ...token(a), tableId: table })),
      run(() => svc.assign(b.id, { ...token(b), tableId: table })),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((x) => x.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
  });
  it('stale concurrent moves and statuses have exactly one winner', async () => {
    for (const mode of ['move', 'status']) {
      const r = await book();
      const action = (n: number) =>
        run(() =>
          mode === 'move'
            ? svc.update(r.id, { ...token(r), partySize: n })
            : svc.status(r.id, { ...token(r), status: n === 3 ? 'CONFIRMED' : 'CANCELLED' }),
        );
      const results = await Promise.allSettled([action(3), action(4)]);
      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((x) => x.status === 'rejected')).toMatchObject({
        reason: { status: 409 },
      });
    }
  });
  it('assign vs move and cancel vs assign keep one valid state', async () => {
    for (const mode of ['move', 'cancel']) {
      const r = await book();
      const results = await Promise.allSettled([
        run(() => svc.assign(r.id, { ...token(r), tableId: table })),
        run(() =>
          mode === 'move'
            ? svc.update(r.id, { ...token(r), partySize: 8 })
            : svc.status(r.id, { ...token(r), status: 'CANCELLED' }),
        ),
      ]);
      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const saved = await db.restaurantReservation.findUniqueOrThrow({
        where: { id: r.id },
        include: { tableAssignment: true },
      });
      if (saved.status === 'CANCELLED' || saved.partySize === 8)
        expect(saved.tableAssignment).toBeNull();
      if (saved.tableAssignment)
        await run(() => svc.status(saved.id, { ...token(saved), status: 'CANCELLED' }));
    }
  });
  it('assigned move rechecks capacity/overlap and preserves row/audit on denial', async () => {
    const a = await book({ tableId: table });
    await book({ tableId: table, startsAt: '2026-10-12T20:00:00+05:00' });
    const count = await db.auditLog.count({ where: { organizationId: org } });
    for (const patch of [{ partySize: 8 }, { startsAt: '2026-10-12T19:00:00+05:00' }])
      await expect(run(() => svc.update(a.id, { ...token(a), ...patch }))).rejects.toMatchObject({
        status: 409,
      });
    expect(
      (
        await db.restaurantReservation.findUniqueOrThrow({ where: { id: a.id } })
      ).updatedAt.toISOString(),
    ).toBe(new Date(a.updatedAt).toISOString());
    expect(await db.auditLog.count({ where: { organizationId: org } })).toBe(count);
  });
  it('seat requires assignment; unassign/reassign and terminal release', async () => {
    let r = await book();
    await expect(
      run(() => svc.status(r.id, { ...token(r), status: 'SEATED' })),
    ).rejects.toMatchObject({ status: 409 });
    r = await run(() => svc.assign(r.id, { ...token(r), tableId: table }));
    r = await run(() => svc.assign(r.id, { ...token(r), tableId: table2 }));
    expect(r.table?.id).toBe(table2);
    r = await run(() => svc.unassign(r.id, token(r)));
    expect(r.table).toBeNull();
    r = await run(() => svc.assign(r.id, { ...token(r), tableId: table }));
    await run(() => svc.status(r.id, { ...token(r), status: 'CANCELLED' }));
    expect((await book({ tableId: table })).table?.id).toBe(table);
  });
  it('timezone/overnight uses preceding period weekday and rejects overflow', async () => {
    const r = await book({ startsAt: '2026-10-13T00:00:00+05:00' });
    expect(new Date(r.endsAt).toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(
      (await run(() => svc.reservations({ date: '2026-10-13' }))).items.map((x) => x.id),
    ).toContain(r.id);
    await expect(book({ startsAt: '2026-10-13T00:30:00+05:00' })).rejects.toMatchObject({
      status: 400,
    });
  });
  it('customer link visibility, archive and foreign organization unavailable', async () => {
    await book();
    expect((await run(() => svc.customers({}))).items.map((x) => x.id)).toContain(customer);
    expect(
      (await run(() => svc.customers({}), { businessId: business2, locationId: otherLocation }))
        .items,
    ).toHaveLength(0);
    await db.customer.update({ where: { id: customer }, data: { status: 'ARCHIVED' } });
    await expect(book()).rejects.toMatchObject({ status: 404 });
    const foreign = await db.customer.create({
      data: { organizationId: foreignOrg, firstName: 'Foreign synthetic' },
    });
    await expect(book({ customerId: foreign.id })).rejects.toMatchObject({ status: 404 });
  });
  it('strict scope, wrong location/business and cross vertical denied', async () => {
    for (const patch of [
      { vertical: 'BEAUTY' as const },
      { vertical: 'HOSPITALITY' as const },
      { businessId: null },
      { locationId: null },
      { locationId: otherLocation },
      { organizationId: foreignOrg },
    ])
      await expect(run(() => svc.catalog('area', {}), patch)).rejects.toBeDefined();
    await expect(
      run(() => svc.updateCatalog('table', table, { capacity: 9 }), { locationId: location2 }),
    ).rejects.toMatchObject({ status: 404 });
    await db.business.update({ where: { id: business }, data: { status: 'ARCHIVED' } });
    await expect(book()).rejects.toBeDefined();
    await db.business.update({ where: { id: business }, data: { status: 'ACTIVE' } });
    await db.location.update({ where: { id: location }, data: { status: 'ARCHIVED' } });
    await expect(book()).rejects.toBeDefined();
  });
  it('READ_ONLY all mutation families, GET remains available', async () => {
    const r = await book();
    await db.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
    const mutations: Array<() => Promise<unknown>> = [
      () => svc.createCatalog('area', { name: 'Denied' }),
      () => svc.updateCatalog('area', area, { active: false }),
      () => svc.createCatalog('table', { areaId: area, name: 'D', capacity: 1 }),
      () => svc.updateCatalog('table', table, { active: false }),
      () => svc.createCatalog('period', { name: 'D' }),
      () => svc.updateCatalog('period', period, { active: false }),
      () => svc.create(randomUUID(), input()),
      () => svc.update(r.id, { ...token(r), notes: 'D' }),
      () => svc.status(r.id, { ...token(r), status: 'CANCELLED' }),
      () => svc.assign(r.id, { ...token(r), tableId: table }),
      () => svc.unassign(r.id, token(r)),
    ];
    for (const fn of mutations) await expect(run(fn)).rejects.toMatchObject({ status: 403 });
    expect((await run(() => svc.reservations({ date: '2026-10-12' }))).items).toHaveLength(1);
  });
  it('STAFF cannot edit catalog and audit excludes PII notes', async () => {
    await expect(
      run(() => svc.createCatalog('area', { name: 'D' }), { role: 'STAFF' }),
    ).rejects.toMatchObject({ status: 403 });
    const r = await book({ notes: 'Sensitive synthetic note' });
    const logs = await db.auditLog.findMany({ where: { entityId: r.id } });
    expect(logs.some((x) => x.action === 'food.reservation.created')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('Sensitive synthetic note');
  });
  it('HTTP reload and every route enforce vertical, scope, permissions and READ_ONLY', async () => {
    const pointer = `business=${business};location=${location}`;
    const http = (method: string, path: string, body?: unknown, scope = pointer, role = 'OWNER') =>
      fetch(`${base}/food-service/${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-wetop-scope': scope,
          'x-test-role': role,
          'idempotency-key': randomUUID(),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const created = await http(
      'POST',
      'reservations',
      input({ customerId: undefined, customer: { firstName: 'HTTP synthetic' }, tableId: table }),
    );
    expect(created.status).toBe(201);
    const row = await created.json();
    const saved = await (await http('GET', 'reservations?date=2026-10-12')).json();
    expect(saved.items.find((x: { id: string }) => x.id === row.id).table.id).toBe(table);
    const routes: [string, string, unknown?][] = [
      ['GET', 'areas'],
      ['POST', 'areas', { name: 'HTTP' }],
      ['PATCH', `areas/${area}`, { name: 'HTTP' }],
      ['GET', 'tables'],
      ['POST', 'tables', { areaId: area, name: 'HTTP', capacity: 2 }],
      ['PATCH', `tables/${table}`, { name: 'HTTP' }],
      ['GET', 'service-periods'],
      ['POST', 'service-periods', {}],
      ['PATCH', `service-periods/${period}`, { active: false }],
      ['GET', 'customers'],
      ['GET', 'reservations?date=2026-10-12'],
      ['POST', 'reservations', input()],
      ['PATCH', `reservations/${row.id}`, { ...token(row), partySize: 3 }],
      ['POST', `reservations/${row.id}/status`, { ...token(row), status: 'CONFIRMED' }],
      ['PUT', `reservations/${row.id}/table`, { ...token(row), tableId: table2 }],
      ['DELETE', `reservations/${row.id}/table`, token(row)],
    ];
    for (const [method, path, body] of routes) {
      for (const scope of [
        '',
        `business=${business}`,
        `business=${business};location=${otherLocation}`,
        `business=${randomUUID()};location=${location}`,
      ])
        expect((await http(method, path, body, scope)).status).toBe(403);
      for (const vertical of ['BEAUTY', 'HOSPITALITY'] as const) {
        await db.business.update({ where: { id: business }, data: { vertical } });
        try {
          expect((await http(method, path, body)).status).toBe(403);
        } finally {
          await db.business.update({ where: { id: business }, data: { vertical: 'FOOD_SERVICE' } });
        }
      }
      if (method !== 'GET') {
        await db.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
        try {
          expect((await http(method, path, body)).status).toBe(403);
        } finally {
          await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
        }
        if (!path.startsWith('reservations'))
          expect((await http(method, path, body, pointer, 'STAFF')).status).toBe(403);
      }
    }
    expect((await http('POST', 'reservations', { ...input(), endsAt: '2026-10-12' })).status).toBe(
      400,
    );
    let current = row;
    for (const [method, suffix, patch] of [
      ['DELETE', '/table', {}],
      ['PUT', '/table', { tableId: table2 }],
      ['PATCH', '', { startsAt: '2026-10-12T19:00:00+05:00', partySize: 3 }],
      ['POST', '/status', { status: 'CONFIRMED' }],
      ['POST', '/status', { status: 'SEATED' }],
      ['POST', '/status', { status: 'COMPLETED' }],
    ] as const) {
      const response = await http(method, `reservations/${current.id}${suffix}`, {
        ...token(current),
        ...patch,
      });
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      current = await response.json();
    }
    const reloaded = await (await http('GET', 'reservations?date=2026-10-12')).json();
    expect(reloaded.items.find((x: { id: string }) => x.id === row.id)).toMatchObject({
      status: 'COMPLETED',
      partySize: 3,
      customer: { name: 'HTTP synthetic' },
      table: { id: table2, areaName: 'Main' },
    });
  });
  it('inactive catalogs and cross-location targets cannot be used', async () => {
    await run(() => svc.updateCatalog('table', table, { active: false }));
    await expect(book({ tableId: table })).rejects.toMatchObject({ status: 404 });
    await run(() => svc.updateCatalog('area', area, { active: false }));
    await expect(book({ tableId: table2 })).rejects.toMatchObject({ status: 404 });
    await run(() => svc.updateCatalog('period', period, { active: false }));
    await expect(book()).rejects.toMatchObject({ status: 404 });
    await expect(
      run(() => svc.createCatalog('table', { areaId: area, name: 'Foreign', capacity: 2 }), {
        locationId: location2,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      run(() => svc.updateCatalog('period', period, { weekday: 2 }), { locationId: location2 }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('READ_ONLY committed while a write waits for parent lock is rechecked', async () => {
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const blocker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${org}::uuid FOR UPDATE`;
      await tx.organization.update({ where: { id: org }, data: { status: 'READ_ONLY' } });
      locked();
      const deadline = Date.now() + 1000;
      let sawWaiter: boolean;
      do {
        const rows = await tx.$queryRaw<
          Array<{ waiting: boolean }>
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND pg_backend_pid()=ANY(pg_blocking_pids(pid))) AS waiting`;
        sawWaiter = rows[0]!.waiting;
        if (!sawWaiter) await new Promise((resolve) => setTimeout(resolve, 5));
      } while (!sawWaiter && Date.now() < deadline);
      expect(sawWaiter, 'write reached parent lock after reading the old ACTIVE state').toBe(true);
    });
    await acquired;
    await Promise.all([blocker, expect(book()).rejects.toMatchObject({ status: 403 })]);
    expect(await db.restaurantReservation.count({ where: { locationId: location } })).toBe(0);
  });
  it('audit actions match the contract for period/status/table history', async () => {
    let r = await book();
    r = await run(() => svc.assign(r.id, { ...token(r), tableId: table }));
    r = await run(() => svc.assign(r.id, { ...token(r), tableId: table2 }));
    r = await run(() => svc.unassign(r.id, token(r)));
    await run(() => svc.status(r.id, { ...token(r), status: 'NO_SHOW' }));
    const actions = (await db.auditLog.findMany({ where: { organizationId: org } })).map(
      (x) => x.action,
    );
    for (const action of [
      'food.service_period.created',
      'food.table.assigned',
      'food.table.reassigned',
      'food.table.unassigned',
      'food.reservation.status',
    ])
      expect(actions).toContain(action);
  });
});
