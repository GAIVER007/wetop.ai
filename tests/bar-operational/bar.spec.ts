import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPrismaClient } from '@pms/database';
import pg from 'pg';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { isLocalDatabase } from '../tools/seed-local';

import { fullQaPorts } from '../onboarding-full/ports';
const qa = fullQaPorts.url;
if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
  throw new Error('Local synthetic DB required');
const db = createPrismaClient(process.env.DATABASE_URL!, 'pms_test');
test.afterAll(() => db.$disconnect());

async function prepare(request: APIRequestContext) {
  const response = await request.post(`${qa}/__qa/reset`, { data: { vertical: 'HOSPITALITY' } });
  expect(response.ok()).toBe(true);
  const f = await response.json();
  const login = await request.post(`${qa}/auth/login`, {
    data: { email: f.email, password: f.password },
  });
  expect(login.ok()).toBe(true);
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
    expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBe(true);
    return response.json();
  };
  const category = await call('categories', { name: 'QA operational', defaultMarkupBasis: 10000 });
  const supplier = await call('suppliers', { name: 'Synthetic supplier' });
  const product = (code: string) =>
    call('products', {
      code,
      name: `Synthetic ${code}`,
      categoryId: category.id,
      unitsPerPackage: 1,
      markupBasis: 10000,
      salePriceMinor: '100',
      minimumStockUnits: '0',
    });
  const a = await product('A'),
    b = await product('B');
  const receipt = (documentNumber: string, lines: Array<[string, string, string]>) =>
    call('receipts', {
      supplierId: supplier.id,
      documentNumber,
      documentDate: '2026-10-07',
      receivedDate: '2026-10-07',
      currency: 'KZT',
      lines: lines.map(([productId, quantityUnits, unitCostMinor]) => ({
        productId,
        quantityUnits,
        unitCostMinor,
        markupBasis: '10000',
      })),
    });
  const r1 = await receipt('R1', [
    [a.id, '10', '10000'],
    [b.id, '4', '5000'],
  ]);
  expect((await call('report')).stockCostMinor).toBe('0');
  await call(`receipts/${r1.id}/post`, {});
  const r2 = await receipt('R2', [[a.id, '10', '16000']]);
  await call(`receipts/${r2.id}/post`, {});
  expect(await call('report')).toMatchObject({
    purchasesMinor: '280000',
    stockCostMinor: '280000',
    supplierDebtMinor: '280000',
  });
  await call(`receipts/${r1.id}/payments`, { amountMinor: '60000', method: 'CASH' });
  const payload = {
    productId: a.id,
    quantityUnits: '12',
    method: 'CASH',
    idempotencyKey: randomUUID(),
  };
  const sale = await call('sales/retail', payload);
  expect(sale).toMatchObject({ status: 'POSTED', revenueMinor: '384000', costMinor: '132000' });
  expect(await call('report')).toMatchObject({
    stockCostMinor: '148000',
    supplierDebtMinor: '220000',
  });
  await mkdir('reports/unified-stage-2026-10-07/bar', { recursive: true });
  await writeFile(
    `reports/unified-stage-2026-10-07/bar/${sale.id}.json`,
    JSON.stringify(
      {
        organizationId: f.organizationId,
        locationId: f.locationId,
        saleId: sale.id,
        report: await call('report'),
      },
      null,
      2,
    ),
  );
  return { call, sale, payload, f, headers, r1, r2, a, b, receipt };
}

test('populated sales and movements are readable through real guarded HTTP API', async ({
  request,
}) => {
  const { call, sale } = await prepare(request);
  const sales = await call('sales');
  expect(sales).toHaveLength(1);
  expect(sales[0]).toMatchObject({
    id: sale.id,
    totalRevenue: '384000',
    totalCost: '132000',
    lines: [{ product: { name: 'Synthetic A' } }],
  });
  expect(await call('movements')).toHaveLength(5);
});

test('C13 replay after real reversal returns stored status without effects', async ({
  request,
}) => {
  const { call, sale, payload, headers, a } = await prepare(request);
  await call(`sales/${sale.id}/reverse`, { restock: true, reason: 'Synthetic C09' });
  const stored = await db.barSale.findUniqueOrThrow({ where: { id: sale.id } });
  expect(stored.status).toBe('REVERSED');
  const counts = async () => ({
    movements: await db.barStockMovement.count({ where: { sourceId: sale.id } }),
    sales: await db.barSale.count({ where: { idempotencyKey: payload.idempotencyKey } }),
    cash: await db.cashOperation.findUniqueOrThrow({ where: { id: stored.cashOperationId! } }),
    report: await call('report'),
  });
  const before = await counts();
  expect(before.cash.status).toBe('VOIDED');
  expect(before.report).toMatchObject({
    stockCostMinor: '280000',
    revenueMinor: '0',
    costMinor: '0',
  });
  const returns = await db.barStockMovement.findMany({
    where: { sourceId: sale.id, kind: 'SALE_RETURN' },
    orderBy: { unitCost: 'asc' },
  });
  expect(returns.map((row) => [row.units.toString(), row.unitCost.toString()])).toEqual([
    ['10', '10000'],
    ['2', '16000'],
  ]);
  const lots = await db.barStockLot.findMany({
    where: { productId: a.id },
    orderBy: { unitCost: 'asc' },
  });
  expect(lots.map((row) => row.remainingUnits.toString())).toEqual(['10', '10']);
  const again = await request.post(`${qa}/bar/sales/${sale.id}/reverse`, {
    headers,
    data: { restock: true, reason: 'Synthetic repeat C09' },
  });
  expect(again.status()).toBe(409);
  expect(await counts()).toEqual(before);
  expect(
    await db.barStockMovement.count({ where: { sourceId: sale.id, kind: 'SALE_RETURN' } }),
  ).toBe(2);
  const replay = await call('sales/retail', payload);
  expect(replay.status).toBe(stored.status);
  expect(await counts()).toEqual(before);
});

test('C06-C08 real folio charge, write-off and shortage reconcile integer amounts', async ({
  request,
}) => {
  const { call, f, payload } = await prepare(request);
  const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const category = await db.accommodationType.create({
    data: {
      propertyId: property.id,
      code: 'QA',
      name: 'Synthetic room',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
    },
  });
  const reservation = await db.reservation.create({
    data: {
      propertyId: property.id,
      confirmationNumber: `QA-${randomUUID()}`,
      source: 'DESK',
      status: 'CONFIRMED',
      arrivalDate: new Date('2026-10-07'),
      departureDate: new Date('2026-10-08'),
      adults: 1,
      currency: 'KZT',
      totalAmount: 0n,
      items: {
        create: {
          accommodationTypeId: category.id,
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
  const folio = reservation.items[0]!.folio!;
  const sale = await call('sales/folio', {
    folioId: folio.id,
    productId: payload.productId,
    quantityUnits: '3',
    idempotencyKey: randomUUID(),
  });
  const charge = await db.charge.findUniqueOrThrow({ where: { id: sale.chargeId } });
  expect(charge).toMatchObject({ kind: 'SERVICE', amount: 96000n });
  const cashBefore = await db.cashOperation.findMany({ where: { propertyId: property.id } });
  expect(cashBefore).toHaveLength(2);
  expect(
    cashBefore.reduce((sum, c) => sum + (c.kind === 'INCOME' ? c.amount : -c.amount), 0n),
  ).toBe(324000n);
  expect(await call('report')).toMatchObject({
    revenueMinor: '480000',
    costMinor: '180000',
    stockCostMinor: '100000',
  });
  await call('write-offs', {
    productId: payload.productId,
    quantityUnits: '1',
    reason: 'Synthetic C07',
  });
  expect(await call('report')).toMatchObject({ writeOffMinor: '16000', stockCostMinor: '84000' });
  await call('inventory-counts', {
    productId: payload.productId,
    actualUnits: '3',
    reason: 'Synthetic C08',
  });
  const beforeRepeat = await db.barStockMovement.count({ where: { propertyId: property.id } });
  await call('inventory-counts', {
    productId: payload.productId,
    actualUnits: '3',
    reason: 'Synthetic C08 repeat',
  });
  expect(await db.barStockMovement.count({ where: { propertyId: property.id } })).toBe(
    beforeRepeat,
  );
  const report = await call('report');
  expect(report).toMatchObject({
    purchasesMinor: '280000',
    supplierPaidMinor: '60000',
    revenueMinor: '480000',
    costMinor: '180000',
    grossProfitMinor: '300000',
    writeOffMinor: '16000',
    stockCostMinor: '68000',
    supplierDebtMinor: '220000',
  });
  expect(await db.cashOperation.findMany({ where: { propertyId: property.id } })).toEqual(
    cashBefore,
  );
  const shortage = await db.barStockMovement.findMany({
    where: { propertyId: property.id, kind: 'INVENTORY_ADJUSTMENT' },
  });
  expect(shortage).toHaveLength(1);
  expect(shortage[0]).toMatchObject({ units: -1n, unitCost: 16000n, createdById: f.userId });
  expect(180000n + 16000n + 16000n + BigInt(report.stockCostMinor)).toBe(280000n);
  const writeOff = await db.barStockMovement.findMany({
    where: { propertyId: property.id, kind: 'WRITE_OFF' },
  });
  expect(writeOff).toHaveLength(1);
  expect(writeOff[0]).toMatchObject({ units: -1n, unitCost: 16000n, createdById: f.userId });
  const audit = await db.auditLog.findFirstOrThrow({
    where: { entityId: writeOff[0]!.sourceId, action: 'bar.stock.written_off' },
  });
  expect(audit).toMatchObject({
    userId: f.userId,
    organizationId: f.organizationId,
    after: { reason: 'Synthetic C07', cost: '16000' },
  });
});

test('C11 invalid quantity and overpayment cause no effect; zero actual stock is valid', async ({
  request,
}) => {
  const { call, payload, headers, r1 } = await prepare(request);
  const before = await call('report');
  for (const quantityUnits of ['-1', '0', '1000']) {
    const response = await request.post(`${qa}/bar/sales/retail`, {
      headers,
      data: { ...payload, quantityUnits, idempotencyKey: randomUUID() },
    });
    expect(response.status()).toBe(quantityUnits === '1000' ? 409 : 400);
    expect(await call('report')).toEqual(before);
  }
  const overpay = await request.post(`${qa}/bar/receipts/${r1.id}/payments`, {
    headers,
    data: { amountMinor: '60001', method: 'CASH' },
  });
  expect(overpay.status()).toBe(409);
  expect(await call('report')).toEqual(before);
  await call('inventory-counts', {
    productId: payload.productId,
    actualUnits: '0',
    reason: 'Synthetic zero count',
  });
  expect(
    (await call('stock')).find((p: { id: string }) => p.id === payload.productId).availableUnits,
  ).toBe('0');
});

test('C14 read-only reads existing sales and rejects a new sale without effects', async ({
  request,
}) => {
  const { call, payload, headers } = await prepare(request);
  const before = await call('report');
  await request.post(`${qa}/__qa/access`, { data: { status: 'READ_ONLY' } });
  expect(await call('sales')).toHaveLength(1);
  const response = await request.post(`${qa}/bar/sales/retail`, {
    headers,
    data: { ...payload, idempotencyKey: randomUUID() },
  });
  expect(response.status()).toBe(403);
  expect(await call('report')).toEqual(before);
});

test('browser shows populated BAR and retains it after reload on a phone', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const { f } = await prepare(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/register/setup');
  await page.getByRole('main').getByLabel('Название категории').fill('Synthetic BAR room');
  await page
    .getByRole('main')
    .getByLabel(/Цена за ночь/)
    .fill('18000');
  await page.getByRole('main').getByLabel('Сколько мест').fill('1');
  await page.getByRole('button', { name: 'Запустить отель' }).click();
  await page.waitForURL('**/today');
  await page.goto('/bar');
  await expect(page.getByRole('heading', { name: 'Бар', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Продажи', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Synthetic AA', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeEmpty();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Synthetic AA', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeEmpty();
  await page.screenshot({
    path: 'reports/unified-stage-2026-10-07/bar/mobile-populated.png',
    fullPage: true,
    caret: 'initial',
  });
  expect(errors).toEqual([]);
});

test('C16 last-unit concurrent sales wait at a controlled real PostgreSQL barrier', async ({
  request,
}) => {
  const { call, payload, headers } = await prepare(request);
  await call('inventory-counts', {
    productId: payload.productId,
    actualUnits: '1',
    reason: 'Synthetic C16 baseline',
  });
  const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  await blocker.query('BEGIN');
  await blocker.query(
    'SELECT id FROM pms_test.bar_stock_lots WHERE product_id=$1 AND remaining_units>0 FOR UPDATE',
    [payload.productId],
  );
  const keys = [randomUUID(), randomUUID()];
  const requests = keys.map((idempotencyKey) =>
    request.post(`${qa}/bar/sales/retail`, {
      headers,
      data: { ...payload, quantityUnits: '1', idempotencyKey },
    }),
  );
  try {
    await expect
      .poll(async () => {
        await blocker.query('SELECT pg_stat_clear_snapshot()');
        const result = await blocker.query(
          "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%bar_stock_lots%'",
        );
        return result.rows[0].waiting;
      })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await blocker.query('COMMIT');
    await blocker.end();
  }
  const responses = await Promise.all(requests);
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
  expect(await db.barSale.count({ where: { idempotencyKey: { in: keys } } })).toBe(1);
  expect(
    (await call('stock')).find((p: { id: string }) => p.id === payload.productId).availableUnits,
  ).toBe('0');
});

test('C03 repeat receipt posting and C04 full supplier repayment preserve stock and reject excess', async ({
  request,
}) => {
  const { call, headers, r1, r2, f } = await prepare(request);
  const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const snapshot = async () => ({
    report: await call('report'),
    lots: await db.barStockLot.count({ where: { propertyId: property.id } }),
    movements: await db.barStockMovement.count({ where: { propertyId: property.id } }),
    cash: await db.cashOperation.count({ where: { propertyId: property.id } }),
  });
  const before = await snapshot();
  const repeat = await request.post(`${qa}/bar/receipts/${r1.id}/post`, { headers, data: {} });
  expect(repeat.status()).toBe(409);
  expect(await snapshot()).toEqual(before);
  await call(`receipts/${r1.id}/payments`, { amountMinor: '60000', method: 'CASH' });
  await call(`receipts/${r2.id}/payments`, { amountMinor: '160000', method: 'CASH' });
  expect(await call('report')).toMatchObject({
    supplierPaidMinor: '280000',
    supplierDebtMinor: '0',
    stockCostMinor: '148000',
  });
  const paid = await snapshot();
  expect(paid.lots).toBe(before.lots);
  expect(paid.movements).toBe(before.movements);
  expect(paid.cash).toBe(before.cash + 2);
  const excess = await request.post(`${qa}/bar/receipts/${r1.id}/payments`, {
    headers,
    data: { amountMinor: '1', method: 'CASH' },
  });
  expect(excess.status()).toBe(409);
  expect(await snapshot()).toEqual(paid);
});

test('C15 guarded HTTP denies foreign product, receipt and sale IDs without changing either tenant', async ({
  request,
}) => {
  const own = await prepare(request);
  const foreign = await prepare(request);
  const state = async () => ({
    own: await own.call('report'),
    foreign: await foreign.call('report'),
    ownSales: await own.call('sales'),
    foreignSales: await foreign.call('sales'),
    ownStock: await own.call('stock'),
    foreignStock: await foreign.call('stock'),
  });
  const before = await state();
  expect((await own.call('products')).some((row: { id: string }) => row.id === foreign.a.id)).toBe(
    false,
  );
  expect((await foreign.call('products')).some((row: { id: string }) => row.id === own.a.id)).toBe(
    false,
  );
  for (const [path, data] of [
    [
      'sales/retail',
      { productId: foreign.a.id, quantityUnits: '1', method: 'CASH', idempotencyKey: randomUUID() },
    ],
    [`receipts/${foreign.r1.id}/post`, {}],
    [`receipts/${foreign.r1.id}/payments`, { amountMinor: '1', method: 'CASH' }],
    [`sales/${foreign.sale.id}/reverse`, { restock: true, reason: 'Synthetic foreign denial' }],
    [
      'write-offs',
      { productId: foreign.a.id, quantityUnits: '1', reason: 'Synthetic foreign denial' },
    ],
  ] as const) {
    const response = await request.post(`${qa}/bar/${path}`, { headers: own.headers, data });
    expect(response.status(), path).toBe(404);
    expect(await state()).toEqual(before);
  }
  const price = await request.patch(`${qa}/bar/products/${foreign.a.id}/price`, {
    headers: own.headers,
    data: { salePriceMinor: '1' },
  });
  expect(price.status()).toBe(404);
  expect(await state()).toEqual(before);
});

async function concurrentAtRow(
  request: APIRequestContext,
  headers: Record<string, string>,
  table: 'bar_receipts' | 'bar_sales',
  id: string,
  path: string,
  data: unknown,
) {
  const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  await blocker.query('BEGIN');
  await blocker.query(`SELECT id FROM pms_test.${table} WHERE id=$1 FOR UPDATE`, [id]);
  const pending = [0, 1].map(() => request.post(`${qa}/bar/${path}`, { headers, data }));
  try {
    await expect
      .poll(async () => {
        await blocker.query('SELECT pg_stat_clear_snapshot()');
        const result = await blocker.query(
          "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
          [`%${table}%`],
        );
        return result.rows[0].waiting;
      })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await blocker.query('COMMIT');
    await blocker.end();
  }
  const replies = await Promise.all(pending);
  expect(replies.map((r) => r.status()).sort()).toEqual([201, 409]);
}

test('C16 simultaneous debt repayment creates one payment at the remaining-debt barrier', async ({
  request,
}) => {
  const { headers, r1, call } = await prepare(request);
  await concurrentAtRow(request, headers, 'bar_receipts', r1.id, `receipts/${r1.id}/payments`, {
    amountMinor: '60000',
    method: 'CASH',
  });
  const payments = await db.barSupplierPayment.findMany({ where: { receiptId: r1.id } });
  expect(payments).toHaveLength(2);
  expect(payments.reduce((n, row) => n + row.amount, 0n)).toBe(120000n);
  expect(await call('report')).toMatchObject({
    supplierPaidMinor: '120000',
    supplierDebtMinor: '160000',
    stockCostMinor: '148000',
  });
});

test('C16 simultaneous receipt posting creates exactly one lot and movement', async ({
  request,
}) => {
  const { headers, receipt, a } = await prepare(request);
  const draft = await receipt('R3', [[a.id, '1', '10000']]);
  await concurrentAtRow(
    request,
    headers,
    'bar_receipts',
    draft.id,
    `receipts/${draft.id}/post`,
    {},
  );
  const stored = await db.barReceipt.findUniqueOrThrow({
    where: { id: draft.id },
    include: { lines: true },
  });
  expect(stored.status).toBe('POSTED');
  expect(stored.lines).toHaveLength(1);
  expect(await db.barStockLot.count({ where: { receiptLineId: stored.lines[0]!.id } })).toBe(1);
  expect(await db.barStockMovement.count({ where: { sourceId: draft.id, kind: 'RECEIPT' } })).toBe(
    1,
  );
});

test('C16 simultaneous restock reversal creates one return per original lot', async ({
  request,
}) => {
  const { headers, sale, call } = await prepare(request);
  await concurrentAtRow(request, headers, 'bar_sales', sale.id, `sales/${sale.id}/reverse`, {
    restock: true,
    reason: 'Synthetic concurrent reversal',
  });
  const stored = await db.barSale.findUniqueOrThrow({ where: { id: sale.id } });
  expect(stored.status).toBe('REVERSED');
  expect(
    (await db.cashOperation.findUniqueOrThrow({ where: { id: stored.cashOperationId! } })).status,
  ).toBe('VOIDED');
  const returns = await db.barStockMovement.findMany({
    where: { sourceId: sale.id, kind: 'SALE_RETURN' },
    orderBy: { unitCost: 'asc' },
  });
  expect(returns.map((row) => [row.units.toString(), row.unitCost.toString()])).toEqual([
    ['10', '10000'],
    ['2', '16000'],
  ]);
  expect(await call('report')).toMatchObject({
    revenueMinor: '0',
    costMinor: '0',
    stockCostMinor: '280000',
  });
});

test('C13 browser retries a committed retail sale after lost response without a duplicate', async ({
  page,
  request,
}) => {
  const { f, a } = await prepare(request);
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/register/setup');
  await page.getByRole('main').getByLabel('Название категории').fill('Synthetic retry room');
  await page
    .getByRole('main')
    .getByLabel(/Цена за ночь/)
    .fill('18000');
  await page.getByRole('main').getByLabel('Сколько мест').fill('1');
  await page.getByRole('button', { name: 'Запустить отель' }).click();
  await page.waitForURL('**/today');
  await page.goto('/bar');
  const form = page
    .locator('form.bar-sale-form')
    .filter({ has: page.getByRole('button', { name: 'Продать', exact: true }) });
  await form.locator('[name=productId]').selectOption(a.id);
  await form.locator('[name=quantityUnits]').fill('1');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_after' } });
  const failedAction = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/bar' &&
      Boolean(response.request().headers()['next-action']),
  );
  await form.getByRole('button', { name: 'Продать', exact: true }).click();
  const actionResponse = await failedAction;
  expect(actionResponse.ok()).toBe(true);
  expect(await actionResponse.finished()).toBeNull();
  await expect(form.getByRole('alert')).toContainText('Нет ответа API');
  expect(
    await db.barSale.count({ where: { property: { organizationId: f.organizationId } } }),
  ).toBe(2);
  await expect(form.locator('[name=productId]')).toHaveValue(a.id);
  await expect(form.locator('[name=quantityUnits]')).toHaveValue('1');
  await form.locator('[name=quantityUnits]').fill('2');
  await form.getByRole('button', { name: 'Продать', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('ключ уже использован');
  expect(
    await db.barSale.count({ where: { property: { organizationId: f.organizationId } } }),
  ).toBe(2);
  await form.locator('[name=quantityUnits]').fill('1');
  await form.getByRole('button', { name: 'Продать', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Продажа записана');
  expect(
    await db.barSale.count({ where: { property: { organizationId: f.organizationId } } }),
  ).toBe(2);
  await form.getByRole('button', { name: 'Продать', exact: true }).click();
  await expect
    .poll(() => db.barSale.count({ where: { property: { organizationId: f.organizationId } } }))
    .toBe(3);
});

test('C01 unused barcode product can be archived without damaging existing history', async ({
  request,
}) => {
  const { call, headers } = await prepare(request);
  const history = await call('sales');
  const product = await call('products', {
    code: 'UNUSED',
    name: 'Synthetic unused',
    barcode: 'QA-000001',
    unitsPerPackage: 6,
    markupBasis: 2500,
    salePriceMinor: '50000',
    minimumStockUnits: '2',
  });
  expect(product).toMatchObject({
    code: 'UNUSED',
    barcode: 'QA-000001',
    unitsPerPackage: 6,
    markupBasis: 2500,
    salePrice: '50000',
    active: true,
  });
  const archived = await request.patch(`${qa}/bar/products/${product.id}/active`, {
    headers,
    data: { active: false },
  });
  expect(archived.status()).toBe(200);
  expect(
    (await call('products')).find((row: { id: string }) => row.id === product.id),
  ).toMatchObject({ active: false });
  expect(await call('sales')).toEqual(history);
  const count = (await call('products')).length;
  const invalid = await request.post(`${qa}/bar/products`, {
    headers,
    data: {
      code: 'INVALID',
      name: 'Synthetic invalid',
      unitsPerPackage: 0,
      salePriceMinor: '100',
      minimumStockUnits: '0',
    },
  });
  expect(invalid.status()).toBe(400);
  expect(await call('products')).toHaveLength(count);
});

test('C02 persisted multiline draft and repeated reads leave debt stock and cash unchanged', async ({
  request,
}) => {
  const { call, receipt, a, b, f } = await prepare(request);
  const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const snapshot = async () => ({
    report: await call('report'),
    stock: await call('stock'),
    cash: await db.cashOperation.count({ where: { propertyId: property.id } }),
    movements: await db.barStockMovement.count({ where: { propertyId: property.id } }),
  });
  const before = await snapshot();
  const draft = await receipt('Synthetic draft only', [
    [a.id, '10', '10000'],
    [b.id, '4', '5000'],
  ]);
  const stored = await db.barReceipt.findUniqueOrThrow({
    where: { id: draft.id },
    include: { lines: true },
  });
  expect(stored.status).toBe('DRAFT');
  expect(stored.postedAt).toBeNull();
  expect(stored.lines).toHaveLength(2);
  expect(stored.totalAmount).toBe(120000n);
  for (let i = 0; i < 2; i++) {
    expect(
      (await call('receipts')).find((row: { id: string }) => row.id === draft.id),
    ).toMatchObject({ status: 'DRAFT', totalAmount: '120000', _count: { lines: 2 } });
    expect(await snapshot()).toEqual(before);
  }
});

test('C13 same sale key with changed payload is rejected without effects', async ({ request }) => {
  const { call, headers, payload, f, b } = await prepare(request);
  const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const snapshot = async () => ({
    report: await call('report'),
    stock: await call('stock'),
    sales: await db.barSale.count({ where: { propertyId: property.id } }),
    cash: await db.cashOperation.count({ where: { propertyId: property.id } }),
  });
  const before = await snapshot();
  for (const change of [{ quantityUnits: '13' }, { productId: b.id }, { method: 'KASPI' }]) {
    const reply = await request.post(`${qa}/bar/sales/retail`, {
      headers,
      data: { ...payload, ...change },
    });
    expect(reply.status()).toBe(409);
    expect(await snapshot()).toEqual(before);
  }
  const destination = await request.post(`${qa}/bar/sales/folio`, {
    headers,
    data: { ...payload, folioId: randomUUID() },
  });
  expect(destination.status()).toBe(409);
  expect(await snapshot()).toEqual(before);
});

test('C13 simultaneous identical intent replays one sale after a controlled stock barrier', async ({
  request,
}) => {
  const { payload, headers } = await prepare(request);
  const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  await blocker.query('BEGIN');
  await blocker.query(
    'SELECT id FROM pms_test.bar_stock_lots WHERE product_id=$1 AND remaining_units>0 FOR UPDATE',
    [payload.productId],
  );
  const idempotencyKey = randomUUID();
  const data = { ...payload, quantityUnits: '1', idempotencyKey };
  const calls = [
    request.post(`${qa}/bar/sales/retail`, { headers, data }),
    request.post(`${qa}/bar/sales/retail`, { headers, data }),
  ];
  try {
    await expect
      .poll(async () => {
        await blocker.query('SELECT pg_stat_clear_snapshot()');
        const result = await blocker.query(
          "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE '%bar_stock_lots%' OR query LIKE '%pg_advisory_xact_lock%')",
        );
        return result.rows[0].waiting;
      })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await blocker.query('COMMIT');
    await blocker.end();
  }
  const replies = await Promise.all(calls);
  expect(replies.map((r) => r.status())).toEqual([201, 201]);
  const bodies = await Promise.all(replies.map((r) => r.json()));
  expect(bodies[0].id).toBe(bodies[1].id);
  expect(await db.barSale.count({ where: { idempotencyKey } })).toBe(1);
  expect(await db.barStockMovement.count({ where: { sourceId: bodies[0].id, kind: 'SALE' } })).toBe(
    1,
  );
});

test('C13 Folio browser preserves a committed charge and retries it without duplication', async ({
  page,
  request,
}) => {
  const { f, a } = await prepare(request);
  const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const category = await db.accommodationType.create({
    data: {
      propertyId: property.id,
      code: 'FRETRY',
      name: 'Synthetic Folio retry',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
    },
  });
  const reservation = await db.reservation.create({
    data: {
      propertyId: property.id,
      confirmationNumber: `QA-${randomUUID()}`,
      source: 'DESK',
      status: 'CONFIRMED',
      arrivalDate: new Date('2026-10-07'),
      departureDate: new Date('2026-10-08'),
      adults: 1,
      currency: 'KZT',
      totalAmount: 0n,
      items: {
        create: {
          accommodationTypeId: category.id,
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
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/bar');
  const form = page.locator('form.bar-folio-form');
  await form.locator('[name=folioId]').selectOption(folioId);
  await form.locator('[name=productId]').selectOption(a.id);
  await form.locator('[name=quantityUnits]').fill('1');
  await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_after' } });
  const failedAction = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/bar' &&
      Boolean(response.request().headers()['next-action']),
  );
  await form.getByRole('button', { name: 'Добавить в счет', exact: true }).click();
  const actionResponse = await failedAction;
  expect(actionResponse.ok()).toBe(true);
  expect(await actionResponse.finished()).toBeNull();
  await expect(form.getByRole('alert')).toContainText('Нет ответа API');
  await expect(form.locator('[name=folioId]')).toHaveValue(folioId);
  await expect(form.locator('[name=productId]')).toHaveValue(a.id);
  await expect(form.locator('[name=quantityUnits]')).toHaveValue('1');
  const count = () => db.charge.count({ where: { folioId } });
  expect(await count()).toBe(1);
  await form.getByRole('button', { name: 'Добавить в счет', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText(
    'Товар добавлен в счет гостя, остаток обновлен',
  );
  expect(await count()).toBe(1);
  await page.reload();
  expect(await count()).toBe(1);
  expect(await db.barSale.count({ where: { folioId } })).toBe(1);
});

test('C02 abandoning an unsaved receipt leaves stock debt cash and ledger unchanged', async ({
  page,
  request,
}) => {
  const { f, a, r1, call } = await prepare(request);
  const stored = await db.barReceipt.findUniqueOrThrow({ where: { id: r1.id } });
  const snapshot = async () => ({
    report: await call('report'),
    receipts: await db.barReceipt.count({ where: { propertyId: stored.propertyId } }),
    lots: await db.barStockLot.count({ where: { propertyId: stored.propertyId } }),
    movements: await db.barStockMovement.count({ where: { propertyId: stored.propertyId } }),
    cash: await db.cashOperation.count({ where: { propertyId: stored.propertyId } }),
  });
  const before = await snapshot();
  await page.goto('/auth/fallback');
  await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/register/setup');
  await page.getByRole('main').getByLabel('Название категории').fill('Synthetic unsaved room');
  await page
    .getByRole('main')
    .getByLabel(/Цена за ночь/)
    .fill('18000');
  await page.getByRole('main').getByLabel('Сколько мест').fill('1');
  await page.getByRole('button', { name: 'Запустить отель' }).click();
  await page.waitForURL('**/today');
  await page.goto('/bar');
  const form = page.locator('form.bar-receipt-form');
  await form.locator('[name=supplierId]').selectOption(stored.supplierId!);
  await form.locator('[name=documentNumber]').fill('UNSAVED-SYNTHETIC');
  await form.locator('[name="productId.0"]').selectOption(a.id);
  await form.locator('[name="quantityUnits.0"]').fill('3');
  await form.locator('[name="unitCost.0"]').fill('100');
  await expect(form.getByText('300 ₸', { exact: true })).toBeVisible();
  await page.goto('/today');
  await page.goto('/bar');
  await expect(page.locator('form.bar-receipt-form [name=documentNumber]')).toHaveValue('');
  expect(await snapshot()).toEqual(before);
});

test('C15 foreign receipt supplier and line product are rejected before any draft is saved', async ({
  request,
}) => {
  const own = await prepare(request);
  const foreign = await prepare(request);
  const ownReceipt = await db.barReceipt.findUniqueOrThrow({ where: { id: own.r1.id } });
  const foreignReceipt = await db.barReceipt.findUniqueOrThrow({ where: { id: foreign.r1.id } });
  const snapshot = async () => ({
    own: await own.call('report'),
    foreign: await foreign.call('report'),
    receipts: await db.barReceipt.findMany({
      where: { propertyId: { in: [ownReceipt.propertyId, foreignReceipt.propertyId] } },
      orderBy: { id: 'asc' },
      include: { lines: true },
    }),
  });
  const before = await snapshot();
  for (const [supplierId, productId] of [
    [foreignReceipt.supplierId!, own.a.id],
    [ownReceipt.supplierId!, foreign.a.id],
  ]) {
    const reply = await request.post(`${qa}/bar/receipts`, {
      headers: own.headers,
      data: {
        supplierId,
        documentNumber: 'SYNTHETIC-FOREIGN-DENIED',
        documentDate: '2026-10-07',
        receivedDate: '2026-10-07',
        currency: 'KZT',
        lines: [{ productId, quantityUnits: '1', unitCostMinor: '100', markupBasis: '0' }],
      },
    });
    expect(await snapshot()).toEqual(before);
    expect(reply.status()).toBe(404);
  }
});
