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
  const call = async (path: string, data?: unknown) => {
    const response =
      data === undefined
        ? await request.get(`${qa}/bar/${path}`, { headers })
        : await request.post(`${qa}/bar/${path}`, { headers, data });
    expect(response.status(), path).toBe(data === undefined ? 200 : 201);
    return response.json();
  };
  const supplier = await call('suppliers', { name: 'Synthetic repeat supplier' });
  const product = await call('products', {
    code: 'REPEAT',
    name: 'Synthetic repeat stock',
    salePriceMinor: '20000',
    unitsPerPackage: 1,
    minimumStockUnits: '0',
  });
  const receipt = await call('receipts', {
    supplierId: supplier.id,
    documentNumber: 'Synthetic repeat receipt',
    documentDate: '2026-10-07',
    receivedDate: '2026-10-07',
    currency: 'KZT',
    lines: [
      { productId: product.id, quantityUnits: '10', unitCostMinor: '10000', markupBasis: '10000' },
    ],
  });
  await call(`receipts/${receipt.id}/post`, {});
  return { headers, call, product, receipt };
}

async function record(value: unknown) {
  await mkdir('reports/unified-stage-2026-10-07', { recursive: true });
  await appendFile(
    'reports/unified-stage-2026-10-07/repeat-guarantees-2026-10-08.jsonl',
    `${JSON.stringify(value)}\n`,
  );
}

// Historical duplicate observations remain in repeat-risks.jsonl. This suite verifies the accepted repair.
test('C04/C13 supplier payment lost response replays one committed payment', async ({
  request,
}) => {
  const f = await fixture(request);
  const data = { amountMinor: '10000', method: 'CASH', idempotencyKey: randomUUID() };
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_supplier_after' } });
  const outcome = await request
    .post(`${qa}/bar/receipts/${f.receipt.id}/payments`, {
      headers: f.headers,
      data,
      maxRetries: 0,
    })
    .then(
      () => 'response',
      () => 'transport error',
    );
  expect(outcome).toBe('transport error');
  expect(await db.barSupplierPayment.count({ where: { receiptId: f.receipt.id } })).toBe(1);
  expect((await f.call('report')).supplierDebtMinor).toBe('90000');
  await f.call(`receipts/${f.receipt.id}/payments`, data);
  expect(await db.barSupplierPayment.count({ where: { receiptId: f.receipt.id } })).toBe(1);
  expect((await f.call('report')).supplierDebtMinor).toBe('90000');
  const beforeConflict = await f.call('report');
  const conflict = await request.post(
    `${qa}/bar/${'productId' in data ? 'write-offs' : `receipts/${f.receipt.id}/payments`}`,
    {
      headers: f.headers,
      data: {
        ...data,
        ...('productId' in data ? { quantityUnits: '2' } : { amountMinor: '20000' }),
      },
    },
  );
  expect(conflict.status()).toBe(409);
  expect(await f.call('report')).toEqual(beforeConflict);
  await record({
    scenario: 'C04/C13',
    result: 'PASS',
    variant: 'same payment after lost committed response',
    effects: 1,
    debtBeforeMinor: '100000',
    afterFirstMinor: '90000',
    afterRepeatMinor: '90000',
    policyAccepted: true,
  });
});

test('C07/C13 write-off lost response replays one committed movement', async ({ request }) => {
  const f = await fixture(request);
  const data = {
    idempotencyKey: randomUUID(),
    productId: f.product.id,
    quantityUnits: '1',
    reason: `Synthetic repeated write-off ${randomUUID()}`,
  };
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_writeoff_after' } });
  const outcome = await request
    .post(`${qa}/bar/write-offs`, { headers: f.headers, data, maxRetries: 0 })
    .then(
      () => 'response',
      () => 'transport error',
    );
  expect(outcome).toBe('transport error');
  expect((await f.call('report')).writeOffMinor).toBe('10000');
  await f.call('write-offs', data);
  expect((await f.call('report')).writeOffMinor).toBe('10000');
  expect(
    await db.barStockMovement.count({ where: { productId: f.product.id, kind: 'WRITE_OFF' } }),
  ).toBe(1);
  expect((await f.call('report')).stockCostMinor).toBe('90000');
  const beforeConflict = await f.call('report');
  const conflict = await request.post(
    `${qa}/bar/${'productId' in data ? 'write-offs' : `receipts/${f.receipt.id}/payments`}`,
    {
      headers: f.headers,
      data: {
        ...data,
        ...('productId' in data ? { quantityUnits: '2' } : { amountMinor: '20000' }),
      },
    },
  );
  expect(conflict.status()).toBe(409);
  expect(await f.call('report')).toEqual(beforeConflict);
  await record({
    scenario: 'C07/C13',
    result: 'PASS',
    variant: 'same write-off after lost committed response',
    effects: 1,
    writeOffAfterFirstMinor: '10000',
    writeOffAfterRepeatMinor: '10000',
    stockBeforeMinor: '100000',
    stockAfterRepeatMinor: '90000',
    policyAccepted: true,
  });
});
