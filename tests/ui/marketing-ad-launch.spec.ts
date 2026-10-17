import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * ИИ-таргетолог на «Рекламе» (DATA_MODEL §57, ADR-MKT-LAUNCH): мастер «Новая кампания с ИИ», «Подготовить с ИИ»
 * заполняет текст и аудиторию, город из поиска Meta, подтверждение суммы, экран шагов обновляется сам, затем
 * «Остановить» и «Включить» у кампании. Meta и ИИ подставные. Данные вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/marketing-ad-launch-2026-10-16';
// PNG 1×1: заголовок файла, по которому API узнаёт картинку
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

const axe = async (page: import('@playwright/test').Page) => {
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
};

test('мастер: ИИ заполняет текст, запуск с подтверждением, шаги, затем «Остановить» и «Включить»', async ({ page, request }) => {
  await request.post(`${API}/__test/marketing-budget`, { data: {} });
  const main = page.getByRole('main');

  // без кабинета кнопки запуска нет
  await page.goto('/marketing/ads');
  await expect(main.getByTestId('ad-new')).toHaveCount(0);
  await page.goto('/marketing/ads/launch');
  await expect(main.getByTestId('ad-launch-no-cabinet')).toBeVisible();

  // кабинет подключается тем же входом, что на «Рекламе»
  await page.goto('/marketing/ads/meta/callback?code=c0de&state=fixture-state');
  await page.waitForURL(/\/marketing\/ads\?meta=choose/);
  await main.getByTestId('meta-choose-save').click();
  await page.waitForURL(/\/marketing\/ads\?meta=connected/);

  await page.getByTestId('ad-new').click();
  await page.waitForURL(/\/marketing\/ads\/launch$/);
  const wizard = main.getByTestId('ad-wizard');
  await expect(wizard.getByTestId('ad-page')).toHaveValue('555');
  await expect(wizard.getByTestId('ad-page').locator('option')).toHaveCount(1); // страница без права рекламы не предлагается
  await expect(wizard.getByTestId('ad-budget').locator('xpath=..')).toContainText('50 000 ₸ в день');

  await wizard.getByTestId('ad-creative').setInputFiles({ name: 'offer.png', mimeType: 'image/png', buffer: PNG });
  await expect(wizard.getByRole('img', { name: 'Превью креатива' })).toBeVisible();
  await wizard.getByTestId('ad-offer').fill('Осенние выходные, завтрак включён');
  await wizard.getByTestId('ad-propose').click();
  await expect(wizard.getByTestId('ad-proposed')).toContainText('ИИ подготовил');
  await expect(wizard.getByTestId('ad-headline')).toHaveValue('Осень у гор');
  await expect(wizard.getByTestId('ad-age-min')).toHaveValue('25');
  await expect(wizard.getByLabel('Приветствие в WhatsApp')).toHaveValue('Здравствуйте! Подскажем свободные даты');

  await wizard.getByTestId('ad-city').fill('Алма');
  await wizard.getByTestId('ad-city-find').click();
  await wizard.getByRole('button', { name: 'Алматы' }).click();
  await expect(wizard.getByTestId('ad-cities')).toContainText('Убрать Алматы');

  await wizard.getByTestId('ad-budget').fill('5');
  await wizard.getByTestId('ad-fx').fill('480');
  await axe(page);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/wizard-light-1440.png`, fullPage: true });

  await wizard.getByTestId('ad-launch').click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('до 5 USD в день');
  await confirm.getByRole('button', { name: 'Запустить' }).click();

  await page.waitForURL(/\/marketing\/ads\/launch\/[0-9a-f-]{36}$/);
  const status = main.getByTestId('ad-launch-status');
  // первый просмотр: запуск идёт, страница обновляется сама и доходит до итога
  await expect(status.getByRole('heading', { name: 'Кампания запущена' })).toBeVisible({ timeout: 10_000 });
  await expect(status.getByTestId('ad-launch-done')).toContainText('остановить кампанию можно там же');
  await axe(page);

  await page.goto('/marketing/ads');
  const row = main.getByTestId('marketing-ads-campaigns').getByRole('row', { name: /WETOP: Осень у гор/ });
  await row.getByRole('button', { name: 'Остановить' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Остановить' }).click();
  await expect(page.getByText('Кампания остановлена в Meta')).toBeVisible();
  await row.getByRole('button', { name: 'Включить' }).click();
  await expect(page.getByText('Кампания снова идёт в Meta')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Остановить' })).toBeVisible();
});

test('мастер на телефоне: без горизонтальной прокрутки', async ({ page, request }) => {
  await request.post(`${API}/__test/marketing-budget`, { data: {} });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/marketing/ads/meta/callback?code=c0de&state=fixture-state');
  await page.waitForURL(/\/marketing\/ads\?meta=choose/);
  await page.getByRole('main').getByTestId('meta-choose-save').click();
  await page.waitForURL(/\/marketing\/ads\?meta=connected/);
  await page.goto('/marketing/ads/launch');
  await expect(page.getByTestId('ad-wizard')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await axe(page);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/wizard-light-390.png`, fullPage: true });
});
