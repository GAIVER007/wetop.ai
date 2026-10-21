import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { barOperationalFixture, type BarOperationalFixture } from '../tools/bar-operational-fixture';

let f: BarOperationalFixture;
const fixtures: Array<Awaited<ReturnType<BarOperationalFixture['prepare']>> & { cashId: string; paymentId: string }> = [];
beforeAll(async () => {
  f = await barOperationalFixture(0, true);
  for (let index = 0; index < 3; index++) {
    const d = await f.prepare(await f.side());
    for (const receipt of [d.r1, d.r2]) expect((await f.request(`receipts/${receipt.id}/post`, {}, d.options)).status).toBe(201);
    const paid = await f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '60000', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
    expect(paid.status).toBe(201);
    const payment = await f.db.barSupplierPayment.findUniqueOrThrow({ where: { id: paid.body.id } });
    fixtures.push({ ...d, cashId: payment.cashOperationId, paymentId: payment.id });
  }
});
afterAll(async () => { await f?.close(); });

it.each(['void-first', 'pay-first'])('T10 shared receipt lock serializes %s without overpayment or duplicate compensation', async order => {
  const d = fixtures[order === 'void-first' ? 0 : 1]!;
  const barrier = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c search_path=pms_test,public' });
  await barrier.connect();
  const pending: Array<Promise<Awaited<ReturnType<typeof f.request>>>> = [];
  const waiting = async (count: number) => {
    const deadline = Date.now() + 1500;
    let observed = 0;
    while (Date.now() < deadline) {
      await barrier.query('SELECT pg_stat_clear_snapshot()');
      observed = (await barrier.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%bar_receipts%FOR UPDATE%'")).rows[0].n;
      if (observed >= count) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(observed, 'requests observed waiting on the shared receipt lock').toBeGreaterThanOrEqual(count);
  };
  const pay = () => f.request(`receipts/${d.r1.id}/payments`, { amountMinor: '120000', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
  const voidPayment = () => f.request(`/finance/cash/operations/${d.cashId}/void`, {}, d.options);
  try {
    await barrier.query('BEGIN');
    await barrier.query('SELECT id FROM bar_receipts WHERE id=$1 FOR UPDATE', [d.r1.id]);
    pending.push(order === 'void-first' ? voidPayment() : pay());
    await waiting(1);
    pending.push(order === 'void-first' ? pay() : voidPayment());
    await waiting(2);
    await barrier.query('COMMIT');
    const responses = await Promise.all(pending);
    const voidResult = responses[order === 'void-first' ? 0 : 1]!;
    const payResult = responses[order === 'void-first' ? 1 : 0]!;
    expect(voidResult.status).toBe(200);
    expect(payResult.status).toBe(order === 'void-first' ? 201 : 409);
    expect(await f.db.barSupplierPaymentReversal.count({ where: { paymentId: d.paymentId } })).toBe(1);
    expect((await f.db.cashOperation.findUniqueOrThrow({ where: { id: d.cashId } })).status).toBe('VOIDED');
    const receipt = await f.db.barReceipt.findUniqueOrThrow({ where: { id: d.r1.id }, include: { payments: { where: { cashOperation: { status: 'COMPLETED' } } } } });
    const paid = receipt.payments.reduce((sum, payment) => sum + payment.amount, 0n);
    expect(paid).toBe(order === 'void-first' ? 120000n : 0n);
    expect(paid).toBeLessThanOrEqual(receipt.totalAmount);
    expect((await f.request('report', undefined, d.options)).body).toMatchObject({ supplierPaidMinor: paid.toString(), supplierDebtMinor: (280000n - paid).toString(), stockCostMinor: '280000' });
  } finally { await barrier.query('ROLLBACK'); await Promise.allSettled(pending); await barrier.end(); }
});

it('T10 ordinary write-off stays separate from no-restock FIFO loss without a second loss or warehouse decrement', async () => {
  const d = fixtures[2]!;
  const sale = await f.request('sales/retail', { productId: d.a.id, quantityUnits: '12', method: 'CASH', idempotencyKey: randomUUID() }, d.options);
  expect(sale.status).toBe(201);
  expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Synthetic loss mixed with write-off' }, d.options)).status).toBe(201);
  expect((await f.request('write-offs', { productId: d.a.id, quantityUnits: '1', reason: 'Synthetic ordinary spoilage', idempotencyKey: randomUUID() }, d.options)).status).toBe(201);
  const report = await f.request('report', undefined, d.options);
  expect(report.body).toMatchObject({ nonRestockedLossMinor: '132000', writeOffMinor: '16000', stockCostMinor: '132000', revenueMinor: '0', costMinor: '0' });
  expect(await f.db.barCostLoss.count({ where: { saleId: sale.body.id } })).toBe(1);
  expect((await f.request(`sales/${sale.body.id}/reverse`, { restock: false, reason: 'Repeated synthetic loss' }, d.options)).status).toBe(409);
  expect((await f.request('report', undefined, d.options)).body).toEqual(report.body);
});
