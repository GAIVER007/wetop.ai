# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bar.spec.ts >> C13 Folio browser preserves a committed charge and retries it without duplication
- Location: tests/bar-operational/bar.spec.ts:787:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('form.bar-folio-form').getByRole('alert')
Expected substring: "Нет ответа API"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('form.bar-folio-form').getByRole('alert') with timeout 5000ms
  - waiting for locator('form.bar-folio-form').getByRole('alert')

```

```yaml
- link "К содержимому":
  - /url: "#main-content"
- banner:
  - link "WETOP, Главная":
    - /url: /today
    - text: W WETOP.AI
  - button "Выбрать филиал":
    - strong: MV3-browser-full-963b2a05-65a4-4740-8ebd-799dfaa79aa8
    - text: Настройки объекта
  - button "Найти гостя или бронь": Поиск гостя, брони, номера... ⌘ K
  - button "Переключить тему"
  - button "Меню администратора":
    - text: M9
    - strong: mv3-963b2a05-65a4-4740-8ebd-799dfaa79aa8@example.invalid
    - text: Владелец
  - navigation "Разделы":
    - link "Главная":
      - /url: /today
    - link "Календарь":
      - /url: /chessboard
    - link "Брони":
      - /url: /reservations
    - link "Гости":
      - /url: /guests
    - link "Финансы":
      - /url: /finance
    - link "Бар":
      - /url: /bar
    - button "Продажи"
    - button "Маркетинг"
    - button "Отчёты"
    - link "Номерной фонд":
      - /url: /inventory
    - button "Настройки"
- main:
  - heading "Бар" [level=1]
  - text: Приходы, закупочная стоимость, наценка, остатки и долги поставщикам в одном разделе. Товары 2 активных позиций Закупки получено 2 800 ₸ 2 проведенных приходов Расходы поставщикам 600 ₸ фактически оплачено из кассы Долг поставщикам 2 200 ₸ Выручка бара 3 840 ₸ валовая прибыль 2 520 ₸ Стоимость остатка 1 480 ₸ списано 0 ₸
  - heading "Продажа без брони" [level=2]
  - text: Товар
  - combobox "Товар":
    - option "Выберите товар" [disabled] [selected]
    - option "Synthetic A, остаток 8 шт."
    - option "Synthetic B, остаток 4 шт."
  - text: Кол-во, шт.
  - textbox "Кол-во, шт."
  - text: Оплата
  - combobox "Оплата":
    - option "Наличные" [selected]
    - option "Карта"
    - option "Kaspi"
    - option "Halyk"
    - option "Перевод"
  - button "Продать"
  - heading "Добавить в счет гостя" [level=2]
  - text: Счет гостя
  - combobox "Счет гостя":
    - option "Выберите гостя" [disabled]
    - option "Гость не указан, QA-b03bd4b0-fedd-4810-8161-766208fca741" [selected]
  - text: Товар
  - combobox "Товар":
    - option "Выберите товар" [disabled]
    - option "Synthetic A, 8 шт." [selected]
    - option "Synthetic B, 4 шт."
  - text: Кол-во, шт.
  - textbox "Кол-во, шт.": "1"
  - button "Добавляем…" [disabled]
  - heading "Остатки" [level=2]
  - region "Таблица, прокрутка по горизонтали":
    - table:
      - rowgroup:
        - row "Товар Остаток Минимум Своя цена продажи Себестоимость остатка":
          - columnheader "Товар"
          - columnheader "Остаток"
          - columnheader "Минимум"
          - columnheader "Своя цена продажи"
          - columnheader "Себестоимость остатка"
      - rowgroup:
        - row "Synthetic AA 8 шт. 0 шт. 320 Сохранить 1 280 ₸":
          - cell "Synthetic AA"
          - cell "8 шт."
          - cell "0 шт."
          - cell "320 Сохранить":
            - textbox "Своя цена продажи в тенге": "320"
            - button "Сохранить"
          - cell "1 280 ₸"
        - row "Synthetic BB 4 шт. 0 шт. 100 Сохранить 200 ₸":
          - cell "Synthetic BB"
          - cell "4 шт."
          - cell "0 шт."
          - cell "100 Сохранить":
            - textbox "Своя цена продажи в тенге": "100"
            - button "Сохранить"
          - cell "200 ₸"
  - heading "Списание" [level=2]
  - text: Товар
  - combobox "Товар":
    - option "Выберите товар" [disabled] [selected]
    - option "Synthetic A, остаток 8 шт."
    - option "Synthetic B, остаток 4 шт."
  - text: Кол-во, шт.
  - textbox "Кол-во, шт."
  - text: Причина
  - combobox "Причина":
    - option "Выберите" [disabled] [selected]
    - option "Порча"
    - option "Бой"
    - option "Истек срок"
    - option "Угощение"
    - option "Нужды объекта"
    - option "Иное"
  - button "Списать"
  - heading "Инвентаризация" [level=2]
  - text: Товар
  - combobox "Товар":
    - option "Выберите товар" [disabled] [selected]
    - option "Synthetic A, по системе 8"
    - option "Synthetic B, по системе 4"
  - text: Факт, шт.
  - textbox "Факт, шт."
  - text: Причина
  - textbox "Причина": Пересчет смены
  - button "Зафиксировать"
  - heading "Продажи" [level=2]
  - region "Таблица, прокрутка по горизонтали":
    - table:
      - rowgroup:
        - row "Дата Товар Выручка Себестоимость Прибыль Статус":
          - columnheader "Дата"
          - columnheader "Товар"
          - columnheader "Выручка"
          - columnheader "Себестоимость"
          - columnheader "Прибыль"
          - columnheader "Статус"
          - columnheader
      - rowgroup:
        - row "2026-10-07 Synthetic A × 12 3 840 ₸ 1 320 ₸ 2 520 ₸ Продано Вернуть на склад Без возврата на склад":
          - cell "2026-10-07"
          - cell "Synthetic A × 12"
          - cell "3 840 ₸"
          - cell "1 320 ₸"
          - cell "2 520 ₸"
          - cell "Продано"
          - cell "Вернуть на склад Без возврата на склад":
            - button "Вернуть на склад"
            - button "Без возврата на склад"
  - heading "Новый приход" [level=2]
  - paragraph: "Как учитываются деньги: проведение прихода увеличивает склад и фиксирует закупку. Расход в кассе появляется только после оплаты поставщику, включая частичную оплату."
  - text: Поставщик
  - combobox "Поставщик":
    - option "Выберите" [disabled] [selected]
    - option "Synthetic supplier"
  - text: Номер счет-фактуры
  - textbox "Номер счет-фактуры"
  - text: Дата документа
  - textbox "Дата документа": 2026-10-07
  - text: Дата приемки
  - textbox "Дата приемки": 2026-10-07
  - text: Товар
  - combobox "Товар":
    - option "Выберите товар" [disabled] [selected]
    - option "Synthetic A"
    - option "Synthetic B"
  - text: Кол-во, шт.
  - textbox "Кол-во, шт."
  - text: Закупка за 1 шт., ₸
  - textbox "Закупка за 1 шт., ₸"
  - text: Наценка, %
  - textbox "Наценка, %": "0.00"
  - text: "Сумма закупки: Введите количество и цену Рекомендованная продажа: Введите цену и наценку После проведения рекомендованная цена станет текущей. Ее можно изменить в остатках."
  - button "Добавить товар"
  - text: Комментарий
  - textbox "Комментарий"
  - checkbox "Сразу провести и добавить на склад" [checked]
  - text: Сразу провести и добавить на склад
  - button "Сохранить приход"
  - heading "Приходы и долги" [level=2]
  - region "Таблица, прокрутка по горизонтали":
    - table:
      - rowgroup:
        - row "Документ Поставщик Позиций Сумма Оплачено Долг Статус":
          - columnheader "Документ"
          - columnheader "Поставщик"
          - columnheader "Позиций"
          - columnheader "Сумма"
          - columnheader "Оплачено"
          - columnheader "Долг"
          - columnheader "Статус"
          - columnheader
      - rowgroup:
        - row "R22026-10-07 Synthetic supplier 1 1 600 ₸ 0 ₸ 1 600 ₸ Проведен Сумма, ₸ 1600 Способ Счет организации Оплатить":
          - cell "R22026-10-07"
          - cell "Synthetic supplier"
          - cell "1"
          - cell "1 600 ₸"
          - cell "0 ₸"
          - cell "1 600 ₸"
          - cell "Проведен"
          - cell "Сумма, ₸ 1600 Способ Счет организации Оплатить":
            - text: Сумма, ₸
            - textbox "Сумма, ₸": "1600"
            - text: Способ
            - combobox "Способ":
              - option "Счет организации" [selected]
              - option "Наличные"
              - option "Карта"
              - option "Kaspi"
              - option "Halyk"
              - option "Перевод"
            - button "Оплатить"
        - row "R12026-10-07 Synthetic supplier 2 1 200 ₸ 600 ₸ 600 ₸ Проведен Сумма, ₸ 600 Способ Счет организации Оплатить":
          - cell "R12026-10-07"
          - cell "Synthetic supplier"
          - cell "2"
          - cell "1 200 ₸"
          - cell "600 ₸"
          - cell "600 ₸"
          - cell "Проведен"
          - cell "Сумма, ₸ 600 Способ Счет организации Оплатить":
            - text: Сумма, ₸
            - textbox "Сумма, ₸": "600"
            - text: Способ
            - combobox "Способ":
              - option "Счет организации" [selected]
              - option "Наличные"
              - option "Карта"
              - option "Kaspi"
              - option "Halyk"
              - option "Перевод"
            - button "Оплатить"
  - heading "Движения" [level=2]
  - region "Таблица, прокрутка по горизонтали":
    - table:
      - rowgroup:
        - row "Время Товар Тип Кол-во Себестоимость Причина":
          - columnheader "Время"
          - columnheader "Товар"
          - columnheader "Тип"
          - columnheader "Кол-во"
          - columnheader "Себестоимость"
          - columnheader "Причина"
      - rowgroup:
        - row "2026-10-07 15:03 Synthetic A SALE -2 320 ₸ –":
          - cell "2026-10-07 15:03"
          - cell "Synthetic A"
          - cell "SALE"
          - cell "-2"
          - cell "320 ₸"
          - cell "–"
        - row "2026-10-07 15:03 Synthetic A SALE -10 1 000 ₸ –":
          - cell "2026-10-07 15:03"
          - cell "Synthetic A"
          - cell "SALE"
          - cell "-10"
          - cell "1 000 ₸"
          - cell "–"
        - row "2026-10-07 15:03 Synthetic A RECEIPT 10 1 600 ₸ –":
          - cell "2026-10-07 15:03"
          - cell "Synthetic A"
          - cell "RECEIPT"
          - cell "10"
          - cell "1 600 ₸"
          - cell "–"
        - row "2026-10-07 15:03 Synthetic B RECEIPT 4 200 ₸ –":
          - cell "2026-10-07 15:03"
          - cell "Synthetic B"
          - cell "RECEIPT"
          - cell "4"
          - cell "200 ₸"
          - cell "–"
        - row "2026-10-07 15:03 Synthetic A RECEIPT 10 1 000 ₸ –":
          - cell "2026-10-07 15:03"
          - cell "Synthetic A"
          - cell "RECEIPT"
          - cell "10"
          - cell "1 000 ₸"
          - cell "–"
  - heading "Справочники бара" [level=2]
  - heading "Категории" [level=3]
  - text: Название
  - textbox "Название"
  - text: Наценка, %
  - textbox "Наценка, %"
  - button "Добавить"
  - list:
    - listitem:
      - text: QA operational, 100%
      - button "В архив"
  - heading "Поставщики" [level=3]
  - text: Название
  - textbox "Название"
  - text: Телефон
  - textbox "Телефон"
  - text: Email
  - textbox "Email"
  - text: Реквизиты
  - textbox "Реквизиты"
  - button "Добавить"
  - list:
    - listitem:
      - text: Synthetic supplier
      - button "В архив"
  - heading "Товары" [level=3]
  - text: Код
  - textbox "Код"
  - text: Название
  - textbox "Название"
  - text: Категория
  - combobox "Категория":
    - option "Без категории" [selected]
    - option "QA operational"
  - text: Штрихкод
  - textbox "Штрихкод"
  - text: Штук в упаковке
  - textbox "Штук в упаковке": "1"
  - text: Своя наценка, %
  - textbox "Своя наценка, %":
    - /placeholder: Из категории
  - text: Начальная цена, ₸
  - textbox "Начальная цена, ₸"
  - text: Мин. остаток
  - textbox "Мин. остаток": "0"
  - button "Добавить товар"
  - list:
    - listitem:
      - text: "A: Synthetic A"
      - button "В архив"
    - listitem:
      - text: "B: Synthetic B"
      - button "В архив"
- alert
```

# Test source

```ts
  739 |     headers,
  740 |     data: { ...payload, folioId: randomUUID() },
  741 |   });
  742 |   expect(destination.status()).toBe(409);
  743 |   expect(await snapshot()).toEqual(before);
  744 | });
  745 | 
  746 | test('C13 simultaneous identical intent replays one sale after a controlled stock barrier', async ({
  747 |   request,
  748 | }) => {
  749 |   const { payload, headers } = await prepare(request);
  750 |   const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
  751 |   await blocker.connect();
  752 |   await blocker.query('BEGIN');
  753 |   await blocker.query(
  754 |     'SELECT id FROM pms_test.bar_stock_lots WHERE product_id=$1 AND remaining_units>0 FOR UPDATE',
  755 |     [payload.productId],
  756 |   );
  757 |   const idempotencyKey = randomUUID();
  758 |   const data = { ...payload, quantityUnits: '1', idempotencyKey };
  759 |   const calls = [
  760 |     request.post(`${qa}/bar/sales/retail`, { headers, data }),
  761 |     request.post(`${qa}/bar/sales/retail`, { headers, data }),
  762 |   ];
  763 |   try {
  764 |     await expect
  765 |       .poll(async () => {
  766 |         await blocker.query('SELECT pg_stat_clear_snapshot()');
  767 |         const result = await blocker.query(
  768 |           "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE '%bar_stock_lots%' OR query LIKE '%pg_advisory_xact_lock%')",
  769 |         );
  770 |         return result.rows[0].waiting;
  771 |       })
  772 |       .toBeGreaterThanOrEqual(2);
  773 |   } finally {
  774 |     await blocker.query('COMMIT');
  775 |     await blocker.end();
  776 |   }
  777 |   const replies = await Promise.all(calls);
  778 |   expect(replies.map((r) => r.status())).toEqual([201, 201]);
  779 |   const bodies = await Promise.all(replies.map((r) => r.json()));
  780 |   expect(bodies[0].id).toBe(bodies[1].id);
  781 |   expect(await db.barSale.count({ where: { idempotencyKey } })).toBe(1);
  782 |   expect(await db.barStockMovement.count({ where: { sourceId: bodies[0].id, kind: 'SALE' } })).toBe(
  783 |     1,
  784 |   );
  785 | });
  786 | 
  787 | test('C13 Folio browser preserves a committed charge and retries it without duplication', async ({
  788 |   page,
  789 |   request,
  790 | }) => {
  791 |   const { f, a } = await prepare(request);
  792 |   const property = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  793 |   const category = await db.accommodationType.create({
  794 |     data: {
  795 |       propertyId: property.id,
  796 |       code: 'FRETRY',
  797 |       name: 'Synthetic Folio retry',
  798 |       kind: 'PRIVATE_ROOM',
  799 |       capacityAdults: 1,
  800 |     },
  801 |   });
  802 |   const reservation = await db.reservation.create({
  803 |     data: {
  804 |       propertyId: property.id,
  805 |       confirmationNumber: `QA-${randomUUID()}`,
  806 |       source: 'DESK',
  807 |       status: 'CONFIRMED',
  808 |       arrivalDate: new Date('2026-10-07'),
  809 |       departureDate: new Date('2026-10-08'),
  810 |       adults: 1,
  811 |       currency: 'KZT',
  812 |       totalAmount: 0n,
  813 |       items: {
  814 |         create: {
  815 |           accommodationTypeId: category.id,
  816 |           arrivalDate: new Date('2026-10-07'),
  817 |           departureDate: new Date('2026-10-08'),
  818 |           price: 0n,
  819 |           status: 'CONFIRMED',
  820 |           folio: { create: { currency: 'KZT' } },
  821 |         },
  822 |       },
  823 |     },
  824 |     include: { items: { include: { folio: true } } },
  825 |   });
  826 |   const folioId = reservation.items[0]!.folio!.id;
  827 |   await page.goto('/auth/fallback');
  828 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  829 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  830 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  831 |   await page.waitForURL('**/today');
  832 |   await page.goto('/bar');
  833 |   const form = page.locator('form.bar-folio-form');
  834 |   await form.locator('[name=folioId]').selectOption(folioId);
  835 |   await form.locator('[name=productId]').selectOption(a.id);
  836 |   await form.locator('[name=quantityUnits]').fill('1');
  837 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'bar_after' } });
  838 |   await form.getByRole('button', { name: 'Добавить в счет', exact: true }).click();
> 839 |   await expect(form.getByRole('alert')).toContainText('Нет ответа API');
      |                                         ^ Error: expect(locator).toContainText(expected) failed
  840 |   await expect(form.locator('[name=folioId]')).toHaveValue(folioId);
  841 |   await expect(form.locator('[name=productId]')).toHaveValue(a.id);
  842 |   await expect(form.locator('[name=quantityUnits]')).toHaveValue('1');
  843 |   const count = () => db.charge.count({ where: { folioId } });
  844 |   expect(await count()).toBe(1);
  845 |   await form.getByRole('button', { name: 'Добавить в счет', exact: true }).click();
  846 |   await expect(form.getByRole('status')).toHaveText(
  847 |     'Товар добавлен в счет гостя, остаток обновлен',
  848 |   );
  849 |   expect(await count()).toBe(1);
  850 |   await page.reload();
  851 |   expect(await count()).toBe(1);
  852 |   expect(await db.barSale.count({ where: { folioId } })).toBe(1);
  853 | });
  854 | 
  855 | test('C02 abandoning an unsaved receipt leaves stock debt cash and ledger unchanged', async ({
  856 |   page,
  857 |   request,
  858 | }) => {
  859 |   const { f, a, r1, call } = await prepare(request);
  860 |   const stored = await db.barReceipt.findUniqueOrThrow({ where: { id: r1.id } });
  861 |   const snapshot = async () => ({
  862 |     report: await call('report'),
  863 |     receipts: await db.barReceipt.count({ where: { propertyId: stored.propertyId } }),
  864 |     lots: await db.barStockLot.count({ where: { propertyId: stored.propertyId } }),
  865 |     movements: await db.barStockMovement.count({ where: { propertyId: stored.propertyId } }),
  866 |     cash: await db.cashOperation.count({ where: { propertyId: stored.propertyId } }),
  867 |   });
  868 |   const before = await snapshot();
  869 |   await page.goto('/auth/fallback');
  870 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  871 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  872 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  873 |   await page.waitForURL('**/today');
  874 |   await page.goto('/register/setup');
  875 |   await page.getByRole('main').getByLabel('Название категории').fill('Synthetic unsaved room');
  876 |   await page
  877 |     .getByRole('main')
  878 |     .getByLabel(/Цена за ночь/)
  879 |     .fill('18000');
  880 |   await page.getByRole('main').getByLabel('Сколько мест').fill('1');
  881 |   await page.getByRole('button', { name: 'Запустить отель' }).click();
  882 |   await page.waitForURL('**/today');
  883 |   await page.goto('/bar');
  884 |   const form = page.locator('form.bar-receipt-form');
  885 |   await form.locator('[name=supplierId]').selectOption(stored.supplierId!);
  886 |   await form.locator('[name=documentNumber]').fill('UNSAVED-SYNTHETIC');
  887 |   await form.locator('[name="productId.0"]').selectOption(a.id);
  888 |   await form.locator('[name="quantityUnits.0"]').fill('3');
  889 |   await form.locator('[name="unitCost.0"]').fill('100');
  890 |   await expect(form.getByText('300 ₸', { exact: true })).toBeVisible();
  891 |   await page.goto('/today');
  892 |   await page.goto('/bar');
  893 |   await expect(page.locator('form.bar-receipt-form [name=documentNumber]')).toHaveValue('');
  894 |   expect(await snapshot()).toEqual(before);
  895 | });
  896 | 
  897 | test('C15 foreign receipt supplier and line product are rejected before any draft is saved', async ({
  898 |   request,
  899 | }) => {
  900 |   const own = await prepare(request);
  901 |   const foreign = await prepare(request);
  902 |   const ownReceipt = await db.barReceipt.findUniqueOrThrow({ where: { id: own.r1.id } });
  903 |   const foreignReceipt = await db.barReceipt.findUniqueOrThrow({ where: { id: foreign.r1.id } });
  904 |   const snapshot = async () => ({
  905 |     own: await own.call('report'),
  906 |     foreign: await foreign.call('report'),
  907 |     receipts: await db.barReceipt.findMany({
  908 |       where: { propertyId: { in: [ownReceipt.propertyId, foreignReceipt.propertyId] } },
  909 |       orderBy: { id: 'asc' },
  910 |       include: { lines: true },
  911 |     }),
  912 |   });
  913 |   const before = await snapshot();
  914 |   for (const [supplierId, productId] of [
  915 |     [foreignReceipt.supplierId!, own.a.id],
  916 |     [ownReceipt.supplierId!, foreign.a.id],
  917 |   ]) {
  918 |     const reply = await request.post(`${qa}/bar/receipts`, {
  919 |       headers: own.headers,
  920 |       data: {
  921 |         supplierId,
  922 |         documentNumber: 'SYNTHETIC-FOREIGN-DENIED',
  923 |         documentDate: '2026-10-07',
  924 |         receivedDate: '2026-10-07',
  925 |         currency: 'KZT',
  926 |         lines: [{ productId, quantityUnits: '1', unitCostMinor: '100', markupBasis: '0' }],
  927 |       },
  928 |     });
  929 |     expect(await snapshot()).toEqual(before);
  930 |     expect(reply.status()).toBe(404);
  931 |   }
  932 | });
  933 | 
```