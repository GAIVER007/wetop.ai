import { expect, test } from '@playwright/test';

/**
 * Кабинет горничной гостиницы на настоящем API (решение владельца 22.10.2026, docs/decisions/2026-10-22-hotel-staff-cabinet.md):
 * горничная («Личный кабинет») видит свой номер на уборку на телефоне 390 px и отмечает «Убрано»; руководитель видит
 * статус, «Кто убирает» в карточке номера, график и зарплату гостиницы со сдельной оплатой за уборку.
 */
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;
const shots = process.env.HK_SHOTS_DIR ?? 'reports/hotel-staff-cabinet-2026-10-22';
test.describe.configure({ timeout: 240_000 });

test('горничная отмечает «Убрано» своему номеру с телефона, руководитель видит статус и зарплату', async ({ page, request }) => {
  expect((await request.post(`${api}/__test/reset`)).ok()).toBe(true);
  const maid = await request.post(`${api}/__test/maid`);
  expect(maid.ok(), await maid.text()).toBe(true);
  const { business, location } = (await maid.json()) as { business: string; location: string };
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(`business=${business};location=${location}`), domain: '127.0.0.1', path: '/' },
  ]);

  // горничная, телефон
  expect((await request.post(`${api}/__test/control`, { data: { role: 'EMPLOYEE' } })).ok()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-work');
  const cabinet = page.getByTestId('hotel-cabinet');
  await expect(cabinet).toBeVisible({ timeout: 90_000 });
  const unit = cabinet.getByTestId('hotel-unit');
  await expect(unit).toHaveCount(1);
  await expect(unit).toContainText('Номер 101');
  await expect(unit).toContainText('Требует уборки');
  await expect(cabinet.getByTestId('hotel-month-line')).toContainText('0 уборок');
  const done = unit.getByRole('button', { name: 'Убрано: номер 101' });
  expect((await done.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('body')).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await page.screenshot({ path: `${shots}/hk-maid-390-before.png`, fullPage: true });
  await done.click();
  await expect(unit).toContainText('Убрано сегодня, ждёт проверки', { timeout: 30_000 });
  await expect(unit.getByRole('button', { name: /Убрано:/ })).toHaveCount(0);
  await expect(cabinet.getByTestId('hotel-month-line')).toContainText('1 уборка');
  await expect(cabinet.getByTestId('hotel-pay-total')).toContainText('152 000');
  await page.screenshot({ path: `${shots}/hk-maid-390-after.png`, fullPage: true });
  // рабочие разделы гостиницы горничной закрыты
  await page.goto('/chessboard');
  await expect(page.getByTestId('hotel-cabinet')).toHaveCount(0);

  // руководитель
  expect((await request.post(`${api}/__test/control`, { data: { role: 'OWNER' } })).ok()).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/units/101');
  const panel = page.getByTestId('housekeeping-panel');
  await expect(panel).toContainText('убрано', { timeout: 90_000 });
  await expect(panel.getByTestId('hk-assignee').getByRole('combobox')).toHaveValue(/.+/);
  await expect(panel.getByTestId('hk-assignee')).toContainText('Айгуль Горничная');
  await page.screenshot({ path: `${shots}/hk-manager-unit-1440.png`, fullPage: true });
  await page.goto('/payroll');
  const row = page.getByTestId('hotel-payroll-row').filter({ hasText: 'Айгуль Горничная' });
  await expect(row).toBeVisible({ timeout: 90_000 });
  await expect(row).toContainText('152 000');
  await expect(page.getByRole('button', { name: 'Выплатить' })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/hk-manager-payroll-1440.png`, fullPage: true });
  await page.goto('/staff-schedule');
  await expect(page.getByTestId('hotel-shifts')).toContainText('Айгуль Горничная', { timeout: 90_000 });
  await page.screenshot({ path: `${shots}/hk-manager-schedule-1440.png`, fullPage: true });

  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});
