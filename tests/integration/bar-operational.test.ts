import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

describe('BAR operational acceptance: real HTTP and PostgreSQL', () => {
  let f: BarOperationalFixture;
  beforeAll(async () => { f = await barOperationalFixture(); });
  afterAll(async () => { await f?.close(); });
  async function stocked() {
    const side = await f.side();
    const data = await f.prepare(side);
    expect((await f.request(`receipts/${data.r1.id}/post`, {}, data.options)).status).toBe(201);
    expect((await f.request(`receipts/${data.r2.id}/post`, {}, data.options)).status).toBe(201);
    return { ...data, side };
  }
  async function report(options: Parameters<typeof f.request>[2]) {
    const response = await f.request('report', undefined, options);
    expect(response.status).toBe(200);
    return response.body;
  }
  async function effects(property: string) {
    return {
      sales: await f.db.barSale.count({ where: { propertyId: property } }),
      movements: await f.db.barStockMovement.count({ where: { propertyId: property } }),
      cash: await f.db.cashOperation.count({ where: { propertyId: property } }),
      lots: await f.db.barStockLot.findMany({ where: { propertyId: property }, orderBy: { id: 'asc' }, select: { id: true, remainingUnits: true } }),
    };
  }
  it('C01-C08 reconciles drafts, FIFO, cash, Folio, write-off and shortage in minor units', async () => {
    const side = await f.side();
    const d = await f.prepare(side);
    expect(await report(d.options)).toMatchObject({ purchasesMinor: '0', stockCostMinor: '0', supplierDebtMinor: '0' });
    expect((await f.db.barReceipt.findUniqueOrThrow({ where: { id: d.r1.id } })).totalAmount).toBe(120000n);
    await f.request(`receipts/${d.r1.id}/post`, {}, d.options);
    expect((await f.db.barProduct.findUniqueOrThrow({ where: { id: d.a.id } })).salePrice).toBe(20000n);
    await f.request(`receipts/${d.r2.id}/post`, {}, d.options);
    expect((await f.db.barProduct.findUniqueOrThrow({ where: { id: d.a.id } })).salePrice).toBe(32000n);
    expect(await report(d.options)).toMatchObject({ purchasesMinor: '280000', stockCostMinor: '280000', supplierDebtMinor: '280000' });
    const postedEffects = await effects(side.property);
    expect((await f.request(`receipts/${d.r1.id}/post`, {}, d.options)).status).toBe(409);
    expect(await effects(side.property)).toEqual(postedEffects);
    expect((await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '60000', method: 'CASH' }, d.options)).body).toMatchObject({ paidAmount: '60000', dueAmount: '60000' });
    expect(await report(d.options)).toMatchObject({ supplierPaidMinor: '60000', supplierDebtMinor: '220000', stockCostMinor: '280000' });
    const retail = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect(retail.status).toBe(201);
    expect(retail.body).toMatchObject({ revenueMinor: '384000', costMinor: '132000' });
    expect(await report(d.options)).toMatchObject({ stockCostMinor: '148000' });
    const saleMoves = await f.db.barStockMovement.findMany({ where: { sourceId: retail.body.id } });
    expect(saleMoves.map(m => [m.units.toString(), m.unitCost.toString()]).sort()).toEqual([['-10', '10000'], ['-2', '16000']]);
    const folio = await f.request('sales/folio', { folioId: side.folio, productId: d.a.id, quantityUnits: '3', idempotencyKey: randomUUID() }, d.options);
    expect(folio.body).toMatchObject({ revenueMinor: '96000', costMinor: '48000' });
    const charge = await f.db.charge.findUniqueOrThrow({ where: { id: folio.body.chargeId } });
    expect(charge).toMatchObject({ folioId: side.folio, kind: 'SERVICE', amount: 96000n });
    expect(await report(d.options)).toMatchObject({ stockCostMinor: '100000' });
    const writeOff = await f.request('write-offs', { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic spoilage' }, d.options);
    expect(writeOff.body.costMinor).toBe('16000');
    expect(await report(d.options)).toMatchObject({ stockCostMinor: '84000' });
    const countBody = { productId: d.a.id, actualUnits: '3', reason: 'Synthetic count' };
    const count = await f.request('inventory-counts', countBody, d.options);
    expect(count.body).toMatchObject({ differenceUnits: '-1', costMinor: '16000' });
    const beforeRepeat = await effects(side.property);
    expect((await f.request('inventory-counts', countBody, d.options)).body.differenceUnits).toBe('0');
    expect(await effects(side.property)).toEqual(beforeRepeat);
    expect(await report(d.options)).toMatchObject({ purchasesMinor: '280000', supplierPaidMinor: '60000', supplierDebtMinor: '220000', stockCostMinor: '68000', revenueMinor: '480000', costMinor: '180000', grossProfitMinor: '300000', writeOffMinor: '16000' });
    const cash = await f.db.cashOperation.findMany({ where: { propertyId: side.property, status: 'COMPLETED' } });
    expect(cash.reduce((sum, row) => sum + (row.kind === 'INCOME' ? row.amount : -row.amount), 0n)).toBe(324000n);
    const shortage = await f.db.barStockMovement.findMany({ where: { propertyId: side.property, kind: 'INVENTORY_ADJUSTMENT' } });
    expect(shortage).toHaveLength(1);
    expect(shortage[0]).toMatchObject({ units: -1n, unitCost: 16000n, createdById: f.user.id });
    expect(await f.db.auditLog.count({ where: { userId: f.user.id, entityId: retail.body.id, action: 'bar.sale.posted' } })).toBe(1);
  });
  it.each([true, false])('C09/C10 reversal restock=%s preserves exact stock and cash, repeat denies', async restock => {
    const d = await stocked();
    await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '60000', method: 'CASH' }, d.options);
    const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock, reason: 'Synthetic reversal' }, d.options)).status).toBe(201);
    expect(await report(d.options)).toMatchObject({ stockCostMinor: restock ? '280000' : '148000', revenueMinor: '0', costMinor: '0', writeOffMinor: '0', supplierDebtMinor: '220000' });
    const stored = await f.db.barSale.findUniqueOrThrow({ where: { id: sale.body.id }, include: { cashOperation: true } });
    expect(stored.status).toBe('REVERSED');
    expect(stored.cashOperation?.status).toBe('VOIDED');
    expect(await f.db.barStockMovement.count({ where: { sourceId: sale.body.id, kind: 'SALE_RETURN' } })).toBe(restock ? 2 : 0);
    const before = await effects(d.side.property);
    expect((await f.request(`sales/${sale.body.id}/reverse`, { restock, reason: 'Repeat' }, d.options)).status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
  });
  it.each(['retail', 'folio'])('C13 replay after void returns actual REVERSED status for %s without new effects', async channel => {
    const d = await stocked(), key = randomUUID();
    const input = { productId: d.a.id, quantityUnits: '1', method: 'CASH', folioId: d.side.folio, idempotencyKey: key };
    const sale = await f.request(`sales/${channel}`, input, d.options);
    expect(sale.status).toBe(201);
    const posted = await effects(d.side.property);
    expect((await f.request(`sales/${channel}`, input, d.options)).body.id).toBe(sale.body.id);
    expect(await effects(d.side.property)).toEqual(posted);
    await f.request(`sales/${sale.body.id}/reverse`, { restock: true, reason: 'Synthetic' }, d.options);
    const before = await effects(d.side.property);
    const replay = await f.request(`sales/${channel}`, input, d.options);
    expect(replay.body.status).toBe('REVERSED');
    expect(replay.body.id).toBe(sale.body.id);
    expect(await effects(d.side.property)).toEqual(before);
  });
  it('C11 invalid inputs and insufficient stock leave no partial effects', async () => {
    const d = await stocked(), before = await effects(d.side.property);
    for (const quantityUnits of ['-1', '0', '1.5', '21']) {
      const r = await f.request('sales/retail', { productId: d.a.id, quantityUnits, method: 'CASH', idempotencyKey: randomUUID() }, d.options);
      expect([400, 409]).toContain(r.status);
      expect(await effects(d.side.property)).toEqual(before);
    }
    expect((await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '120001', method: 'CASH' }, d.options)).status).toBe(409);
    expect(await effects(d.side.property)).toEqual(before);
    expect((await f.request('inventory-counts', { productId: d.b.id, actualUnits: '0', reason: 'Zero is valid' }, d.options)).status).toBe(201);
  });
  it('C15 foreign product, receipt, sale and Folio are denied without cross-property writes', async () => {
    const own = await stocked(), other = await stocked();
    const before = await effects(own.side.property), foreign = await effects(other.side.property);
    expect((await f.request('sales/retail', { productId: other.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, own.options)).status).toBe(404);
    expect((await f.request('sales/folio', { productId: own.a.id, folioId: other.side.folio, quantityUnits: '1', idempotencyKey: randomUUID() }, own.options)).status).toBe(404);
    expect((await f.request(`receipts/${other.r1.id}/payments`, { amountMinor: '1', method: 'CASH' }, own.options)).status).toBe(404);
    expect(await effects(own.side.property)).toEqual(before);
    expect(await effects(other.side.property)).toEqual(foreign);
  });
  it('C01 archives an unused product without affecting stock, and C04 pays remaining debt exactly', async () => {
    const d = await stocked();
    const unused = await f.request('products', { code: 'UNUSED', name: 'Synthetic unused', categoryId: d.category.id, unitsPerPackage: 1, salePriceMinor: '100', minimumStockUnits: '0' }, d.options);
    expect(unused.status).toBe(201);
    const before = await effects(d.side.property);
    expect((await f.request(`products/${unused.body.id}/active`, { active: false }, { ...d.options, method: 'PATCH' })).status).toBe(200);
    expect(await effects(d.side.property)).toEqual(before);
    for (const amountMinor of ['60000', '60000']) expect((await f.request(`receipts/${d.r1.id}/payments`, { amountMinor, method: 'CASH' }, d.options)).status).toBe(201);
    expect((await report(d.options)).supplierDebtMinor).toBe('160000');
    expect((await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '1', method: 'CASH' }, d.options)).status).toBe(409);
  });
  it('C14 current STAFF contract permits desk sales but denies catalog settings', async () => {
    const d = await stocked(), options = { ...d.options, role: 'STAFF' as const };
    expect((await f.request('report', undefined, options)).status).toBe(200);
    expect((await f.request('products', { name: 'Denied' }, options)).status).toBe(403);
    expect((await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, options)).status).toBe(201);
  });
  it.each(['last-unit', 'supplier-balance', 'receipt-post', 'sale-reverse'])('C16 controlled row-lock race: %s', async operation => {
    const d = await stocked();
    let table: string, id: string, path: string, body: Record<string, unknown>;
    if (operation === 'last-unit') {
      await f.request('inventory-counts', { productId: d.a.id, actualUnits: '1', reason: 'Prepare last unit' }, d.options);
      const lot = await f.db.barStockLot.findFirstOrThrow({ where: { productId: d.a.id, remainingUnits: { gt: 0 } } });
      table = 'bar_stock_lots'; id = lot.id; path = 'sales/retail';
      body = { productId: d.a.id, quantityUnits: '1', method: 'CASH' };
    } else if (operation === 'supplier-balance') {
      table = 'bar_receipts'; id = d.r1.id; path = `receipts/${id}/payments`; body = { amountMinor: '120000', method: 'CASH' };
    } else if (operation === 'receipt-post') {
      const draft = await f.request('receipts', { supplierId: d.supplier.id, documentNumber: 'Race', documentDate: '2026-10-07', receivedDate: '2026-10-07', currency: 'KZT', lines: [{ productId: d.a.id, quantityUnits: '1', unitCostMinor: '16000', markupBasis: 10000 }] }, d.options);
      table = 'bar_receipts'; id = draft.body.id; path = `receipts/${id}/post`; body = {};
    } else {
      const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
      table = 'bar_sales'; id = sale.body.id; path = `sales/${id}/reverse`; body = { restock: true, reason: 'Race' };
    }
    const barrier = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c search_path=pms_test,public' });
    await barrier.connect();
    let pending: Array<Promise<Awaited<ReturnType<typeof f.request>>>> = [];
    try {
      await barrier.query('BEGIN');
      await barrier.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
      pending = [0, 1].map(() => f.request(path, { ...body, ...(operation === 'last-unit' ? { idempotencyKey: randomUUID() } : {}) }, d.options));
      const deadline = Date.now() + 5000;
      let waiting = 0;
      while (Date.now() < deadline) {
        await barrier.query('SELECT pg_stat_clear_snapshot()');
        const result = await barrier.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type=\'Lock\' AND query LIKE $1', [`%${table}%`]);
        waiting = result.rows[0].n;
        if (waiting >= 2) break;
        // Poll an observed lock condition; this delay does not determine who wins.
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting, 'both HTTP transactions must demonstrably wait at the database barrier').toBeGreaterThanOrEqual(2);
      await barrier.query('COMMIT');
      const results = await Promise.all(pending);
      expect(results.map(r => r.status).sort()).toEqual([201, 409]);
      if (operation === 'last-unit') {
        expect(await f.db.barSale.count({ where: { propertyId: d.side.property } })).toBe(1);
        expect((await f.db.barStockLot.aggregate({ where: { productId: d.a.id }, _sum: { remainingUnits: true } }))._sum.remainingUnits).toBe(0n);
      } else if (operation === 'supplier-balance') {
        expect(await f.db.barSupplierPayment.count({ where: { receiptId: id } })).toBe(1);
        expect((await report(d.options)).supplierDebtMinor).toBe('160000');
      } else if (operation === 'receipt-post') {
        expect(await f.db.barStockLot.count({ where: { receiptLine: { receiptId: id } } })).toBe(1);
      } else {
        expect(await f.db.barStockMovement.count({ where: { sourceId: id, kind: 'SALE_RETURN' } })).toBe(1);
        expect((await report(d.options)).stockCostMinor).toBe('280000');
      }
    } finally {
      await barrier.query('ROLLBACK');
      await Promise.allSettled(pending);
      await barrier.end();
    }
  });
});
