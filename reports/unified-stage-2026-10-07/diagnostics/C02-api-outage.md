# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bar.spec.ts >> C02 abandoning an unsaved receipt leaves stock debt cash and ledger unchanged
- Location: tests/bar-operational/bar.spec.ts:850:1

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
  770 |     await blocker.end();
  771 |   }
  772 |   const replies = await Promise.all(calls);
  773 |   expect(replies.map((r) => r.status())).toEqual([201, 201]);
  774 |   const bodies = await Promise.all(replies.map((r) => r.json()));
  775 |   expect(bodies[0].id).toBe(bodies[1].id);
  776 |   expect(await db.barSale.count({ where: { idempotencyKey } })).toBe(1);
  777 |   expect(await db.barStockMovement.count({ where: { sourceId: bodies[0].id, kind: 'SALE' } })).toBe(
  778 |     1,
  779 |   );
  780 | });
  781 | 
  782 | test('C13 Folio browser preserves a committed charge and retries it without duplication', async ({
  783 |   page,
  784 |   request,
  785 | }) => {
  786 |   const { f, a } = await prepare(request);
  787 |   const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  788 |   const category = await db.accommodationType.create({
  789 |     data: {
  790 |       propertyId: property.id,
  791 |       code: 'FRETRY',
  792 |       name: 'Synthetic Folio retry',
  793 |       kind: 'PRIVATE_ROOM',
  794 |       capacityAdults: 1,
  795 |     },
  796 |   });
  797 |   const reservation = await db.reservation.create({
  798 |     data: {
  799 |       propertyId: property.id,
  800 |       confirmationNumber: `QA-${randomUUID()}`,
  801 |       source: 'DESK',
  802 |       status: 'CONFIRMED',
  803 |       arrivalDate: new Date('2026-10-07'),
  804 |       departureDate: new Date('2026-10-08'),
  805 |       adults: 1,
  806 |       currency: 'KZT',
  807 |       totalAmount: 0n,
  808 |       items: {
  809 |         create: {
  810 |           accommodationTypeId: category.id,
  811 |           arrivalDate: new Date('2026-10-07'),
  812 |           departureDate: new Date('2026-10-08'),
  813 |           price: 0n,
  814 |           status: 'CONFIRMED',
  815 |           folio: { create: { currency: 'KZT' } },
  816 |         },
  817 |       },
  818 |     },
  819 |     include: { items: { include: { folio: true } } },
  820 |   });
  821 |   const folioId = reservation.items[0]!.folio!.id;
  822 |   await page.goto('/auth/fallback');
  823 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  824 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  825 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  826 |   await page.waitForURL('**/today');
  827 |   await page.goto('/bar');
  828 |   const form = page.locator('form.bar-folio-form');
  829 |   await form.locator('[name=folioId]').selectOption(folioId);
  830 |   await form.locator('[name=productId]').selectOption(a.id);
  831 |   await form.locator('[name=quantityUnits]').fill('1');
  832 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_after' } });
  833 |   await form.getByRole('button', { name: 'Добавить в счет', exact: true }).click();
  834 |   await expect(form.getByRole('alert')).toContainText('Нет ответа API');
  835 |   await expect(form.locator('[name=folioId]')).toHaveValue(folioId);
  836 |   await expect(form.locator('[name=productId]')).toHaveValue(a.id);
  837 |   await expect(form.locator('[name=quantityUnits]')).toHaveValue('1');
  838 |   const count = () => db.charge.count({ where: { folioId } });
  839 |   expect(await count()).toBe(1);
  840 |   await form.getByRole('button', { name: 'Добавить в счет', exact: true }).click();
  841 |   await expect(form.getByRole('status')).toHaveText(
  842 |     'Товар добавлен в счет гостя, остаток обновлен',
  843 |   );
  844 |   expect(await count()).toBe(1);
  845 |   await page.reload();
  846 |   expect(await count()).toBe(1);
  847 |   expect(await db.barSale.count({ where: { folioId } })).toBe(1);
  848 | });
  849 | 
  850 | test('C02 abandoning an unsaved receipt leaves stock debt cash and ledger unchanged', async ({
  851 |   page,
  852 |   request,
  853 | }) => {
  854 |   const { f, a, r1, call } = await prepare(request);
  855 |   const stored = await db.barReceipt.findUniqueOrThrow({ where: { id: r1.id } });
  856 |   const snapshot = async () => ({
  857 |     report: await call('report'),
  858 |     receipts: await db.barReceipt.count({ where: { propertyId: stored.propertyId } }),
  859 |     lots: await db.barStockLot.count({ where: { propertyId: stored.propertyId } }),
  860 |     movements: await db.barStockMovement.count({ where: { propertyId: stored.propertyId } }),
  861 |     cash: await db.cashOperation.count({ where: { propertyId: stored.propertyId } }),
  862 |   });
  863 |   const before = await snapshot();
  864 |   await page.goto('/auth/fallback');
  865 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  866 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  867 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  868 |   await page.waitForURL('**/today');
  869 |   await page.goto('/register/setup');
> 870 |   await page.getByRole('main').getByLabel('Название категории').fill('Synthetic unsaved room');
      |                                                                 ^ Error: locator.fill: Test timeout of 150000ms exceeded.
  871 |   await page
  872 |     .getByRole('main')
  873 |     .getByLabel(/Цена за ночь/)
  874 |     .fill('18000');
  875 |   await page.getByRole('main').getByLabel('Сколько мест').fill('1');
  876 |   await page.getByRole('button', { name: 'Запустить отель' }).click();
  877 |   await page.waitForURL('**/today');
  878 |   await page.goto('/bar');
  879 |   const form = page.locator('form.bar-receipt-form');
  880 |   await form.locator('[name=supplierId]').selectOption(stored.supplierId!);
  881 |   await form.locator('[name=documentNumber]').fill('UNSAVED-SYNTHETIC');
  882 |   await form.locator('[name="productId.0"]').selectOption(a.id);
  883 |   await form.locator('[name="quantityUnits.0"]').fill('3');
  884 |   await form.locator('[name="unitCost.0"]').fill('100');
  885 |   await expect(form.getByText('300 ₸', { exact: true })).toBeVisible();
  886 |   await page.goto('/today');
  887 |   await page.goto('/bar');
  888 |   await expect(page.locator('form.bar-receipt-form [name=documentNumber]')).toHaveValue('');
  889 |   expect(await snapshot()).toEqual(before);
  890 | });
  891 | 
  892 | test('C15 foreign receipt supplier and line product are rejected before any draft is saved', async ({
  893 |   request,
  894 | }) => {
  895 |   const own = await prepare(request);
  896 |   const foreign = await prepare(request);
  897 |   const ownReceipt = await db.barReceipt.findUniqueOrThrow({ where: { id: own.r1.id } });
  898 |   const foreignReceipt = await db.barReceipt.findUniqueOrThrow({ where: { id: foreign.r1.id } });
  899 |   const snapshot = async () => ({
  900 |     own: await own.call('report'),
  901 |     foreign: await foreign.call('report'),
  902 |     receipts: await db.barReceipt.findMany({
  903 |       where: { propertyId: { in: [ownReceipt.propertyId, foreignReceipt.propertyId] } },
  904 |       orderBy: { id: 'asc' },
  905 |       include: { lines: true },
  906 |     }),
  907 |   });
  908 |   const before = await snapshot();
  909 |   for (const [supplierId, productId] of [
  910 |     [foreignReceipt.supplierId!, own.a.id],
  911 |     [ownReceipt.supplierId!, foreign.a.id],
  912 |   ]) {
  913 |     const reply = await request.post(`${qa}/bar/receipts`, {
  914 |       headers: own.headers,
  915 |       data: {
  916 |         supplierId,
  917 |         documentNumber: 'SYNTHETIC-FOREIGN-DENIED',
  918 |         documentDate: '2026-10-07',
  919 |         receivedDate: '2026-10-07',
  920 |         currency: 'KZT',
  921 |         lines: [{ productId, quantityUnits: '1', unitCostMinor: '100', markupBasis: '0' }],
  922 |       },
  923 |     });
  924 |     expect(await snapshot()).toEqual(before);
  925 |     expect(reply.status()).toBe(404);
  926 |   }
  927 | });
  928 | 
```