import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { it, expect } from 'vitest';
import { barOperationalFixture } from '../tools/bar-operational-fixture';

it('migration 66 reconstructs validated legacy identities/loss/debt and rejects partial restock without changing sources or audit', async () => {
  const f = await barOperationalFixture();
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c search_path=pms_test,public' });
  await db.connect();
  const directory = 'packages/database/prisma/migrations/20261007000066_bar_financial_replay';
  const down = readFileSync(`${directory}/down.sql`, 'utf8');
  const up = readFileSync(`${directory}/migration.sql`, 'utf8');
  try {
    const side = await f.side(), d = await f.prepare(side);
    for (const receipt of [d.r1,d.r2]) expect((await f.request(`receipts/${receipt.id}/post`, {}, d.options)).status).toBe(201);
    const restored = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect((await f.request(`sales/${restored.body.id}/reverse`, { restock: true, reason: 'Synthetic legacy restock' }, d.options)).status).toBe(201);
    const lost = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect((await f.request(`sales/${lost.body.id}/reverse`, { restock: false, reason: 'Synthetic legacy loss' }, d.options)).status).toBe(201);
    const folio = await f.request('sales/folio', { productId: d.a.id, quantityUnits: '1', folioId: side.folio, idempotencyKey: randomUUID() }, d.options);
    expect(folio.status).toBe(201);
    const paid = await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '60000', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    const payment = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: paid.body.id } });
    expect((await f.request(`/finance/cash/operations/${payment.cashOperationId}/void`, {}, d.options)).status).toBe(200);
    const originals = async () => ({
      sales: await f.db.barSale.findMany({ where: { propertyId: side.property }, orderBy: { id: 'asc' } }),
      payments: await f.db.barSupplierPayment.findMany({ where: { receipt: { propertyId: side.property } }, orderBy: { id: 'asc' } }),
      cash: await f.db.cashOperation.findMany({ where: { propertyId: side.property }, orderBy: { id: 'asc' } }),
      lots: await f.db.barStockLot.findMany({ where: { propertyId: side.property }, orderBy: { id: 'asc' } }),
      movements: await f.db.barStockMovement.findMany({ where: { propertyId: side.property }, orderBy: { id: 'asc' } }),
      audit: await f.db.auditLog.findMany({ where: { userId: f.user.id }, orderBy: { id: 'asc' } }),
    });
    const before = await originals();
    await db.query('BEGIN');
    try { await db.query(down); await db.query(up); await db.query('COMMIT'); }
    catch (error) { await db.query('ROLLBACK'); throw error; }
    expect(await originals()).toEqual(before);
    const intents = await f.db.barOperationIntent.findMany({ where: { propertyId: side.property } });
    expect(intents).toHaveLength(3);
    expect(intents.map(row => row.operationId).sort()).toEqual([restored.body.id,lost.body.id,folio.body.id].sort());
    expect(await f.db.barCostLoss.findFirstOrThrow({ where: { saleId: lost.body.id } })).toMatchObject({ amountMinor: 132000n });
    expect(await f.db.barSupplierPaymentReversal.findUniqueOrThrow({ where: { paymentId: paid.body.id } })).toMatchObject({ amountMinor: 60000n });
    // Rehearse malformed legacy history in a transaction, preserving the valid schema and sources on rollback.
    await db.query('BEGIN');
    try {
      await db.query(down);
      const removed = await db.query("DELETE FROM bar_stock_movements WHERE id=(SELECT id FROM bar_stock_movements WHERE source_type='BAR_SALE_RETURN' AND source_id=$1 ORDER BY id LIMIT 1) RETURNING id", [restored.body.id]);
      expect(removed.rowCount).toBe(1);
      await expect(db.query(up)).rejects.toThrow('Partial legacy BAR restock');
    } finally { await db.query('ROLLBACK'); }
    expect(await originals()).toEqual(before);
  } finally { await db.end(); await f.close(); }
});
