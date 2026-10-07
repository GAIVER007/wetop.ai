import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

describe('BAR approved replay/debt/loss contracts on real HTTP and PostgreSQL', () => {
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
  it.each(['payment', 'write-off', 'retail', 'folio'])('T03/T06/T07 %s: lost response replay is one effect, changed payload conflicts, new intent succeeds', async kind => {
    const d = await stocked(), idempotencyKey = randomUUID();
    const path = kind === 'payment' ? `receipts/${d.r1.id}/payments` : kind === 'write-off' ? 'write-offs' : `sales/${kind}`;
    const input = kind === 'payment' ? { amountMinor: '10000', method: 'CASH', idempotencyKey }
      : { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic replay', method: 'CASH', folioId: d.side.folio, idempotencyKey };
    const first = await f.request(path, input, d.options);
    expect(first.status).toBe(201);
    const before = await effects(d.side.property);
    const retry = await f.request(path, input, d.options);
    expect(retry.body.id).toBe(first.body.id);
    expect(await effects(d.side.property)).toEqual(before);
    const conflict = await f.request(path, { ...input, ...(kind === 'payment' ? { amountMinor: '20000' } : { quantityUnits: '2' }) }, d.options);
    expect(conflict.status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
    const second = await f.request(path, { ...input, idempotencyKey: randomUUID() }, d.options);
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
  });
  it('T10 linked Finance void restores debt and replay returns VOIDED without paying again', async () => {
    const d = await stocked(), body = { amountMinor: '60000', method: 'CASH', idempotencyKey: randomUUID() };
    const payment = await f.request(`receipts/${d.r1.id}/payments`, body, d.options);
    const stored = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: payment.body.id } });
    expect((await f.request(`/finance/cash/operations/${stored.cashOperationId}/void`, {}, d.options)).status).toBe(200);
    expect((await f.request('report', undefined, d.options)).body).toMatchObject({ supplierPaidMinor: '0', supplierDebtMinor: '280000', stockCostMinor: '280000' });
    const before = await effects(d.side.property);
    expect((await f.request(`receipts/${d.r1.id}/payments`, body, d.options)).body).toMatchObject({ id: payment.body.id, status: 'VOIDED' });
    expect(await effects(d.side.property)).toEqual(before);
    expect((await f.request(`/finance/cash/operations/${stored.cashOperationId}/void`, {}, d.options)).status).toBe(409);
  });
  it('T10 no-restock loss retains FIFO cost once without a second warehouse decrement', async () => {
    const d = await stocked();
    const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Spoiled synthetic goods' }, d.options)).status).toBe(201);
    expect((await f.request('report', undefined, d.options)).body).toMatchObject({ nonRestockedLossMinor: '132000', costMinor: '0', writeOffMinor: '0', stockCostMinor: '148000' });
    const before = await effects(d.side.property);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Repeat' }, d.options)).status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
  });
});
