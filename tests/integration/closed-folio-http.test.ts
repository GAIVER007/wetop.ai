import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { ReservationsModule } from '../../apps/api/src/reservations/reservations.module';
import { BarModule } from '../../apps/api/src/bar/bar.module';
import { FinanceModule } from '../../apps/api/src/finance/finance.module';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ensureFolioWithAccommodation } from '../../packages/database/src/folio';
import { actorOf, bootApp, call, seedGuestStay, seedHotel, seedUser, type Hotel, type HotelGuest } from './core-security/harness';

// Only identity is test-injected. Real RoleGuard, AuthorInterceptor, Nest routes,
// repositories and PostgreSQL transactions are exercised over loopback HTTP.
describe.skipIf(!process.env.DATABASE_URL)('closed folio charge mutations through HTTP', () => {
  let db: Db;
  let app: INestApplication;
  let base: string;
  let hotel: Hotel;
  const orgId = randomUUID();
  let userId: string;
  const stays: HotelGuest[] = [];

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local synthetic database only');
    db = createPrismaClient(url.toString(), 'pms_test');
    await db.organization.create({ data: { id: orgId, name: `Folio regression ${orgId}`, status: 'ACTIVE' } });
    hotel = await seedHotel(db, orgId, `Folio regression ${orgId}`);
    userId = await seedUser(db, orgId, 'OWNER', 'folio');
    ({ app, base } = await bootApp([ReservationsModule, FinanceModule, BarModule], db, new Map([['owner', actorOf(userId, orgId, 'OWNER')]])));
  });

  afterAll(async () => {
    if (app) await app.close();
    if (!db) return;
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { OR: [{ userId }, { entityId: { in: stays.flatMap(s => [s.reservationId, s.folioId]) } }] } });
      await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: stays.map(s => s.paymentId) } } });
      await tx.payment.deleteMany({ where: { id: { in: stays.map(s => s.paymentId) } } });
      await tx.barStockMovement.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.barSaleLine.deleteMany({ where: { sale: { locationId: hotel.locationId } } });
      await tx.barSale.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.barStockLot.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.barReceiptLine.deleteMany({ where: { receipt: { locationId: hotel.locationId } } });
      await tx.barReceipt.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.barProduct.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.barCategory.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.barSupplier.deleteMany({ where: { locationId: hotel.locationId } });
      await tx.charge.deleteMany({ where: { folioId: { in: stays.map(s => s.folioId) } } });
      await tx.folio.deleteMany({ where: { id: { in: stays.map(s => s.folioId) } } });
      await tx.allocation.deleteMany({ where: { reservationItemId: { in: stays.map(s => s.itemId) } } });
      await tx.stayGuest.deleteMany({ where: { reservationItemId: { in: stays.map(s => s.itemId) } } });
      await tx.reservationItem.deleteMany({ where: { id: { in: stays.map(s => s.itemId) } } });
      await tx.reservation.deleteMany({ where: { id: { in: stays.map(s => s.reservationId) } } });
      await tx.guest.deleteMany({ where: { organizationId: orgId } });
      await tx.membership.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      await tx.dailyRate.deleteMany({ where: { ratePlanId: hotel.ratePlanId } });
      await tx.inventoryUnit.deleteMany({ where: { propertyId: hotel.propertyId } });
      await tx.physicalRoom.deleteMany({ where: { floor: { building: { propertyId: hotel.propertyId } } } });
      await tx.floor.deleteMany({ where: { building: { propertyId: hotel.propertyId } } });
      await tx.building.deleteMany({ where: { propertyId: hotel.propertyId } });
      await tx.ratePlan.deleteMany({ where: { propertyId: hotel.propertyId } });
      await tx.accommodationType.deleteMany({ where: { propertyId: hotel.propertyId } });
      await tx.property.delete({ where: { id: hotel.propertyId } });
      await tx.location.delete({ where: { id: hotel.locationId } });
      await tx.business.delete({ where: { id: hotel.businessId } });
      await tx.organization.delete({ where: { id: orgId } });
    });
    await db.$disconnect();
  });

  const http = (method: 'POST' | 'PATCH', path: string, body?: unknown) => call(base, 'owner', method, path, hotel, body);
  const itemPath = (s: HotelGuest) => `/reservations/${s.confirmationNumber}/items/${s.itemId}`;
  async function snapshot(s: HotelGuest) {
    return {
      reservation: await db.reservation.findUniqueOrThrow({ where: { id: s.reservationId } }),
      item: await db.reservationItem.findUniqueOrThrow({ where: { id: s.itemId } }),
      folio: await db.folio.findUniqueOrThrow({ where: { id: s.folioId }, include: { charges: { orderBy: { id: 'asc' } }, allocations: true, refunds: true } }),
      allocations: await db.allocation.findMany({ where: { reservationItemId: s.itemId } }),
      audit: await db.auditLog.findMany({ where: { entityId: { in: [s.reservationId, s.folioId] } }, orderBy: { id: 'asc' } }),
    };
  }
  async function fixture(closed: boolean) {
    const s = await seedGuestStay(db, orgId, hotel, 'Synthetic', `FOLIO-${randomUUID()}`);
    stays.push(s);
    await db.payment.update({ where: { id: s.paymentId }, data: { amount: 2_000_000n } });
    await db.paymentAllocation.update({ where: { paymentId_folioId: { paymentId: s.paymentId, folioId: s.folioId } }, data: { amount: 2_000_000n } });
    if (closed) {
      const response = await http('POST', `/finance/folios/${s.folioId}/close`);
      expect(response.status, response.text).toBe(200);
      expect((await snapshot(s)).folio.status).toBe('CLOSED');
      console.log('paid folio closed via HTTP', { folioId: s.folioId, status: response.status, balanceMinor: '0' });
    }
    return s;
  }

  it('rejects PATCH price after closing a paid folio and rolls back all writes', async () => {
    const s = await fixture(true);
    const before = await snapshot(s);
    const response = await http('PATCH', itemPath(s), { price: '25000', adults: 2 });
    console.log('closed folio PATCH price', { status: response.status, body: response.json });
    expect(response.status, response.text).toBe(409);
    expect(response.text).toContain('закрыт');
    expect(await snapshot(s)).toEqual(before);
  });

  it('still updates an open folio using storno plus a replacement charge', async () => {
    const s = await fixture(false);
    const response = await http('PATCH', itemPath(s), { price: '25000' });
    expect(response.status, response.text).toBe(200);
    const state = await snapshot(s);
    expect(state.item.price).toBe(2_500_000n);
    expect(state.reservation.totalAmount).toBe(2_500_000n);
    expect(state.folio.charges.filter(c => !c.voidedAt).map(c => c.amount)).toEqual([2_500_000n]);
    expect(state.folio.charges.find(c => c.id === s.chargeId)?.voidedAt).not.toBeNull();
  });

  it('rejects cancellation without changing the closed folio, stay or audit', async () => {
    const s = await fixture(true);
    const before = await snapshot(s);
    const response = await http('POST', `/reservations/${s.confirmationNumber}/cancel`);
    expect(response.status, response.text).toBe(409);
    expect(await snapshot(s)).toEqual(before);
  });

  it('rejects direct penalty creation against a closed folio inside the reservation transaction', async () => {
    const s = await fixture(true);
    const before = await snapshot(s);
    await expect(db.$transaction(tx => new PrismaReservationsRepository(tx).addPenaltyCharge(s.itemId, 100n, 'Synthetic penalty'))).rejects.toThrow('закрыт');
    expect(await snapshot(s)).toEqual(before);
  });

  async function post(path: string, body?: unknown) {
    const response = await http('POST', path, body);
    expect(response.status, response.text).toBe(201);
    return response.json as { id: string; chargeId?: string };
  }

  async function stockSnapshot(s: HotelGuest, saleId: string, productId: string) {
    const stay = await snapshot(s);
    return {
      stay,
      balanceMinor: stay.folio.charges.filter(c => !c.voidedAt).reduce((sum, c) => sum + c.amount, 0n)
        - stay.folio.allocations.reduce((sum, a) => sum + a.amount, 0n)
        + stay.folio.refunds.reduce((sum, r) => sum + r.amount, 0n),
      sale: await db.barSale.findUniqueOrThrow({ where: { id: saleId }, include: { lines: { orderBy: { id: 'asc' } } } }),
      lots: await db.barStockLot.findMany({ where: { productId }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] }),
      movements: await db.barStockMovement.findMany({ where: { productId }, orderBy: { id: 'asc' } }),
      audit: await db.auditLog.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    };
  }

  for (const closed of [true, false]) for (const restock of [true, false]) it(`${closed ? 'rejects closed' : 'allows open'} folio real-stock bar reversal over HTTP (restock=${restock})`, async () => {
    const s = await fixture(false);
    const category = await post('/bar/categories', { name: `Synthetic stock ${randomUUID()}`, defaultMarkupBasis: 0 });
    const supplier = await post('/bar/suppliers', { name: `Synthetic supplier ${randomUUID()}` });
    const product = await post('/bar/products', { code: randomUUID(), name: 'Synthetic stock product', categoryId: category.id, unitsPerPackage: 1, salePriceMinor: '100', minimumStockUnits: '0' });
    // Two actual posted receipts exercise FIFO depletion and restoration to each original lot.
    for (const [quantityUnits, unitCostMinor] of [['3', '50'], ['4', '70']]) {
      const receipt = await post('/bar/receipts', { supplierId: supplier.id, documentNumber: randomUUID(), documentDate: '2026-10-15', receivedDate: '2026-10-15', currency: 'KZT', lines: [{ productId: product.id, quantityUnits, unitCostMinor, markupBasis: 0 }] });
      await post(`/bar/receipts/${receipt.id}/post`);
    }
    const price = await http('PATCH', `/bar/products/${product.id}/price`, { salePriceMinor: '100' });
    expect(price.status, price.text).toBe(200);
    const initialLots = await db.barStockLot.findMany({ where: { productId: product.id }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] });
    expect(initialLots.map(l => [l.receivedUnits, l.remainingUnits, l.unitCost])).toEqual([[3n, 3n, 50n], [4n, 4n, 70n]]);

    const sale = await post('/bar/sales/folio', { productId: product.id, folioId: s.folioId, quantityUnits: '4', idempotencyKey: randomUUID() });
    expect(sale.chargeId).toEqual(expect.any(String));
    await db.payment.update({ where: { id: s.paymentId }, data: { amount: 2_000_400n } });
    await db.paymentAllocation.update({ where: { paymentId_folioId: { paymentId: s.paymentId, folioId: s.folioId } }, data: { amount: 2_000_400n } });
    if (closed) expect((await http('POST', `/finance/folios/${s.folioId}/close`)).status).toBe(200);
    const before = await stockSnapshot(s, sale.id, product.id);
    expect(before.balanceMinor).toBe(0n);
    expect(before.sale).toMatchObject({ status: 'POSTED', folioId: s.folioId, chargeId: sale.chargeId, totalRevenue: 400n, totalCost: 220n, reversedAt: null });
    expect(before.sale.lines).toEqual([expect.objectContaining({ productId: product.id, quantityUnits: 4n, salePrice: 100n, revenue: 400n, cost: 220n })]);
    expect(before.stay.folio.charges.find(c => c.id === sale.chargeId)).toMatchObject({ amount: 400n, voidedAt: null });
    expect(before.lots.map(l => l.remainingUnits)).toEqual([0n, 3n]);
    expect(before.movements).toHaveLength(4);
    expect(before.movements.filter(m => m.kind === 'RECEIPT').map(m => m.units).sort()).toEqual([3n, 4n]);
    const depletion = before.movements.filter(m => m.kind === 'SALE').sort((a, b) => a.unitCost < b.unitCost ? -1 : 1);
    expect(depletion).toEqual(initialLots.map((lot, i) => expect.objectContaining({ lotId: lot.id, productId: product.id, sourceType: 'BAR_SALE', sourceId: sale.id, units: i === 0 ? -3n : -1n, unitCost: lot.unitCost })));

    const response = await http('POST', `/bar/sales/${sale.id}/reverse`, { restock, reason: 'Synthetic stock reversal' });
    console.log('real-stock bar reversal', { closed, restock, saleId: sale.id, folioId: s.folioId, status: response.status, body: response.json });
    expect(response.status, response.text).toBe(closed ? 409 : 201);
    const after = await stockSnapshot(s, sale.id, product.id);
    if (closed) {
      expect(response.text).toContain('закрыт');
      // Includes complete folio/charges/payments, sale/lines, nonzero lot balances, movements and audit.
      expect(after).toEqual(before);
    } else {
      expect(response.json).toMatchObject({ id: sale.id, status: 'REVERSED', restocked: restock });
      expect(after.sale.status).toBe('REVERSED');
      expect(after.sale.reversedAt).toBeInstanceOf(Date);
      expect({ ...after.sale, status: before.sale.status, reversedAt: before.sale.reversedAt }).toEqual(before.sale);
      expect(after.stay.folio.status).toBe('OPEN');
      expect(after.balanceMinor).toBe(-400n);
      const charge = after.stay.folio.charges.find(c => c.id === sale.chargeId)!;
      expect(charge.voidedAt).toBeInstanceOf(Date);
      expect({ ...charge, voidedAt: null }).toEqual(before.stay.folio.charges.find(c => c.id === sale.chargeId));
      expect(after.stay.folio.charges.filter(c => c.id !== sale.chargeId)).toEqual(before.stay.folio.charges.filter(c => c.id !== sale.chargeId));
      expect(after.stay.folio.allocations).toEqual(before.stay.folio.allocations);
      expect(after.stay.folio.refunds).toEqual(before.stay.folio.refunds);
      expect(after.lots).toEqual(restock ? initialLots : before.lots);
      expect(after.movements.filter(m => m.kind !== 'SALE_RETURN')).toEqual(before.movements);
      const returns = after.movements.filter(m => m.kind === 'SALE_RETURN').sort((a, b) => a.unitCost < b.unitCost ? -1 : 1);
      expect(returns).toEqual(restock ? depletion.map(m => expect.objectContaining({ lotId: m.lotId, productId: m.productId, units: -m.units, unitCost: m.unitCost, sourceType: 'BAR_SALE_RETURN', sourceId: sale.id })) : []);
      expect(after.audit.filter(a => a.entityId === sale.id && a.action === 'bar.sale.reversed')).toHaveLength(1);
    }
    // Retrying either flag must not restore any lot twice, or turn a no-restock reversal into a restock.
    for (const retryRestock of [restock, !restock]) {
      const repeated = await http('POST', `/bar/sales/${sale.id}/reverse`, { restock: retryRestock, reason: 'Synthetic repeated reversal' });
      expect(repeated.status, repeated.text).toBe(409);
      expect(await stockSnapshot(s, sale.id, product.id)).toEqual(after);
    }
    console.log('real-stock invariant evidence', { closed, restock, saleId: sale.id, initialUnits: '7', soldUnits: '4', remainingUnits: after.lots.map(l => String(l.remainingUnits)), movements: after.movements.length, balanceMinor: String(after.balanceMinor), retries: 'same and opposite flag: 409, unchanged' });
  });

  for (const early of [false, true]) it(`allows ${early ? 'early' : 'normal'} checkout after manual paid close`, async () => {
    const s = await fixture(false);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    const arrival = new Date(`${today}T00:00:00Z`);
    arrival.setUTCDate(arrival.getUTCDate() - 2);
    const departure = new Date(`${today}T00:00:00Z`);
    if (early) departure.setUTCDate(departure.getUTCDate() + 2);
    await db.reservationItem.update({ where: { id: s.itemId }, data: { status: 'CHECKED_IN', arrivalDate: arrival, departureDate: departure } });
    await db.reservation.update({ where: { id: s.reservationId }, data: { status: 'CHECKED_IN', arrivalDate: arrival, departureDate: departure } });
    expect((await http('POST', `/finance/folios/${s.folioId}/close`)).status).toBe(200);
    const before = await snapshot(s);
    const response = await http('POST', `${itemPath(s)}/check-out`);
    expect(response.status, response.text).toBe(200);
    const after = await snapshot(s);
    expect(after.item.status).toBe('CHECKED_OUT');
    expect(after.item.departureDate.toISOString().slice(0, 10)).toBe(today);
    expect(after.item.price).toBe(before.item.price);
    expect(after.folio).toEqual(before.folio);
  });

  async function waitForBlockedBy(pid: number) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const rows = await db.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))) AS waiting`;
      if (rows[0]?.waiting) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected a real PostgreSQL row-lock waiter');
  }

  it('sync waits for concurrent close and rejects without changing the closed charges', async () => {
    const s = await fixture(false);
    const before = await snapshot(s);
    let contender: Promise<unknown> | undefined;
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM folios WHERE id = ${s.folioId}::uuid FOR UPDATE`;
      const backend = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      expect(backend).toHaveLength(1);
      const pid = backend[0]!.pid;
      await tx.folio.update({ where: { id: s.folioId }, data: { status: 'CLOSED', closedAt: new Date() } });
      contender = db.$transaction(other => ensureFolioWithAccommodation(other, { reservationItemId: s.itemId, currency: 'KZT', amountMinor: 2_500_000n, description: 'Synthetic sync', serviceDate: '2026-10-15' }), { timeout: 30_000 }).catch(e => e);
      await waitForBlockedBy(pid);
    }, { timeout: 30_000 });
    expect(await contender).toBeInstanceOf(Error);
    expect((await contender as Error).message).toContain('закрыт');
    const after = await snapshot(s);
    expect(after.folio.status).toBe('CLOSED');
    expect(after.folio.charges).toEqual(before.folio.charges);
  });

  it('HTTP close waits for sync and rechecks its changed balance under the same lock', async () => {
    const s = await fixture(false);
    let contender: ReturnType<typeof http> | undefined;
    await db.$transaction(async tx => {
      await ensureFolioWithAccommodation(tx, { reservationItemId: s.itemId, currency: 'KZT', amountMinor: 2_500_000n, description: 'Synthetic sync', serviceDate: '2026-10-15' });
      const backend = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      expect(backend).toHaveLength(1);
      const pid = backend[0]!.pid;
      contender = http('POST', `/finance/folios/${s.folioId}/close`);
      await waitForBlockedBy(pid);
    }, { timeout: 30_000 });
    const response = await contender!;
    expect(response.status, response.text).toBe(409);
    const after = await snapshot(s);
    expect(after.folio.status).toBe('OPEN');
    expect(after.folio.charges.filter(c => !c.voidedAt).map(c => c.amount)).toEqual([2_500_000n]);
  });

  it('allows an unchanged accommodation sync on a closed folio', async () => {
    const s = await fixture(true);
    const before = await snapshot(s);
    await db.$transaction(tx => ensureFolioWithAccommodation(tx, { reservationItemId: s.itemId, currency: 'KZT', amountMinor: 2_000_000n, description: 'Synthetic accommodation', serviceDate: before.item.arrivalDate.toISOString().slice(0, 10) }));
    expect(await snapshot(s)).toEqual(before);
  });
});
