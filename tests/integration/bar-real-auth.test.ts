import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

describe('BAR real SessionGuard/AuthService rights and read-only', () => {
  let f: BarOperationalFixture;
  beforeAll(async () => { f = await barOperationalFixture(0, true); await f.recoverOwnFixtures(); });
  afterAll(async () => { await f?.close(); });
  it.each(['OWNER', 'MANAGER', 'STAFF'] as const)('%s desk reads and writes, refunds/settings follow the accepted matrix', async role => {
    const side = await f.side(), d = await f.prepare(side), options = { side, role };
    for (const path of ['categories','products','suppliers','receipts','stock','sales','folios','movements','report']) expect((await f.request(path, undefined, options)).status).toBe(200);
    expect((await f.request(`receipts/${d.r1.id}/post`, {}, options)).status).toBe(201);
    const payment = await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '10000', method: 'CASH', idempotencyKey: randomUUID() }, options);
    expect(payment.status).toBe(201);
    const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, options);
    expect(sale.status).toBe(201);
    const folio = await f.request('sales/folio', { productId: d.a.id, folioId: side.folio, quantityUnits: '1', idempotencyKey: randomUUID() }, options);
    expect(folio.status).toBe(201);
    expect((await f.request('write-offs', { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic role test', idempotencyKey: randomUUID() }, options)).status).toBe(201);
    expect((await f.request('inventory-counts', { productId: d.a.id, actualUnits: '7', reason: 'Synthetic role count' }, options)).status).toBe(201);
    const before = await f.db.barStockMovement.count({ where: { propertyId: side.property } });
    const expected = role === 'STAFF' ? 403 : 201;
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: true, reason: 'Synthetic role refund' }, options)).status).toBe(expected);
    const cash = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: payment.body.id } });
    expect((await f.request(`/finance/cash/operations/${cash.cashOperationId}/void`, {}, options)).status).toBe(role === 'STAFF' ? 403 : 200);
    expect((await f.request('categories', { name: 'Synthetic role settings', defaultMarkupBasis: 0 }, options)).status).toBe(role === 'STAFF' ? 403 : 201);
    if (role === 'STAFF') expect(await f.db.barStockMovement.count({ where: { propertyId: side.property } })).toBe(before);
    const author = await f.identity(side, role);
    expect((await f.db.auditLog.findMany({ where: { entityId: sale.body.id, action: 'bar.sale.posted' } })).map(row => row.userId)).toEqual([author.userId]);
  });
  it('unset session is 401, foreign scope is denied, READ_ONLY reads but all mutations are denied without effects', async () => {
    const side = await f.side(), d = await f.prepare(side), other = await f.side();
    expect((await f.request('report', undefined, { side, anonymous: true })).status).toBe(401);
    expect((await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, { side: other })).status).toBe(404);
    expect((await f.request(`receipts/${d.r1.id}/post`, {}, d.options)).status).toBe(201);
    const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    const payment = await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '100', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    const cash = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: payment.body.id } });
    await f.db.organization.update({ where: { id: side.org }, data: { status: 'READ_ONLY' } });
    const before = await f.db.barStockMovement.count({ where: { propertyId: side.property } });
    const operations: Array<[string, object]> = [
      ['categories', { name: 'Denied', defaultMarkupBasis: 0 }],
      [`categories/${d.category.id}/active`, { active: false }],
      ['suppliers', { name: 'Denied' }], [`suppliers/${d.supplier.id}/active`, { active: false }],
      ['products', {}], [`products/${d.a.id}/active`, { active: false }], [`products/${d.a.id}/price`, { salePriceMinor: '1' }],
      ['receipts', {}], [`receipts/${d.r2.id}/post`, {}], [`receipts/${d.r1.id}/payments`, { amountMinor: '100', method: 'CASH', idempotencyKey: randomUUID() }],
      ['sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }],
      ['sales/folio', { productId: d.a.id, folioId: side.folio, quantityUnits: '1', idempotencyKey: randomUUID() }],
      [`sales/${sale.body.id}/reverse`, { restock: true, reason: 'Denied' }],
      ['write-offs', { productId: d.a.id, quantityUnits: '1', reason: 'Denied', idempotencyKey: randomUUID() }],
      ['inventory-counts', { productId: d.a.id, actualUnits: '0', reason: 'Denied' }],
      [`/finance/cash/operations/${cash.cashOperationId}/void`, {}],
    ];
    for (const [path, body] of operations) expect((await f.request(path, body, { ...d.options, method: /\/(active|price)$/.test(path) ? 'PATCH' : 'POST' })).status, path).toBe(403);
    for (const path of ['categories','products','suppliers','receipts','stock','sales','folios','movements','report']) expect((await f.request(path, undefined, d.options)).status).toBe(200);
    expect(await f.db.barStockMovement.count({ where: { propertyId: side.property } })).toBe(before);
    expect((await f.db.barSale.findUniqueOrThrow({ where: { id: sale.body.id } })).status).toBe('POSTED');
    expect((await f.db.cashOperation.findUniqueOrThrow({ where: { id: cash.cashOperationId } })).status).toBe('COMPLETED');
  });
});
