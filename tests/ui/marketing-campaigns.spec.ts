import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Реклама → Кампании» (DATA_MODEL §53, ADR-MKT-B3): кампания, статистика дня вручную и CSV, расход из «Бюджета»
 * с выбором кампании, CTR, CPC, CPM и CPL площадки в таблице. Подставной API считает тем же доменом, что настоящий.
 * Данные вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/marketing-campaigns-2026-10-16';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('кампания: создать, день вручную и CSV, расход из бюджета, показатели площадки', async ({ page, request }) => {
  const reset = await request.post(`${API}/__test/marketing-budget`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const [y, m, d] = today.split('-');
  const main = page.getByRole('main');

  await page.goto('/marketing/ads');
  await expect(main.getByTestId('ads-empty')).toContainText('Кампаний пока нет');
  await main.getByTestId('campaign-add').click();
  let form = page.getByTestId('campaign-form');
  await form.getByTestId('campaign-name').fill('Осень: лиды');
  await form.getByTestId('campaign-save').click();
  await expect(page.getByText('Кампания создана')).toBeVisible();
  const table = main.getByTestId('marketing-ads-campaigns');
  await expect(table.getByRole('row', { name: /Осень: лиды/ })).toContainText('Идёт');

  // то же имя на той же площадке: отказ словами, форма не теряет ввод
  await main.getByTestId('campaign-add').click();
  form = page.getByTestId('campaign-form');
  await form.getByTestId('campaign-name').fill('Осень: лиды');
  await form.getByTestId('campaign-save').click();
  await expect(form.getByRole('alert')).toContainText('уже есть');
  await expect(form.getByTestId('campaign-name')).toHaveValue('Осень: лиды');
  await page.keyboard.press('Escape');

  // день вручную, затем CSV того же дня заменяет его
  await main.getByRole('button', { name: 'Статистика кампании Осень: лиды' }).click();
  const panel = page.getByTestId('campaign-stats-panel');
  await panel.getByTestId('campaign-day-impressions').fill('1000');
  await panel.getByTestId('campaign-day-clicks').fill('10');
  await panel.getByTestId('campaign-day-leads').fill('1');
  await panel.getByTestId('campaign-day-save').click();
  await expect(page.getByText('Статистика дня сохранена')).toBeVisible();
  await expect(panel.getByTestId('campaign-days')).toContainText('1000 показов');
  await panel.getByTestId('campaign-import-file').setInputFiles({
    name: 'meta.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`\uFEFFДата;Показы;Клики;Лиды\r\n${d}.${m}.${y};25 000;300;12\r\n`),
  });
  await panel.getByTestId('campaign-import-save').click();
  await expect(page.getByText('Загружено 1 день статистики')).toBeVisible();
  await expect(panel.getByTestId('campaign-days')).toContainText('25000 показов, 300 кликов, 12 лидов');
  await page.keyboard.press('Escape');

  // расход привязывается к кампании в «Бюджете»
  await page.goto('/marketing/budget/expenses');
  await main.getByTestId('budget-add').first().click();
  const expense = page.getByTestId('budget-expense-form');
  await expense.getByTestId('budget-campaign-id').selectOption({ label: 'Meta Ads: Осень: лиды' });
  await expense.getByTestId('budget-amount').fill('10000');
  await expense.getByTestId('budget-save').click();
  await expect(page.getByText('Расход добавлен')).toBeVisible();
  await expect(main.getByTestId('budget-table')).toContainText('Осень: лиды');

  // 10 000 ₸, 25 000 показов, 300 кликов, 12 лидов: CTR 1,20 %, CPC 33,33 ₸, CPM 400 ₸, CPL 833,33 ₸
  await page.goto('/marketing/ads');
  const row = main.getByTestId('marketing-ads-campaigns').getByRole('row', { name: /Осень: лиды/ });
  for (const text of ['10 000 ₸', '25 000', '300', '1,20 %', '33,33', '400 ₸', '833,33']) await expect(row).toContainText(text);
  await expect(main.getByTestId('ads-leads')).toContainText('12');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/campaigns-light-${width}.png`, fullPage: true });
  }
});

test('кабинет Meta: одна кнопка в окно Facebook, выбор из отмеченных кабинетов, обновление, отключение; подделка отклонена', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await request.post(`${API}/__test/marketing-budget`, { data: {} });
  // окно Facebook подменяется: тест проверяет адрес, куда уходит браузер, а не сам Facebook
  await page.route('https://www.facebook.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Facebook</title><p>вход</p>' }),
  );
  const main = page.getByRole('main');
  await page.goto('/marketing/ads');
  // никаких номеров: кнопка сразу уводит в окно входа
  await main.getByTestId('meta-connect').click();
  await page.waitForURL(/www\.facebook\.com\/v25\.0\/dialog\/oauth/);
  const dialog = new URL(page.url());
  expect(dialog.searchParams.get('response_type')).toBe('code');
  expect(dialog.searchParams.get('override_default_response_type')).toBe('true');
  expect(dialog.searchParams.get('config_id')).toBe('2');
  const state = dialog.searchParams.get('state')!;

  // подделанный state: кабинет не подключается, итог словами
  await page.goto('/marketing/ads/meta/callback?code=c0de&state=forged');
  await expect(main.getByTestId('meta-result')).toContainText('Кабинет не подключён');

  // в окне Facebook отмечено два кабинета: выбор здесь
  await page.goto(`/marketing/ads/meta/callback?code=c0de&state=${state}`);
  await page.waitForURL(/\/marketing\/ads\?meta=choose/);
  const choose = main.getByTestId('meta-choose');
  await expect(choose).toContainText('Отель на Абая');
  await expect(choose).toContainText('Отель на Сатпаева');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await choose.getByRole('radio', { name: /Отель на Сатпаева/ }).check();
  await choose.getByTestId('meta-choose-save').click();
  await page.waitForURL(/\/marketing\/ads\?meta=connected/);
  await expect(main.getByTestId('meta-result')).toContainText('Кабинет Meta подключён');
  await expect(main.getByTestId('meta-cabinet')).toContainText('2234567890');
  const row = main.getByTestId('marketing-ads-campaigns').getByRole('row', { name: /Meta: брони осень/ });
  await expect(row).toContainText('Кабинет');
  // ручной правки у кампании кабинета нет; владельцу доступна только остановка в Meta (§57)
  await expect(row.getByRole('button')).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'Остановить' })).toBeVisible();
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/meta-cabinet-light-1440.png`, fullPage: true });

  await main.getByTestId('meta-sync').click();
  await expect(page.getByText('Кабинет обновлён', { exact: false })).toBeVisible();
  await main.getByTestId('meta-disconnect').click();
  await page.getByRole('button', { name: 'Отключить', exact: true }).last().click();
  await expect(page.getByText('Кабинет отключён', { exact: false })).toBeVisible();
  await expect(main.getByTestId('meta-connect')).toBeVisible();
});
