import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

describe('BAR approved reversal policy on real HTTP and PostgreSQL', () => {
  let f: BarOperationalFixture;
  beforeAll(async () => { f = await barOperationalFixture(); });
  afterAll(async () => { await f?.close(); });
  async function stocked() {
    const side = await f.side(), d = await f.prepare(side);
    for (const receipt of [d.r1, d.r2]) expect((await f.request(`receipts/${receipt.id}/post`, {}, d.options)).status).toBe(201);
    return { ...d, side };
  }
  async function effects(propertyId: string) {
    return {
      cash: await f.db.cashOperation.count({ where: { propertyId } }),
      movements: await f.db.barStockMovement.count({ where: { propertyId } }),
      sales: await f.db.barSale.count({ where: { propertyId } }),
      lots: await f.db.barStockLot.findMany({ where: { propertyId }, orderBy: { id: 'asc' }, select: { id: true, remainingUnits: true } }),
    };
  }
  it('T09 STAFF cannot reverse a BAR sale', async () => {
    const d = await stocked();
    const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    const before = await effects(d.side.property);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: true, reason: 'Denied' }, { ...d.options, role: 'STAFF' })).status).toBe(403);
    expect(await effects(d.side.property)).toEqual(before);
  });
  it.each(['closed', 'paid'])('T11 %s Folio cannot be changed through BAR reverse', async state => {
    const d = await stocked();
    const sale = await f.request('sales/folio', { productId: d.a.id, folioId: d.side.folio, quantityUnits: '1', idempotencyKey: randomUUID() }, d.options);
    if (state === 'closed') await f.db.folio.update({ where: { id: d.side.folio }, data: { status: 'CLOSED' } });
    else await f.db.payment.create({ data: { propertyId: d.side.property, method: 'CASH', amount: 1n, currency: 'KZT', allocations: { create: { folioId: d.side.folio, amount: 1n } } } });
    const before = await effects(d.side.property);
    const allocations = await f.db.paymentAllocation.findMany({ where: { folioId: d.side.folio } });
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: true, reason: 'Closed' }, d.options)).status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
    expect((await f.db.charge.findUniqueOrThrow({ where: { id: sale.body.chargeId } })).voidedAt).toBeNull();
    expect(await f.db.paymentAllocation.findMany({ where: { folioId: d.side.folio } })).toEqual(allocations);
  });
  it.each(['OWNER', 'MANAGER'] as const)('T11 %s can reverse an unpaid open Folio', async role => {
    const d = await stocked();
    const sale = await f.request('sales/folio', { productId: d.a.id, folioId: d.side.folio, quantityUnits: '1', idempotencyKey: randomUUID() }, d.options);
    expect(sale.status).toBe(201);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: true, reason: 'Synthetic authorized refund' }, { ...d.options, role })).body).toMatchObject({ status: 'REVERSED', restocked: true });
    expect((await f.db.charge.findUniqueOrThrow({ where: { id: sale.body.chargeId } })).voidedAt).not.toBeNull();
  });
});
