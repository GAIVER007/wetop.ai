import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/**
 * Журнал салона, вариант B (владелец 24.10.2026): панель дня справа, загрузка мастера, запись со статусом и оплатой.
 * Снимки в reports/salon-journal-b-2026-10-24/ для отчёта владельцу.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const out = 'reports/salon-journal-b-2026-10-24';
const day = '2026-10-19';

test('вариант B: панель дня, загрузка мастера, «Пришла» меняет статус', async ({ page, request }) => {
  test.setTimeout(180_000);
  mkdirSync(out, { recursive: true });
  const reset = await request.post(`${api}/__test/reset`);
  expect(reset.ok()).toBeTruthy();
  const f = await reset.json();
  const scope = `business=${f.business};location=${f.locations[0]}`;
  const headers = { 'x-wetop-scope': scope };
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' }]);
  const call = async (path: string, data: Record<string, unknown>, method: 'post' | 'put' | 'get' = 'post') => {
    const response = await request[method](api + path, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const service = await call('/beauty/services', { name: 'Маникюр с покрытием', durationMinutes: 60, priceMinor: '1200000', currency: 'KZT' });
  await call(`/beauty/services/${service.id}/location`, { enabled: true }, 'put');
  const masters: Array<{ id: string; name: string }> = [];
  for (const name of ['Айгерим Сапарова', 'Дина Ахметова']) {
    const master = await call('/beauty/employees', { name });
    await call(`/beauty/employees/${master.id}/services`, { serviceIds: [service.id] }, 'put');
    const rev = (await call(`/beauty/schedule?employee=${master.id}`, {}, 'get')).weekRevision;
    await call(`/beauty/employees/${master.id}/working-hours`, { expectedRevision: rev, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }, 'put');
    masters.push(master);
  }
  const book = async (employeeId: string, time: string, name: string) => {
    const dayView = await call('/beauty/appointments', {
      employeeId,
      serviceId: service.id,
      startsAt: `${day}T${time}:00+05:00`,
      firstName: name,
    });
    return (dayView.appointments as Array<{ id: string; customer: { name: string } }>).find((a) => a.customer.name === name)!;
  };
  await book(masters[0]!.id, '10:00', 'Тест Алия');
  const confirmed = await book(masters[0]!.id, '12:00', 'Тест Жанна');
  await call(`/beauty/appointments/${confirmed.id}/status`, { status: 'CONFIRMED' });
  await book(masters[1]!.id, '11:00', 'Тест Камила');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/calendar?date=${day}`);
  const panel = page.getByRole('complementary', { name: 'Панель дня' });
  await expect(panel).toBeVisible();
  // загрузка мастера над колонкой: 2 записи по часу из 9 часов
  await expect(page.locator('.beauty-col-head').first()).toContainText('09:00–18:00, 22%');
  // запись карточкой: статус и оплата
  const tile = page.locator('.beauty-grid-day .beauty-tile').filter({ hasText: 'Тест Жанна' });
  await expect(tile).toContainText('Подтверждена');
  await expect(tile).toContainText('Не оплачено');
  // щелчок открывает карточку и показывает запись в панели дня
  await tile.click();
  await expect(page.getByRole('dialog', { name: 'Запись' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(panel.getByTestId('day-panel-selected')).toContainText('Тест Жанна');
  // «Ближайшие»: у подтверждённой «Пришла», у записанной «Подтвердить»
  const upcoming = panel.getByTestId('day-panel-upcoming');
  await expect(upcoming.getByRole('button', { name: /^Подтвердить: Тест Алия/ })).toBeVisible();
  await page.screenshot({ path: `${out}/journal-b-1440.png` });
  await upcoming.getByRole('button', { name: /^Пришла: Тест Жанна/ }).click();
  await expect(tile).toContainText('В процессе');
  await expect(panel.getByTestId('day-panel-money')).toContainText('Ждём оплату');
  // телефон: панели нет, щелчок открывает карточку сразу
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(panel).toHaveCount(0);
  await page.screenshot({ path: `${out}/journal-b-390.png`, fullPage: false });
});
