import { test, expect } from '@playwright/test';

/**
 * «На весь экран» в журнале салона (владелец 24.10.2026): квадратик перед «Быстрым отчётом» в дне и неделе,
 * как у календаря гостиницы. Нажатие раскрывает журнал на весь экран, Esc возвращает.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;

test('салон: «На весь экран» перед «Быстрым отчётом» в дне и неделе', async ({ page, request }) => {
  test.setTimeout(150_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const scope = `business=${f.business};location=${f.locations[0]}`;
  const headers = { 'x-wetop-scope': scope };
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(scope), domain: '127.0.0.1', path: '/' }]);
  const call = async (path: string, data: Record<string, unknown>, method: 'post' | 'put' | 'get' = 'post') => {
    const response = await request[method](api + path, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const service = await call('/beauty/services', { name: 'Стрижка', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' });
  await call(`/beauty/services/${service.id}/location`, { enabled: true }, 'put');
  const master = await call('/beauty/employees', { name: 'Тест Мастер' });
  await call(`/beauty/employees/${master.id}/services`, { serviceIds: [service.id] }, 'put');
  const rev = (await call(`/beauty/schedule?employee=${master.id}`, {}, 'get')).weekRevision;
  await call(`/beauty/employees/${master.id}/working-hours`, { expectedRevision: rev, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }, 'put');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/calendar?date=2026-10-19', '/calendar?date=2026-10-19&view=month']) {
    await page.goto(path);
    const actions = page.getByRole('group', { name: 'Период и действия журнала' });
    const expand = actions.getByRole('button', { name: 'На весь экран', exact: true });
    const report = actions.getByRole('button', { name: 'Быстрый отчёт' });
    await expect(expand).toBeVisible();
    const [e, r] = [(await expand.boundingBox())!, (await report.boundingBox())!];
    expect(Math.abs(e.width - e.height)).toBeLessThan(2);
    expect(e.x + e.width).toBeLessThanOrEqual(r.x + 1);
    expect(r.x - (e.x + e.width)).toBeLessThan(24);
    await expand.click();
    const journal = page.locator('.page.journal-page');
    await expect(journal).toHaveAttribute('data-expanded', 'true');
    const box = (await journal.boundingBox())!;
    expect(box.y).toBeLessThanOrEqual(1);
    expect(box.height).toBeGreaterThanOrEqual(899);
    // журнал поверх шапки и меню: точка в верхней строке экрана принадлежит журналу
    expect(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, 20)?.closest('.journal-page'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(journal).not.toHaveAttribute('data-expanded', 'true');
  }
});
