import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { tourKeyOf } from '../../apps/web/src/components/shell/tour-steps';
import { settleStreaming } from '../ui/fixtures';

/**
 * Деньги бара в настоящем браузере (A25) на экранах Бар-2 (ADR-157): ожидание, API, независимый SQL и DOM.
 * Прежние носители (единая страница /bar с каталогами и формой прихода) сняты Бар-2; смысл каждого сценария
 * сохранён, носители новые: поставщики /bar/suppliers, товары и своя цена /bar/products, приход
 * /bar/receipts/new, оплата /bar/receipts, окно продажи и итоги строкой /bar, возвраты и журнал /bar/operations.
 * Стенд готовит scripts/ci/runtime-audit.sh (настоящий API, AUTH_REQUIRED=1, без внешней сети).
 */
const parent = process.env.A28_WORK_DIR ?? process.env.A25_WORK_DIR ?? '';
test.skip(!parent, 'Requires explicitly provisioned isolated A25 runtime');
const evidence = process.env.A25_EVIDENCE_DIR ?? parent + '/evidence';
const privateFile = () => parent + '/' + (process.env.A25_PRIVATE_FILE ?? 'a25-private.json');
const privateData = parent ? JSON.parse(readFileSync(privateFile(), 'utf8')) : {};
const api = (process.env.A25_API_URL ?? 'http://127.0.0.1:4417').replace(/\/$/, '');
const web = (process.env.A25_WEB_URL ?? 'http://127.0.0.1:3127').replace(/\/$/, '');
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55601');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a24_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? process.env.A25_DATABASE ?? 'a25_ui';
let token = '';
const scope = (currency: string) => privateData.scopes[currency];
const savePrivate = () => writeFileSync(privateFile(), JSON.stringify(privateData), { mode: 0o600 });

async function call(currency: string, path: string, method = 'GET', body?: unknown) {
  const s = scope(currency);
  const response = await fetch(api + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-wetop-scope': `business=${s.business};location=${s.location}`,
      'content-type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  expect(response.status, JSON.stringify(data)).toBe(method === 'POST' ? 201 : 200);
  return data;
}
async function enter(page: Page, currency: string, path = '/bar') {
  const s = scope(currency);
  await page.context().addCookies([
    { name: 'wetop_session', value: token, url: web, httpOnly: true },
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${s.business};location=${s.location}`),
      url: web,
      httpOnly: true,
    },
  ]);
  // продуктовый тур стартует сам на «Финансах» и перехватывает клики; его проверяют свои спеки, здесь он пройден
  await page.addInitScript((key) => localStorage.setItem(key, 'done'), tourKeyOf(privateData.email));
  await page.goto(path);
}
async function overview(page: Page, currency: string) {
  await enter(page, currency);
  await expect(page.getByRole('heading', { name: 'Склад: бар', exact: true })).toBeVisible();
}
// Next на время перехода держит в DOM и уходящую страницу: после goto и reload ждём, пока скрытая копия уйдёт,
// иначе строгий режим находит поле формы дважды (тот же приём в tests/branches-ui/branches.spec.ts)
test.beforeEach(({ page }) => {
  const goto = page.goto.bind(page);
  page.goto = async (url, options) => {
    const response = await goto(url, options);
    await settleStreaming(page);
    return response;
  };
  const reload = page.reload.bind(page);
  page.reload = async (options) => {
    const response = await reload(options);
    await settleStreaming(page);
    return response;
  };
});
test.beforeAll(async () => {
  const login = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: privateData.email, password: privateData.password }),
  });
  expect(login.status).toBe(201);
  token = (await login.json()).token;
  expect((await fetch(api + '/bar/report')).status).toBe(401);
});
const query = async (sql: string, params: unknown[] = []) => {
  const db = new pg.Client({
    host: databaseHost,
    port: databasePort,
    user: migratorRole,
    database: databaseName,
    options: '-c search_path=pms_test,public',
  });
  await db.connect();
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.end();
  }
};
/** Итоги обзора Бара строкой под списком (аудит 21.10.2026 п.7, плитки убраны по правилу владельца): подпись -> значение */
const totalIds: Record<string, string> = {
  'Сумма закупок': 'bar-total-purchases',
  'Выручка бара': 'bar-total-revenue',
  'Прибыль от продаж': 'bar-total-profit',
  'Долг поставщикам': 'bar-total-debt',
};
const stat = (page: Page, label: string) =>
  page.getByRole('main').getByTestId('bar-totals').getByTestId(totalIds[label]!);
/** Остаток склада в деньгах: поле «Себестоимость остатка» карточки товара на обзоре /bar (аудит 21.10.2026 п.16,
 * закупка и наценка ушли из строки /bar/products в карточку). Значение поля без разрядов, валюта в приставке поля.
 * В сценариях по одному активному товару на филиал. */
async function stockCost(page: Page) {
  await page.goto('/bar');
  await hydrated(page, '.bar-board');
  const board = page.getByRole('main').getByRole('table', { name: /^Товары и остатки/ });
  const card = page.getByRole('complementary', { name: /^Карточка товара / });
  await expect(async () => {
    if (!(await card.isVisible())) await board.getByRole('button', { name: /^Изменить / }).first().click();
    await expect(card).toBeVisible({ timeout: 2_000 });
  }).toPass();
  const field = card.locator('.bar-card-field').filter({ has: page.locator('label', { hasText: 'Себестоимость остатка' }) });
  return { value: field.getByLabel('Себестоимость остатка'), currency: field.locator('.bar-affix-suffix') };
}
/** Сверка поля себестоимости: число в поле и валюта в приставке; строка для доказательств в том же виде */
async function expectStockCost(page: Page, value: string, currency: string) {
  const stock = await stockCost(page);
  await expect(stock.value).toHaveValue(value);
  await expect(stock.currency).toHaveText(currency);
  return `Себестоимость остатка: ${await stock.value.inputValue()} ${(await stock.currency.textContent())!.trim()}`;
}
/** Оплачено поставщику: «Расчёты» строки таблицы /bar/suppliers (свёрнуты в <details>, читаем textContent) */
async function supplierPaid(page: Page, supplier: string) {
  await page.goto('/bar/suppliers');
  return page
    .getByRole('table', { name: 'Поставщики бара' })
    .getByRole('row')
    .filter({ hasText: supplier })
    .locator('.bar-row-details p', { hasText: 'Оплачено' });
}
/** Форма после гидратации: React вешает на узел служебное свойство; щелчок по кнопке до этого теряется (холодная
 * сборка страницы в `next dev`) */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const node = document.querySelector(sel);
      return !!node && Object.keys(node).some((key) => key.startsWith('__reactProps'));
    },
    selector,
  );
}
/** Форма справочника в окне по центру: кнопка в шапке подстраницы (аудит 21.10.2026 п.15, п.42). Щелчок до
 * гидратации теряется, поэтому повторяем, пока окно не откроется. */
async function openDialog(page: Page, label: string) {
  const dialog = page.getByRole('dialog', { name: label });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole('button', { name: label, exact: true }).first().click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass();
  return dialog;
}

async function newScope(currency: string, name: string) {
  const s = { property: randomUUID(), location: randomUUID(), business: scope(currency).business, currency, name };
  await query(
    "INSERT INTO locations(id,business_id,name,currency,timezone,updated_at) VALUES($1,$2,$3,$4,'Asia/Almaty',now())",
    [s.location, s.business, name, currency],
  );
  await query(
    "INSERT INTO properties(id,organization_id,location_id,name,currency,timezone,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,$4,$5,'Asia/Almaty','14:00','12:00',now())",
    [s.property, privateData.org, s.location, name, currency],
  );
  const b = randomUUID(), f = randomUUID(), r = randomUUID(), t = randomUUID();
  await query("INSERT INTO buildings(id,property_id,name) VALUES($1,$2,'A25 building')", [b, s.property]);
  await query("INSERT INTO floors(id,building_id,name) VALUES($1,$2,'1')", [f, b]);
  await query("INSERT INTO physical_rooms(id,floor_id,room_number,capacity,updated_at) VALUES($1,$2,'1',1,now())", [r, f]);
  await query(
    "INSERT INTO accommodation_types(id,property_id,code,name,kind,capacity_adults,updated_at) VALUES($1,$2,'A25','A25 room','PRIVATE_ROOM',1,now())",
    [t, s.property],
  );
  await query(
    "INSERT INTO inventory_units(id,property_id,physical_room_id,accommodation_type_id,kind,code,updated_at) VALUES($1,$2,$3,$4,'ROOM','A25',now())",
    [randomUUID(), s.property, r, t],
  );
  privateData.scopes[currency] = s;
  savePrivate();
  return s;
}
/** Поставщик на /bar/suppliers, товар со своей ценой 150 на /bar/products: руками, через формы */
async function createCatalog(page: Page, name: string) {
  await page.goto('/bar/suppliers');
  await openDialog(page, 'Новый поставщик');
  await hydrated(page, '.bar-supplier-form');
  const supplier = page.locator('.bar-supplier-form');
  await supplier.locator('input[name=name]').fill(name + ' supplier');
  await supplier.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(supplier.getByRole('status')).toHaveText('Поставщик добавлен');
  await page.goto('/bar/products');
  await openDialog(page, 'Новый товар');
  await hydrated(page, '.bar-product-form');
  const products = page.locator('.bar-product-form');
  await products.locator('input[name=code]').fill(randomUUID());
  await products.locator('input[name=name]').fill(name);
  await products.locator('input[name=salePrice]').fill('150');
  await products.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await expect(products.getByRole('status')).toHaveText('Товар добавлен');
}
async function fillReceipt(page: Page, name: string, doc: string, qty: string, cost: string) {
  await page.goto('/bar/receipts/new');
  await hydrated(page, '.bar-receipt-form');
  const form = page.locator('.bar-receipt-form');
  await form.locator('select[name=supplierId]').selectOption({ label: name + ' supplier' });
  await form.locator('input[name=documentNumber]').fill(doc);
  await form.locator('select[name="productId.0"]').selectOption({ label: name });
  await form.locator('input[name="quantityUnits.0"]').fill(qty);
  await form.locator('input[name="unitCost.0"]').fill(cost);
  await form.locator('input[name="markup.0"]').fill('0');
  return form;
}
async function receive(page: Page, name: string, doc: string, qty: string, cost: string) {
  const form = await fillReceipt(page, name, doc, qty, cost);
  await form.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(form.getByRole('status')).toHaveText('Приход проведен, остатки обновлены');
  await page.goto('/bar/receipts');
  await expect(page.locator('tr').filter({ hasText: doc })).toBeVisible();
}
const saleForm = (page: Page) => page.locator('#bar-quick-sale .bar-retail-form');
/** Форма продажи после гидратации: «Продать» включается, когда эффект выставил ключ продажи (D-KEY). Выбор товара до
 * гидратации React сбрасывает к defaultValue, и браузер не отправит форму с пустым обязательным полем. */
async function openSaleForm(page: Page) {
  // продажа открывается окном по кнопке «Продажа» в шапке (аудит 21.10.2026 п.13), якорь #bar-quick-sale
  const dialog = page.locator('#bar-quick-sale');
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.locator('a[href="#bar-quick-sale"]:visible').first().click();
  }
  await expect(dialog).toBeVisible();
  return saleForm(page);
}
async function readySaleForm(page: Page) {
  const form = await openSaleForm(page);
  const fresh = form.getByRole('button', { name: 'Новая продажа', exact: true });
  const sell = form.getByRole('button', { name: 'Продать', exact: true });
  await expect.poll(async () => await fresh.isVisible() || await sell.isEnabled()).toBe(true);
  // A fresh key requires the explicit UI action, only after confirmed recovery.
  if (await fresh.isVisible()) await fresh.click();
  await expect(sell).toBeEnabled();
  return form;
}
async function sell(page: Page, name: string, qty: string) {
  await page.goto('/bar');
  const form = await readySaleForm(page);
  await form
    .locator('select[name=productId]')
    .selectOption({ label: await form.locator('option').filter({ hasText: name }).innerText() });
  await form.locator('input[name=quantityUnits]').fill(qty);
  await form.getByRole('button', { name: 'Продать' }).click();
  await expect(form.getByRole('status')).toContainText('Продажа записана');
}
async function legacyStock(currency: string, name: string, units = '3', cost = '1000', price = '2000', receiptCurrency = currency) {
  const product = await call(currency, '/bar/products', 'POST', {
    code: randomUUID(), name, unitsPerPackage: 1, markupBasis: 0, salePriceMinor: price, minimumStockUnits: '0',
  });
  const supplier = await call(currency, '/bar/suppliers', 'POST', { name: name + ' supplier' });
  const r = randomUUID(), l = randomUUID(), lot = randomUUID();
  await query(
    "INSERT INTO bar_receipts(id,property_id,supplier_id,document_number,document_date,received_date,currency,status,total_amount,posted_at,updated_at) VALUES($1,$2,$3,$4,'2026-10-07','2026-10-07',$5,'POSTED',$6,now(),now())",
    [r, scope(currency).property, supplier.id, name, receiptCurrency, String(BigInt(units) * BigInt(cost))],
  );
  await query(
    'INSERT INTO bar_receipt_lines(id,receipt_id,product_id,quantity_units,unit_cost,amount,markup_basis,calculated_price) VALUES($1,$2,$3,$4,$5,$6,0,$7)',
    [l, r, product.id, units, cost, String(BigInt(units) * BigInt(cost)), price],
  );
  await query(
    'INSERT INTO bar_stock_lots(id,property_id,product_id,receipt_line_id,received_units,remaining_units,unit_cost,received_at) VALUES($1,$2,$3,$4,$5,$5,$6,now())',
    [lot, scope(currency).property, product.id, l, units, cost],
  );
  await query(
    "INSERT INTO bar_stock_movements(id,property_id,product_id,lot_id,kind,units,unit_cost,source_type,source_id) VALUES($1,$2,$3,$4,'RECEIPT',$5,$6,'BAR_RECEIPT',$7)",
    [randomUUID(), scope(currency).property, product.id, lot, units, cost, r],
  );
  return { product: product.id, receipt: r };
}

test('UI-02 currency comes from real USD report', async ({ page }) => {
  await overview(page, 'USD');
  const report = await call('USD', '/bar/report');
  expect(report.currency).toBe('USD');
  await page.screenshot({ path: evidence + '/usd-current.png', fullPage: true });
  writeFileSync(evidence + '/usd-current-api.json', JSON.stringify(report, null, 2));
  await expect(stat(page, 'Выручка бара')).toContainText('USD');
  await expect(stat(page, 'Выручка бара')).not.toContainText('₸');
});

test('UI-01 real KZT user flow and expected/API/SQL/DOM reconciliation', async ({ page }) => {
  await newScope('KZT', 'A25 KZT chain ' + Date.now());
  await enter(page, 'KZT');
  const name = 'A25 KZT goods';
  await createCatalog(page, name);
  await receive(page, name, 'A25-ONE', '3', '100');
  await receive(page, name, 'A25-TWO', '2', '120');
  const row = page.locator('tr').filter({ hasText: 'A25-ONE' });
  const payment = row.locator('.bar-payment-form');
  await payment.locator('input[name=amount]').fill('300');
  await payment.getByRole('button', { name: 'Оплатить', exact: true }).click();
  // долг закрыт полностью: форма оплаты исчезает, остаётся метка «Оплачено» (не «Оплачено: …» в ячейке суммы)
  await expect(row.getByText('Оплачено', { exact: true })).toBeVisible();
  // приход с наценкой 0 переставил цену на закупку (FIFO-цена прихода): своя цена 150 возвращается вручную
  await page.goto('/bar/products');
  const price = page.locator('tr').filter({ hasText: name }).locator('.bar-price-form');
  await price.locator('input[name=salePrice]').fill('150');
  await price.getByRole('button', { name: 'Сохранить цену', exact: true }).click();
  await expect(price.getByRole('status')).toContainText('Своя цена');
  await sell(page, name, '4');
  const expected = {
    purchasesMinor: '54000',
    supplierPaidMinor: '30000',
    revenueMinor: '60000',
    costMinor: '42000',
    grossProfitMinor: '18000',
    stockCostMinor: '12000',
    supplierDebtMinor: '24000',
  };
  const report = await call('KZT', '/bar/report');
  for (const [k, v] of Object.entries(expected)) expect(report[k]).toBe(v);
  const sql = (
    await query(
      `SELECT (SELECT sum(total_amount)::text FROM bar_receipts WHERE property_id=$1 AND status='POSTED') purchases,(SELECT sum(p.amount)::text FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE r.property_id=$1 AND c.status='COMPLETED') paid,(SELECT sum(total_revenue)::text FROM bar_sales WHERE property_id=$1 AND status='POSTED') revenue,(SELECT sum(total_cost)::text FROM bar_sales WHERE property_id=$1 AND status='POSTED') cost,(SELECT sum(remaining_units*unit_cost)::text FROM bar_stock_lots WHERE property_id=$1) stock,(SELECT sum(CASE WHEN kind='INCOME' THEN amount WHEN kind='EXPENSE' THEN -amount ELSE 0 END)::text FROM cash_operations WHERE property_id=$1 AND status='COMPLETED') cash`,
      [scope('KZT').property],
    )
  )[0];
  expect(sql).toEqual({ purchases: '54000', paid: '30000', revenue: '60000', cost: '42000', stock: '12000', cash: '30000' });
  await page.goto('/bar');
  const dom: Record<string, string> = {};
  for (const [label, value] of [
    ['Сумма закупок', '540 ₸'],
    ['Долг поставщикам', '240 ₸'],
    ['Выручка бара', '600 ₸'],
    ['Прибыль от продаж', '180 ₸'],
  ] as const) {
    await expect(stat(page, label)).toHaveText(value);
    dom[label] = await stat(page, label).innerText();
  }
  dom['Себестоимость остатка'] = await expectStockCost(page, '120', '₸');
  const paidCell = await supplierPaid(page, name + ' supplier');
  await expect(paidCell).toHaveText('Оплачено: 300 ₸');
  dom['Оплачено поставщику'] = (await paidCell.textContent())!;
  await page.goto('/bar/operations');
  const sales = page.locator('tr').filter({ hasText: name }).filter({ hasText: 'Продано' });
  await expect(sales).toContainText('420 ₸');
  await page.goto('/finance?show=1#operations');
  await expect(page.locator('body')).toContainText('300 ₸');
  const cash = await call('KZT', '/finance/cash');
  expect(cash.totalMinor).toBe('30000');
  writeFileSync(
    evidence + '/kzt-ui-reconciliation.json',
    JSON.stringify({ scenario: 'UI-01', scope: scope('KZT'), expected, API: report, SQL: sql, DOM: dom, cashAPI: cash, units: 'minor',
      fixture: 'property/user only; goods, receipts, supplier payment and sale entered through UI' }, null, 2),
  );
});

test('UI-02 real compatible USD retail, stock, history and cash', async ({ page }) => {
  await newScope('USD', 'A25 USD chain ' + Date.now());
  await legacyStock('USD', 'A25 USD goods');
  await enter(page, 'USD');
  await sell(page, 'A25 USD goods', '1');
  const report = await call('USD', '/bar/report');
  const expected = {
    purchasesMinor: '3000', supplierPaidMinor: '0', supplierDebtMinor: '3000',
    revenueMinor: '2000', costMinor: '1000', grossProfitMinor: '1000', stockCostMinor: '2000',
  };
  expect(report.currency).toBe('USD');
  for (const [key, value] of Object.entries(expected)) expect(report[key]).toBe(value);
  await expect(stat(page, 'Выручка бара')).toHaveText('20 USD');
  await expectStockCost(page, '20', 'USD');
  await page.goto('/bar/operations');
  await expect(page.locator('tr').filter({ hasText: 'A25 USD goods' }).filter({ hasText: 'Продано' })).toContainText('10 USD');
  await page.goto('/bar/products');
  await expect(page.locator('.bar-price-form input[name=salePrice]').first()).toHaveAttribute('aria-label', 'Своя цена продажи в USD');
  await page.goto('/bar/receipts/new');
  // ADR-187: автоцена не в тенге утверждена (вверх до целой единицы), форма прихода больше не отказывает
  await expect(page.locator('.bar-receipt-form')).toContainText('Рекомендованная продажа');
  await expect(page.locator('.bar-receipt-form')).not.toContainText('еще не утверждена');
  const SQL = (
    await query(
      `SELECT (SELECT sum(total_revenue)::text FROM bar_sales WHERE property_id=$1 AND status='POSTED') revenue,(SELECT sum(total_cost)::text FROM bar_sales WHERE property_id=$1 AND status='POSTED') cost,(SELECT sum(remaining_units*unit_cost)::text FROM bar_stock_lots WHERE property_id=$1) stock,(SELECT sum(CASE WHEN kind='INCOME' THEN amount ELSE -amount END)::text FROM cash_operations WHERE property_id=$1 AND status='COMPLETED') cash`,
      [scope('USD').property],
    )
  )[0];
  expect(SQL).toEqual({ revenue: '2000', cost: '1000', stock: '2000', cash: '2000' });
  await page.goto('/bar');
  const revenue = await stat(page, 'Выручка бара').innerText();
  const DOM = { revenue, stock: await expectStockCost(page, '20', 'USD') };
  expect(DOM).toEqual({ revenue: '20 USD', stock: 'Себестоимость остатка: 20 USD' });
  await page.goto('/finance?show=1#operations');
  await expect(page.locator('body')).toContainText('USD');
  writeFileSync(
    evidence + '/usd-ui-reconciliation.json',
    JSON.stringify({ scope: scope('USD'), expected, API: report, SQL, DOM, units: 'minor',
      stock: await call('USD', '/bar/stock'), cash: await call('USD', '/finance/cash'),
      fixture: 'A23-compatible synthetic SQL stock; sale through UI' }, null, 2),
  );
});

test('UI-03 branch switching clears drafts, including controlled delay and focus', async ({ page }) => {
  await enter(page, 'KZT', '/bar/receipts/new');
  await page.locator('input[name=documentNumber]').fill('OLD-SCOPE-DRAFT');
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(scope('USD').name) }).click();
  // посадка гостиницы: «Главная» на /today (ADR-180); сам переход из черновика стирает его
  await expect(page).toHaveURL(/\/today/);
  await page.goto('/bar');
  await expect(stat(page, 'Выручка бара')).toHaveText('20 USD');
  await page.goto('/bar/receipts/new');
  await expect(page.locator('input[name=documentNumber]')).toHaveValue('');
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(scope('USD').name) })).toHaveAttribute('aria-pressed', 'true');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*', async (route) => {
    if (route.request().method() === 'POST') await gate;
    await route.continue();
  });
  const switching = page.getByRole('button', { name: new RegExp(scope('KZT').name) }).click();
  try {
    await expect(page.getByRole('status').filter({ hasText: 'Переключаем филиал' })).toBeVisible();
    await expect(page.locator('[data-testid="bar-totals"]:visible')).toHaveCount(0);
  } finally {
    release();
  }
  await switching;
  await expect(page).toHaveURL(/\/today/);
  await page.goto('/bar');
  await expect(stat(page, 'Выручка бара')).toHaveText('600 ₸');
  await page.unroute('**/*');
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toBeFocused();
});

test('UI-04 real mixed-history guard is explicit, not zero success', async ({ page }) => {
  const previous = scope('KZT');
  await newScope('KZT', 'A25 LEGACY_ONLY ' + Date.now());
  await legacyStock('KZT', 'A25 mixed', '2', '1000', '2000', 'USD');
  const s = scope('KZT');
  try {
    const response = await fetch(api + '/bar/report', {
      headers: { authorization: `Bearer ${token}`, 'x-wetop-scope': `business=${s.business};location=${s.location}` },
    });
    expect(response.status).toBe(409);
    await overview(page, 'KZT');
    await expect(page.getByTestId('bar-load-error')).toContainText('История закупок');
    await expect(page.getByTestId('bar-totals')).toHaveCount(0);
    await page.screenshot({ path: evidence + '/mixed-history-error.png', fullPage: true });
  } finally {
    privateData.scopes.KZT = previous;
    savePrivate();
  }
});

test('UI-05 invalid USD purchase price preserves editable input without partial writes', async ({ page }) => {
  await enter(page, 'USD');
  // ADR-187 allows USD auto pricing. Invalid money still fails before any
  // receipt/product mutation, for both existing and newly entered products.
  const form = await fillReceipt(page, 'A25 USD goods', 'A25-USD-DRAFT', '1', '10.123');
  const before = await query('SELECT count(*)::int n FROM bar_receipts WHERE property_id=$1', [scope('USD').property]);
  const products = await query('SELECT count(*)::int n FROM bar_products WHERE property_id=$1', [scope('USD').property]);
  await form.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(form.getByRole('alert')).toHaveText('Цена закупки: укажите сумму в валюте операции, не более двух знаков после запятой');
  await expect(form.locator('input[name=documentNumber]')).toHaveValue('A25-USD-DRAFT');
  await expect(form.getByRole('status')).toHaveCount(0);
  expect(await query('SELECT count(*)::int n FROM bar_receipts WHERE property_id=$1', [scope('USD').property])).toEqual(before);
  // Start a fresh form so the first refusal cannot satisfy the second assertion.
  await fillReceipt(page, 'A25 USD goods', 'A25-USD-DRAFT', '1', '10.123');
  await expect(form.getByRole('alert')).toHaveCount(0);
  // Invalid purchase precision must also reject a new product before creating its card.
  await form.getByRole('button', { name: 'Нет в списке' }).click();
  await form.locator('input[name="newName.0"]').fill('A25 USD new goods');
  await form.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(form.getByRole('alert')).toHaveText('Цена закупки: укажите сумму в валюте операции, не более двух знаков после запятой');
  await expect(form.locator('input[name=documentNumber]')).toHaveValue('A25-USD-DRAFT');
  expect(await query('SELECT count(*)::int n FROM bar_products WHERE property_id=$1', [scope('USD').property])).toEqual(products);
  expect(await query('SELECT count(*)::int n FROM bar_receipts WHERE property_id=$1', [scope('USD').property])).toEqual(before);
});

test('UI-05 non-KZT receipt: new product price rounds up to a whole unit and the receipt is saved (ADR-187)', async ({ page }) => {
  await enter(page, 'USD');
  const property = scope('USD').property;
  const receipts = async () => (await query('SELECT count(*)::int n FROM bar_receipts WHERE property_id=$1', [property]))[0].n;
  const before = await receipts();
  // ADR-187 (18.10.2026): строка «новый товар» в объекте не в тенге больше не отклоняется:
  // 10,20 USD без наценки → цена продажи вверх до целого доллара, 11,00 USD
  const form = await fillReceipt(page, 'A25 USD goods', 'A25-USD-AUTO', '1', '10.20');
  await form.getByRole('button', { name: 'Нет в списке' }).click();
  await form.locator('input[name="newName.0"]').fill('A25 USD new goods');
  await form.locator('input[name="unitCost.0"]').fill('10.20');
  await form.locator('input[name="markup.0"]').fill('0');
  await expect(form).not.toContainText('еще не утверждена');
  await form.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(form.getByRole('status')).toContainText(/Приход проведен|Черновик прихода сохранен/);
  expect(await receipts()).toBe(before + 1);
  expect(await query('SELECT sale_price::text p FROM bar_products WHERE property_id=$1 AND name=$2', [property, 'A25 USD new goods'])).toEqual([{ p: '1100' }]);
});

test('UI-07 unavailable stock retains the original intent without partial effect', async ({ page }) => {
  await overview(page, 'KZT');
  const sale = await readySaleForm(page);
  const before = await call('KZT', '/bar/report');
  await sale.locator('select[name=productId]').selectOption({ label: 'A25 KZT goods, остаток 1 шт.' });
  await sale.locator('input[name=quantityUnits]').fill('2');
  await sale.getByRole('button', { name: 'Продать' }).click();
  await expect(sale.getByRole('alert')).toBeVisible();
  await expect(sale.locator('input[name=quantityUnits]')).toHaveValue('2');
  await expect(sale.locator('input[name=quantityUnits]')).toBeDisabled();
  await expect(sale.getByRole('button', { name: 'Повторить с тем же ключом', exact: true })).toBeEnabled();
  expect(await call('KZT', '/bar/report')).toEqual(before);
});

test('UI-07 cross-property draft has no partial effect', async ({ page }) => {
  // A separate browser context must not erase an unresolved sale's retained payload.
  await overview(page, 'KZT');
  const sale = await readySaleForm(page);
  const before = await call('KZT', '/bar/report');
  await sale.locator('select[name=productId]').selectOption({ label: 'A25 KZT goods, остаток 1 шт.' });
  await sale.locator('input[name=quantityUnits]').fill('1');
  await sale.locator('input[name=barPropertyId]').evaluate((node: HTMLInputElement) => {
    node.value = '00000000-0000-4000-8000-000000000000';
  });
  await sale.getByRole('button', { name: 'Продать' }).click();
  await expect(sale.getByRole('alert')).toContainText('Объект формы изменился');
  expect(await call('KZT', '/bar/report')).toEqual(before);
});

test('UI-09 exact large minor price stays exact in input and DOM', async ({ page }) => {
  const previous = scope('USD');
  await newScope('USD', 'A25 exact ' + Date.now());
  await legacyStock('USD', 'A25 exact goods', '1', '9007199254740993', '9007199254740993');
  await overview(page, 'USD');
  const exact = await expectStockCost(page, '90071992547409.93', 'USD');
  // в таблице обзора цена продажи выводится с разрядами: точность видна и в форматированной сумме
  await expect(page.getByRole('main').getByRole('table', { name: /^Товары и остатки/ })).toContainText('90 071 992 547 409,93 USD');
  await page.goto('/bar/products');
  await expect(page.locator('.bar-price-form input[name=salePrice]').first()).toHaveValue('90071992547409.93');
  writeFileSync(
    evidence + '/large-exact.json',
    JSON.stringify({ minor: '9007199254740993', expected: 'Себестоимость остатка: 90071992547409.93 USD', DOM: exact }, null, 2),
  );
  privateData.scopes.USD = previous;
  savePrivate();
});

for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`UI-visual ${width} ${theme} real USD`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.addInitScript((theme) => localStorage.setItem('wetop.theme', theme), theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await overview(page, 'USD');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(stat(page, 'Выручка бара')).toHaveText('20 USD');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(audit.violations).toEqual([]);
      writeFileSync(evidence + `/axe-${width}-${theme}.json`, JSON.stringify({ violations: audit.violations, passes: audit.passes.map((x) => x.id) }));
      await page.screenshot({ path: evidence + `/usd-${width}-${theme}.png`, fullPage: true });
      const quantity = (await readySaleForm(page)).locator('input[name=quantityUnits]');
      await quantity.focus();
      await expect(quantity).toBeFocused();
      // окно продажи модальное: закрываем, чтобы открыть карточку товара на доске
      await page.keyboard.press('Escape');
      await expect(page.locator('#bar-quick-sale')).toHaveCount(0);
      // шторка карточки товара: до (снимок выше) и после открытия; при reduced-motion анимаций в полёте нет
      const board = page.getByRole('main').getByRole('table', { name: 'Товары и остатки бара' });
      await board.getByRole('button', { name: 'Изменить A25 USD goods' }).click();
      const card = page.getByRole('complementary', { name: 'Карточка товара A25 USD goods' });
      await expect(card).toBeVisible();
      expect(await card.evaluate((node) => node.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length)).toBe(0);
      const drawerAudit = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(drawerAudit.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: evidence + `/usd-${width}-${theme}-drawer.png`, fullPage: true });
    });
  }

test('UI-08 duplicate command, fresh command and REVERSED replay', async ({ page }) => {
  const previous = scope('KZT');
  await newScope('KZT', 'A25 replay ' + Date.now());
  const goods = await legacyStock('KZT', 'A25 replay goods', '5', '1000', '2000');
  await overview(page, 'KZT');
  const form = await readySaleForm(page);
  const prepare = async () => {
    await form.locator('select[name=productId]').selectOption(goods.product);
    await form.locator('input[name=quantityUnits]').fill('1');
  };
  await prepare();
  const posted = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/bar');
  await form.getByRole('button', { name: 'Продать' }).dblclick();
  const command = await posted;
  const replay = () => page.request.post(command.url(), { headers: command.headers(), data: command.postDataBuffer()! });
  await expect(form.getByRole('status')).toContainText('Продажа записана');
  expect((await call('KZT', '/bar/sales')).length).toBe(1);
  expect((await replay()).status()).toBe(200);
  expect((await call('KZT', '/bar/sales')).length).toBe(1);
  await page.goto('/bar/operations');
  await page.getByRole('button', { name: 'Вернуть на склад', exact: true }).click();
  // возврат подтверждается окном с суммой (ADR-182)
  await page.getByRole('dialog').getByRole('button', { name: 'Вернуть на склад', exact: true }).click();
  await expect(page.locator('tr').filter({ hasText: 'A25 replay goods' }).filter({ hasText: 'Возврат' })).toBeVisible();
  await expect.poll(async () => (await call('KZT', '/bar/report')).revenueMinor).toBe('0');
  const before = await call('KZT', '/bar/report');
  const reversed = await replay();
  expect(reversed.status()).toBe(200);
  expect(await reversed.text()).toContain('уже отменена');
  expect(await call('KZT', '/bar/report')).toEqual(before);
  await page.goto('/bar');
  await readySaleForm(page);
  await prepare();
  const completed = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/bar');
  await form.getByRole('button', { name: 'Продать' }).click();
  await completed;
  await expect(form.getByRole('status')).toContainText('Продажа записана');
  await expect.poll(async () => (await call('KZT', '/bar/sales')).length).toBe(2);
  writeFileSync(evidence + '/replay-ui.json', JSON.stringify({ sameKeyCount: 1, newKeyCount: 2, reversedReplayUnchanged: true }));
  privateData.scopes.KZT = previous;
  savePrivate();
});

test('UI-06 supplier void restores cash and debt', async ({ page }) => {
  const previous = scope('KZT');
  const scenarioId = randomUUID();
  const goodsName = `A25 void goods ${scenarioId}`;
  const documentNumber = `A25-VOID-${scenarioId}`;
  try {
    await newScope('KZT', `A25 void ${scenarioId}`);
    await enter(page, 'KZT');
    await createCatalog(page, goodsName);
    await receive(page, goodsName, documentNumber, '3', '100');
    const row = page.locator('tr').filter({ hasText: documentNumber });
    const paymentForm = row.locator('.bar-payment-form');
    await paymentForm.locator('input[name=amount]').fill('100');
    await paymentForm.getByRole('button', { name: 'Оплатить', exact: true }).click();
    await expect(paymentForm.getByRole('status')).toHaveText('Оплата поставщику записана в кассе');
    const beforeReport = await call('KZT', '/bar/report');
    const beforeCash = await call('KZT', '/finance/cash');
    expect(beforeReport).toMatchObject({ supplierPaidMinor: '10000', supplierDebtMinor: '20000' });
    expect(beforeCash.totalMinor).toBe('-10000');
    await page.goto('/bar');
    await expect(stat(page, 'Долг поставщикам')).toHaveText('200 ₸');
    const beforeDom = { supplierDebt: await stat(page, 'Долг поставщикам').innerText(), supplierPaid: (await (await supplierPaid(page, goodsName + ' supplier')).textContent())! };
    expect(beforeDom.supplierPaid).toBe('Оплачено: 100 ₸');

    await page.goto('/finance?show=1#operations');
    const financeMain = page.getByRole('main');
    await expect(financeMain.getByTestId('cash-balance')).toHaveText('−100 ₸');
    const beforeCashDom = await financeMain.getByTestId('cash-balance').innerText();
    const operation = financeMain.getByRole('row').filter({ hasText: documentNumber });
    await expect(operation).toHaveCount(1);
    const voidButton = operation.getByTestId('cash-void');
    await expect(voidButton).toHaveCount(1);
    await voidButton.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Аннулировать', exact: true }).click();
    await expect(operation.getByTestId('cash-void')).toHaveCount(0);
    await expect(financeMain.getByTestId('cash-balance')).toHaveText('0 ₸');
    const afterCashDom = await financeMain.getByTestId('cash-balance').innerText();

    const afterReport = await call('KZT', '/bar/report');
    const afterCash = await call('KZT', '/finance/cash');
    expect(afterReport).toMatchObject({ supplierPaidMinor: '0', supplierDebtMinor: '30000' });
    expect(afterCash.totalMinor).toBe('0');
    await page.goto('/bar');
    await expect(stat(page, 'Долг поставщикам')).toHaveText('300 ₸');
    const afterDom = { supplierDebt: await stat(page, 'Долг поставщикам').innerText(), supplierPaid: (await (await supplierPaid(page, goodsName + ' supplier')).textContent())! };
    expect(afterDom.supplierPaid).toBe('Оплачено: 0 ₸');
    writeFileSync(
      evidence + '/supplier-void-ui.json',
      JSON.stringify({
        fixture: { scenarioId, goodsName, documentNumber },
        expected: { before: { supplierPaidMinor: '10000', supplierDebtMinor: '20000', cashMinor: '-10000' }, after: { supplierPaidMinor: '0', supplierDebtMinor: '30000', cashMinor: '0' } },
        API: { beforeReport, beforeCash, afterReport, afterCash },
        DOM: { before: { ...beforeDom, cash: beforeCashDom }, after: { ...afterDom, cash: afterCashDom } },
      }),
    );
  } finally {
    privateData.scopes.KZT = previous;
    savePrivate();
  }
});

test('UI-07 server validation retains draft and has no receipt effects', async ({ page }) => {
  const previous = scope('KZT');
  await newScope('KZT', 'A25 validation ' + Date.now());
  await enter(page, 'KZT');
  await createCatalog(page, 'A25 validation goods');
  const form = await fillReceipt(page, 'A25 validation goods', 'A25-VALIDATION', '1', '10');
  const count = async () => await query('SELECT count(*)::int n FROM bar_receipts WHERE property_id=$1', [scope('KZT').property]);
  const before = await count();
  await form.evaluate((node: HTMLFormElement) => {
    node.noValidate = true;
  });
  await form.locator('input[name=documentDate]').evaluate((node: HTMLInputElement) => {
    node.type = 'text';
  });
  await form.locator('input[name=documentDate]').fill('2026-02-30');
  await form.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  expect(await count()).toEqual(before);
  await expect(form.locator('input[name=documentNumber]')).toHaveValue('A25-VALIDATION');
  await form.locator('input[name=documentDate]').fill('2026-10-07');
  for (const [field, value] of [
    ['quantityUnits.0', '9223372036854775808'],
    ['unitCost.0', '92233720368547758.08'],
  ] as const) {
    await form.locator(`input[name="${field}"]`).fill(value);
    const completed = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/bar/receipts/new');
    await form.getByRole('button', { name: 'Сохранить приход' }).click();
    await completed;
    await expect(form.getByRole('alert')).toBeVisible();
    expect(await count()).toEqual(before);
    await expect(form.locator(`input[name="${field}"]`)).toHaveValue(value);
    await form.locator(`input[name="${field}"]`).fill(field === 'unitCost.0' ? '10' : '1');
  }
  await form.evaluate((node: HTMLFormElement) =>
    node.addEventListener(
      'submit',
      () => {
        (node.querySelector('input[name=barCurrency]') as HTMLInputElement).value = 'USD';
      },
      { capture: true, once: true },
    ),
  );
  await form.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(form.getByRole('alert')).toContainText('Валюта формы');
  expect(await count()).toEqual(before);
  privateData.scopes.KZT = previous;
  savePrivate();
});

test('UI-10 empty scope and actual read failure never become successful zeros', async ({ page }) => {
  const previous = scope('KZT');
  await newScope('KZT', 'A25 empty ' + Date.now());
  await overview(page, 'KZT');
  await expect(stat(page, 'Выручка бара')).toHaveText('0 ₸');
  await expect(page.getByText(/^Приходов пока нет/)).toBeVisible();
  await expect((await openSaleForm(page)).getByRole('button', { name: 'Продать' })).toBeDisabled();
  expect((await query("SELECT has_table_privilege('wetop_app','pms_test.bar_stock_movements','SELECT') allowed"))[0].allowed).toBe(true);
  try {
    await query('REVOKE SELECT ON pms_test.bar_stock_movements FROM wetop_app, wetop_service');
    await page.reload();
    await expect(page.getByRole('main').getByTestId('bar-load-error')).toBeVisible();
    await expect(page.getByTestId('bar-totals')).toHaveCount(0);
  } finally {
    await query('GRANT SELECT ON pms_test.bar_stock_movements TO wetop_app, wetop_service');
    privateData.scopes.KZT = previous;
    savePrivate();
  }
});

test('UI-09 negative fractional profit and zero stock remain exact', async ({ page }) => {
  const previous = scope('USD');
  try {
    await newScope('USD', 'A25 fraction ' + Date.now());
    await legacyStock('USD', 'A25 fraction goods', '1', '2', '1');
    await enter(page, 'USD');
    await sell(page, 'A25 fraction goods', '1');
    const expected = { revenueMinor: '1', costMinor: '2', grossProfitMinor: '-1', stockCostMinor: '0' };
    const report = await call('USD', '/bar/report');
    for (const [k, v] of Object.entries(expected)) expect(report[k]).toBe(v);
    await page.goto('/bar');
    await expect(stat(page, 'Выручка бара')).toHaveText('0,01 USD');
    await expect(stat(page, 'Прибыль от продаж')).toHaveText('−0,01 USD');
    const revenue = await stat(page, 'Выручка бара').innerText();
    const profit = await stat(page, 'Прибыль от продаж').innerText();
    const zeroStock = await expectStockCost(page, '0', 'USD');
    writeFileSync(
      evidence + '/fraction-negative-zero.json',
      JSON.stringify({ expected, API: report, DOM: { revenue, stock: zeroStock, profit } }),
    );
  } finally {
    privateData.scopes.USD = previous;
    savePrivate();
  }
});

test('UI-10 normal STAFF read and settings permission refusal', async ({ page }) => {
  await query("UPDATE memberships SET role='STAFF' WHERE user_id=$1 AND organization_id=$2", [privateData.user, privateData.org]);
  try {
    const report = await call('KZT', '/bar/report');
    expect(report.revenueMinor).toBe('60000');
    await overview(page, 'KZT');
    await expect(stat(page, 'Выручка бара')).toHaveText('600 ₸');
    // UI-FIX-01: без права settings формы цены нет, цена видна текстом; сервер отказывает и прямому запросу
    await page.goto('/bar/products');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.bar-price-form')).toHaveCount(0);
    const item = (await call('KZT', '/bar/stock'))[0];
    const s = scope('KZT');
    const refused = await fetch(`${api}/bar/products/${item.id}/price`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'x-wetop-scope': `business=${s.business};location=${s.location}`, 'content-type': 'application/json' },
      body: JSON.stringify({ salePriceMinor: '20000' }),
    });
    const error = (await refused.json()) as { message?: string };
    expect(refused.status).toBe(403);
    expect((await call('KZT', '/bar/stock'))[0].salePrice).toBe(item.salePrice);
    writeFileSync(
      evidence + '/staff-permission.json',
      JSON.stringify({ role: 'STAFF', readAllowed: true, revenueMinor: report.revenueMinor, settingsRejected: true, priceUnchanged: true, priceFormShown: false, error: error.message ?? null }),
    );
  } finally {
    await query("UPDATE memberships SET role='OWNER' WHERE user_id=$1 AND organization_id=$2", [privateData.user, privateData.org]);
  }
});
