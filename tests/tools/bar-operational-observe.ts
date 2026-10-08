/** Observations for unresolved financial policies, never acceptance of that policy. */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { barOperationalFixture } from './bar-operational-fixture';
const f = await barOperationalFixture();
try {
  const d = await f.prepare();
  await f.request(`receipts/${d.r1.id}/post`, {});
  await f.request(`receipts/${d.r2.id}/post`, {});
  const key = randomUUID();
  const input = { productId: d.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: key };
  // Discard the committed first response, then retry exactly and with changed payload.
  await f.request('sales/retail', input);
  const replay = await f.request('sales/retail', input);
  const changedPayload = await f.request('sales/retail', { ...input, quantityUnits: '2' });
  const paymentBody = { idempotencyKey: randomUUID(), amountMinor: '10000', method: 'CASH' };
  await f.request(`receipts/${d.r1.id}/payments`, paymentBody);
  await f.request(`receipts/${d.r1.id}/payments`, paymentBody);
  const payments = await f.db.barSupplierPayment.findMany({ where: { receiptId: d.r1.id } });
  const beforeVoid = await f.request('report');
  const voidResult = await f.request(`/finance/cash/operations/${payments[0]!.cashOperationId}/void`, {});
  const afterVoid = await f.request('report');
  const writeOffBody = { idempotencyKey: randomUUID(), productId: d.a.id, quantityUnits: '1', reason: 'Synthetic lost-response observation' };
  await f.request('write-offs', writeOffBody);
  await f.request('write-offs', writeOffBody);
  const writeOffCount = await f.db.barStockMovement.count({ where: { propertyId: f.primary.property, kind: 'WRITE_OFF' } });
  const staffReverse = await f.request(`sales/${replay.body.id}/reverse`, { restock: true, reason: 'Synthetic rights observation' }, { role: 'STAFF' });
  const staffFinanceVoid = await f.request(`/finance/cash/operations/${payments[1]!.cashOperationId}/void`, {}, { role: 'STAFF' });
  await mkdir('reports/bar-operational-20261007', { recursive: true });
  await writeFile('reports/bar-operational-20261007/policy-observations.json', JSON.stringify({ fixture: f.primary, replay, changedPayload, duplicatePaymentCount: payments.length, writeOffCount, beforeVoid, voidResult, afterVoid, staffReverse, staffFinanceVoid }, null, 2));
  await f.recoverOwnFixtures();
} finally { await f.close(); }
