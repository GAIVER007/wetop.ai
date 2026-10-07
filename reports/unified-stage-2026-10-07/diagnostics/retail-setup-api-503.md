# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bar.spec.ts >> C13 browser retries a committed retail sale after lost response without a duplicate
- Location: tests/bar-operational/bar.spec.ts:591:1

# Error details

```
Test timeout of 150000ms exceeded.
```

```
Error: locator.fill: Test timeout of 150000ms exceeded.
Call log:
  - waiting for getByRole('main').getByLabel('Название категории')

```

# Test source

```ts
  502 |     await expect
  503 |       .poll(async () => {
  504 |         await blocker.query('SELECT pg_stat_clear_snapshot()');
  505 |         const result = await blocker.query(
  506 |           "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
  507 |           [`%${table}%`],
  508 |         );
  509 |         return result.rows[0].waiting;
  510 |       })
  511 |       .toBeGreaterThanOrEqual(2);
  512 |   } finally {
  513 |     await blocker.query('COMMIT');
  514 |     await blocker.end();
  515 |   }
  516 |   const replies = await Promise.all(pending);
  517 |   expect(replies.map((r) => r.status()).sort()).toEqual([201, 409]);
  518 | }
  519 | 
  520 | test('C16 simultaneous debt repayment creates one payment at the remaining-debt barrier', async ({
  521 |   request,
  522 | }) => {
  523 |   const { headers, r1, call } = await prepare(request);
  524 |   await concurrentAtRow(request, headers, 'bar_receipts', r1.id, `receipts/${r1.id}/payments`, {
  525 |     amountMinor: '60000',
  526 |     method: 'CASH',
  527 |   });
  528 |   const payments = await db.barSupplierPayment.findMany({ where: { receiptId: r1.id } });
  529 |   expect(payments).toHaveLength(2);
  530 |   expect(payments.reduce((n, row) => n + row.amount, 0n)).toBe(120000n);
  531 |   expect(await call('report')).toMatchObject({
  532 |     supplierPaidMinor: '120000',
  533 |     supplierDebtMinor: '160000',
  534 |     stockCostMinor: '148000',
  535 |   });
  536 | });
  537 | 
  538 | test('C16 simultaneous receipt posting creates exactly one lot and movement', async ({
  539 |   request,
  540 | }) => {
  541 |   const { headers, receipt, a } = await prepare(request);
  542 |   const draft = await receipt('R3', [[a.id, '1', '10000']]);
  543 |   await concurrentAtRow(
  544 |     request,
  545 |     headers,
  546 |     'bar_receipts',
  547 |     draft.id,
  548 |     `receipts/${draft.id}/post`,
  549 |     {},
  550 |   );
  551 |   const stored = await db.barReceipt.findUniqueOrThrow({
  552 |     where: { id: draft.id },
  553 |     include: { lines: true },
  554 |   });
  555 |   expect(stored.status).toBe('POSTED');
  556 |   expect(stored.lines).toHaveLength(1);
  557 |   expect(await db.barStockLot.count({ where: { receiptLineId: stored.lines[0]!.id } })).toBe(1);
  558 |   expect(await db.barStockMovement.count({ where: { sourceId: draft.id, kind: 'RECEIPT' } })).toBe(
  559 |     1,
  560 |   );
  561 | });
  562 | 
  563 | test('C16 simultaneous restock reversal creates one return per original lot', async ({
  564 |   request,
  565 | }) => {
  566 |   const { headers, sale, call } = await prepare(request);
  567 |   await concurrentAtRow(request, headers, 'bar_sales', sale.id, `sales/${sale.id}/reverse`, {
  568 |     restock: true,
  569 |     reason: 'Synthetic concurrent reversal',
  570 |   });
  571 |   const stored = await db.barSale.findUniqueOrThrow({ where: { id: sale.id } });
  572 |   expect(stored.status).toBe('REVERSED');
  573 |   expect(
  574 |     (await db.cashOperation.findUniqueOrThrow({ where: { id: stored.cashOperationId! } })).status,
  575 |   ).toBe('VOIDED');
  576 |   const returns = await db.barStockMovement.findMany({
  577 |     where: { sourceId: sale.id, kind: 'SALE_RETURN' },
  578 |     orderBy: { unitCost: 'asc' },
  579 |   });
  580 |   expect(returns.map((row) => [row.units.toString(), row.unitCost.toString()])).toEqual([
  581 |     ['10', '10000'],
  582 |     ['2', '16000'],
  583 |   ]);
  584 |   expect(await call('report')).toMatchObject({
  585 |     revenueMinor: '0',
  586 |     costMinor: '0',
  587 |     stockCostMinor: '280000',
  588 |   });
  589 | });
  590 | 
  591 | test('C13 browser retries a committed retail sale after lost response without a duplicate', async ({
  592 |   page,
  593 |   request,
  594 | }) => {
  595 |   const { f, a } = await prepare(request);
  596 |   await page.goto('/auth/fallback');
  597 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  598 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  599 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  600 |   await page.waitForURL('**/today');
  601 |   await page.goto('/register/setup');
> 602 |   await page.getByRole('main').getByLabel('Название категории').fill('Synthetic retry room');
      |                                                                 ^ Error: locator.fill: Test timeout of 150000ms exceeded.
  603 |   await page
  604 |     .getByRole('main')
  605 |     .getByLabel(/Цена за ночь/)
  606 |     .fill('18000');
  607 |   await page.getByRole('main').getByLabel('Сколько мест').fill('1');
  608 |   await page.getByRole('button', { name: 'Запустить отель' }).click();
  609 |   await page.waitForURL('**/today');
  610 |   await page.goto('/bar');
  611 |   const form = page
  612 |     .locator('form.bar-sale-form')
  613 |     .filter({ has: page.getByRole('button', { name: 'Продать', exact: true }) });
  614 |   await form.locator('[name=productId]').selectOption(a.id);
  615 |   await form.locator('[name=quantityUnits]').fill('1');
  616 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_after' } });
  617 |   const failedAction = page.waitForResponse(
  618 |     (response) =>
  619 |       response.request().method() === 'POST' &&
  620 |       new URL(response.url()).pathname === '/bar' &&
  621 |       Boolean(response.request().headers()['next-action']),
  622 |   );
  623 |   await form.getByRole('button', { name: 'Продать', exact: true }).click();
  624 |   const actionResponse = await failedAction;
  625 |   expect(actionResponse.ok()).toBe(true);
  626 |   expect(await actionResponse.finished()).toBeNull();
  627 |   await expect(form.getByRole('alert')).toContainText('Нет ответа API');
  628 |   expect(
  629 |     await db.barSale.count({ where: { property: { organizationId: f.organizationId } } }),
  630 |   ).toBe(2);
  631 |   await expect(form.locator('[name=productId]')).toHaveValue(a.id);
  632 |   await expect(form.locator('[name=quantityUnits]')).toHaveValue('1');
  633 |   await form.locator('[name=quantityUnits]').fill('2');
  634 |   await form.getByRole('button', { name: 'Продать', exact: true }).click();
  635 |   await expect(form.getByRole('alert')).toContainText('ключ уже использован');
  636 |   expect(
  637 |     await db.barSale.count({ where: { property: { organizationId: f.organizationId } } }),
  638 |   ).toBe(2);
  639 |   await form.locator('[name=quantityUnits]').fill('1');
  640 |   await form.getByRole('button', { name: 'Продать', exact: true }).click();
  641 |   await expect(form.getByRole('status')).toContainText('Продажа записана');
  642 |   expect(
  643 |     await db.barSale.count({ where: { property: { organizationId: f.organizationId } } }),
  644 |   ).toBe(2);
  645 |   await form.getByRole('button', { name: 'Продать', exact: true }).click();
  646 |   await expect
  647 |     .poll(() => db.barSale.count({ where: { property: { organizationId: f.organizationId } } }))
  648 |     .toBe(3);
  649 | });
  650 | 
  651 | test('C01 unused barcode product can be archived without damaging existing history', async ({
  652 |   request,
  653 | }) => {
  654 |   const { call, headers } = await prepare(request);
  655 |   const history = await call('sales');
  656 |   const product = await call('products', {
  657 |     code: 'UNUSED',
  658 |     name: 'Synthetic unused',
  659 |     barcode: 'QA-000001',
  660 |     unitsPerPackage: 6,
  661 |     markupBasis: 2500,
  662 |     salePriceMinor: '50000',
  663 |     minimumStockUnits: '2',
  664 |   });
  665 |   expect(product).toMatchObject({
  666 |     code: 'UNUSED',
  667 |     barcode: 'QA-000001',
  668 |     unitsPerPackage: 6,
  669 |     markupBasis: 2500,
  670 |     salePrice: '50000',
  671 |     active: true,
  672 |   });
  673 |   const archived = await request.patch(`${qa}/bar/products/${product.id}/active`, {
  674 |     headers,
  675 |     data: { active: false },
  676 |   });
  677 |   expect(archived.status()).toBe(200);
  678 |   expect(
  679 |     (await call('products')).find((row: { id: string }) => row.id === product.id),
  680 |   ).toMatchObject({ active: false });
  681 |   expect(await call('sales')).toEqual(history);
  682 |   const count = (await call('products')).length;
  683 |   const invalid = await request.post(`${qa}/bar/products`, {
  684 |     headers,
  685 |     data: {
  686 |       code: 'INVALID',
  687 |       name: 'Synthetic invalid',
  688 |       unitsPerPackage: 0,
  689 |       salePriceMinor: '100',
  690 |       minimumStockUnits: '0',
  691 |     },
  692 |   });
  693 |   expect(invalid.status()).toBe(400);
  694 |   expect(await call('products')).toHaveLength(count);
  695 | });
  696 | 
  697 | test('C02 persisted multiline draft and repeated reads leave debt stock and cash unchanged', async ({
  698 |   request,
  699 | }) => {
  700 |   const { call, receipt, a, b, f } = await prepare(request);
  701 |   const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  702 |   const snapshot = async () => ({
```