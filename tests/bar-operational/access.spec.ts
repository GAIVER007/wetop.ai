import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { createPrismaClient } from '@pms/database';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { isLocalDatabase } from '../tools/seed-local';
import { fullQaPorts } from '../onboarding-full/ports';

const qa = fullQaPorts.url;
if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
  throw new Error('Synthetic local DB required');
const db = createPrismaClient(process.env.DATABASE_URL!, 'pms_test');
test.afterAll(() => db.$disconnect());

async function fixture(request: APIRequestContext) {
  const reset = await request.post(`${qa}/__qa/reset`, { data: { vertical: 'HOSPITALITY' } });
  expect(reset.status()).toBe(200);
  const f = await reset.json();
  const login = await request.post(`${qa}/auth/login`, {
    data: { email: f.email, password: f.password },
  });
  expect(login.status()).toBe(201);
  const { token } = await login.json();
  const headers = {
    'x-wetop-session': token,
    'x-wetop-scope': `business=${f.businessId};location=${f.locationId}`,
  };
  const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const type = await db.accommodationType.create({
    data: {
      propertyId: property.id,
      code: 'ACCESS',
      name: 'Synthetic access room',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
    },
  });
  const reservation = await db.reservation.create({
    data: {
      propertyId: property.id,
      confirmationNumber: `QA-ACCESS-${randomUUID()}`,
      source: 'DESK',
      status: 'CONFIRMED',
      arrivalDate: new Date('2026-10-07'),
      departureDate: new Date('2026-10-08'),
      adults: 1,
      currency: 'KZT',
      totalAmount: 0n,
      items: {
        create: {
          accommodationTypeId: type.id,
          arrivalDate: new Date('2026-10-07'),
          departureDate: new Date('2026-10-08'),
          price: 0n,
          status: 'CONFIRMED',
          folio: { create: { currency: 'KZT' } },
        },
      },
    },
    include: { items: { include: { folio: true } } },
  });
  const folioId = reservation.items[0]!.folio!.id;
  const charge = await db.charge.create({
    data: {
      folioId,
      kind: 'SERVICE',
      description: `Synthetic charge ${property.id}`,
      quantity: 1,
      unitPrice: 100n,
      amount: 100n,
    },
  });
  const category = await db.cashCategory.create({
    data: { propertyId: property.id, kind: 'INCOME', name: `Synthetic category ${property.id}` },
  });
  const cash = await db.cashOperation.create({
    data: {
      propertyId: property.id,
      kind: 'INCOME',
      method: 'CASH',
      amount: 100n,
      categoryId: category.id,
    },
  });
  const product = await db.barProduct.create({
    data: {
      propertyId: property.id,
      code: 'ACCESS',
      name: `Synthetic product ${property.id}`,
      unitsPerPackage: 1,
      salePrice: 100n,
    },
  });
  return { f, headers, property, reservation, folioId, charge, category, cash, product };
}

async function snapshot(ids: string[], folioIds: string[]) {
  return {
    cash: await db.cashOperation.findMany({
      where: { propertyId: { in: ids } },
      orderBy: { id: 'asc' },
    }),
    charges: await db.charge.findMany({
      where: { folioId: { in: folioIds } },
      orderBy: { id: 'asc' },
    }),
    folios: await db.folio.findMany({ where: { id: { in: folioIds } }, orderBy: { id: 'asc' } }),
    payments: await db.payment.findMany({
      where: { propertyId: { in: ids } },
      orderBy: { id: 'asc' },
    }),
    allocations: await db.paymentAllocation.findMany({
      where: { folioId: { in: folioIds } },
      orderBy: [{ folioId: 'asc' }, { paymentId: 'asc' }],
    }),
    sales: await db.barSale.findMany({
      where: { propertyId: { in: ids } },
      orderBy: { id: 'asc' },
    }),
    movements: await db.barStockMovement.findMany({
      where: { propertyId: { in: ids } },
      orderBy: { id: 'asc' },
    }),
  };
}

async function evidence(value: unknown) {
  await mkdir('reports/unified-stage-2026-10-07', { recursive: true });
  await appendFile(
    'reports/unified-stage-2026-10-07/access-results.jsonl',
    `${JSON.stringify(value)}\n`,
  );
}

test('C15 real SessionGuard isolates foreign cash charges Folio and substituted related IDs', async ({
  request,
}) => {
  const own = await fixture(request);
  const foreign = await fixture(request);
  const ids = [own.property.id, foreign.property.id],
    folios = [own.folioId, foreign.folioId];
  const before = await snapshot(ids, folios);
  for (const [actor, hidden] of [
    [own, foreign],
    [foreign, own],
  ] as const) {
    const reads = [
      ['/finance/cash', hidden.cash.id],
      ['/finance/operations?from=2026-10-01&to=2026-10-10', hidden.cash.id],
      [`/finance/reservations/${actor.reservation.confirmationNumber}`, hidden.charge.id],
      ['/bar/folios', hidden.folioId],
    ];
    for (const [path, hiddenId] of reads) {
      const r = await request.get(`${qa}${path}`, { headers: actor.headers });
      expect(r.status(), path).toBe(200);
      expect(await r.text()).not.toContain(hiddenId);
      expect(await snapshot(ids, folios)).toEqual(before);
      await evidence({
        scenario: 'C15',
        variant: 'scoped read',
        path,
        status: r.status(),
        result: 'PASS',
      });
    }
    const hiddenReservation = await request.get(
      `${qa}/finance/reservations/${hidden.reservation.confirmationNumber}`,
      { headers: actor.headers },
    );
    expect(hiddenReservation.status()).toBe(404);
    expect(await hiddenReservation.text()).not.toContain(hidden.charge.description);
    const attacks: Array<[string, unknown]> = [
      [`/finance/cash/operations/${hidden.cash.id}/void`, {}],
      [`/finance/charges/${hidden.charge.id}/void`, {}],
      [`/finance/folios/${hidden.folioId}/close`, {}],
      [
        `/finance/folios/${hidden.folioId}/charges`,
        { kind: 'SERVICE', description: 'Synthetic denial', unitPrice: '1.00' },
      ],
      [
        '/finance/cash/operations',
        { kind: 'INCOME', method: 'CASH', amount: '1.00', categoryId: hidden.category.id },
      ],
      [
        '/finance/payments',
        {
          method: 'CASH',
          amount: '1.00',
          allocations: [{ folioId: hidden.folioId, amount: '1.00' }],
        },
      ],
      [
        '/bar/sales/folio',
        {
          folioId: hidden.folioId,
          productId: actor.product.id,
          quantityUnits: '1',
          idempotencyKey: randomUUID(),
        },
      ],
      [
        '/bar/sales/folio',
        {
          folioId: actor.folioId,
          productId: hidden.product.id,
          quantityUnits: '1',
          idempotencyKey: randomUUID(),
        },
      ],
    ];
    for (const [path, data] of attacks) {
      const r = await request.post(`${qa}${path}`, { headers: actor.headers, data });
      expect(r.status(), path).toBe(path === '/finance/cash/operations' ? 400 : 404);
      const text = await r.text();
      for (const secret of [hidden.charge.description, hidden.category.name, hidden.product.name])
        expect(text).not.toContain(secret);
      expect(await snapshot(ids, folios)).toEqual(before);
      await evidence({
        scenario: 'C15',
        variant: 'foreign mutation/link denied',
        path: path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'),
        status: r.status(),
        result: 'PASS',
      });
    }
    const deniedScope = await request.get(`${qa}/finance/cash`, {
      headers: {
        ...actor.headers,
        'x-wetop-scope': `business=${hidden.f.businessId};location=${hidden.f.locationId}`,
      },
    });
    // Legacy Finance uses organization scope for an invalid pointer (auth/scope.ts).
    // Verify isolation, and report the selection fallback separately rather than approving A4b.
    expect(deniedScope.status()).toBe(200);
    const fallbackText = await deniedScope.text();
    expect(fallbackText).toContain(actor.category.id);
    expect(fallbackText).toContain(actor.category.name);
    expect(fallbackText).not.toContain(hidden.cash.id);
    expect(fallbackText).not.toContain(hidden.category.name);
    const me = await request.get(`${qa}/auth/me`, {
      headers: {
        ...actor.headers,
        'x-wetop-scope': `business=${hidden.f.businessId};location=${hidden.f.locationId}`,
      },
    });
    expect(me.status()).toBe(200);
    const context = (await me.json()).context;
    expect(context?.locationId ?? null).toBeNull();
    await evidence({
      scenario: 'A4b/C15',
      variant: 'foreign selection falls back to own organization only',
      status: 200,
      isolation: 'PASS',
      selectionPolicy: 'OPEN',
    });
    expect(await snapshot(ids, folios)).toEqual(before);
  }
});

test('C14 existing OWNER MANAGER STAFF and read-only permissions through real SessionGuard', async ({
  request,
}) => {
  const f = await fixture(request);
  const before = await snapshot([f.property.id], [f.folioId]);
  for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const) {
    await db.membership.update({
      where: { userId_organizationId: { userId: f.f.userId, organizationId: f.f.organizationId } },
      data: { role },
    });
    const me = await request.get(`${qa}/auth/me`, { headers: f.headers });
    expect(me.status()).toBe(200);
    expect((await me.json()).user.role).toBe(role);
    const read = await request.get(`${qa}/finance/cash`, { headers: f.headers });
    expect(read.status()).toBe(200);
    for (const path of [
      `/finance/cash/operations/${randomUUID()}/void`,
      `/finance/charges/${randomUUID()}/void`,
    ]) {
      const r = await request.post(`${qa}${path}`, { headers: f.headers, data: {} });
      expect(r.status()).toBe(role === 'STAFF' ? 403 : 404);
      expect(await snapshot([f.property.id], [f.folioId])).toEqual(before);
    }
    const config = await request.post(`${qa}/bar/categories`, {
      headers: f.headers,
      data: { name: '' },
    });
    expect(config.status()).toBe(role === 'STAFF' ? 403 : 400);
    await evidence({
      scenario: 'C14',
      role,
      variant: 'current cash/refunds/settings guards',
      result: 'PASS',
    });
  }
  await db.membership.update({
    where: { userId_organizationId: { userId: f.f.userId, organizationId: f.f.organizationId } },
    data: { role: 'OWNER' },
  });
  await db.organization.update({
    where: { id: f.f.organizationId },
    data: { status: 'READ_ONLY' },
  });
  expect((await request.get(`${qa}/finance/cash`, { headers: f.headers })).status()).toBe(200);
  expect(
    (
      await request.get(`${qa}/finance/reservations/${f.reservation.confirmationNumber}`, {
        headers: f.headers,
      })
    ).status(),
  ).toBe(200);
  for (const [path, data] of [
    [`/finance/cash/operations/${f.cash.id}/void`, {}],
    [`/finance/charges/${f.charge.id}/void`, {}],
    [`/finance/folios/${f.folioId}/close`, {}],
    [`/finance/folios/${f.folioId}/charges`, { kind: 'SERVICE', unitPrice: '1.00' }],
    [
      '/bar/write-offs',
      { productId: f.product.id, quantityUnits: '1', reason: 'Synthetic read-only denial' },
    ],
  ] as const) {
    expect((await request.post(`${qa}${path}`, { headers: f.headers, data })).status(), path).toBe(
      403,
    );
    expect(await snapshot([f.property.id], [f.folioId])).toEqual(before);
  }
  await evidence({
    scenario: 'C14',
    role: 'OWNER',
    variant: 'read-only existing reads and blocked writes',
    result: 'PASS',
  });
});
