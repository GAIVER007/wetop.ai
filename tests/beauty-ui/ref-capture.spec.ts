import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/**
 * DESIGN.md §21: снимки календаря салона для сравнения с эталоном владельца
 * (`design/references/05_verticals/three_calendar_concepts.png`). Только с `REF_PHASE=before|after`.
 */
const phase = process.env['REF_PHASE'];
const out = `reports/ui44-beauty-2026-10-13/${phase}`;
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;

test.skip(!phase, 'только для сравнения с эталоном: REF_PHASE=before|after');

test('салон: календарь на ширинах и темах', async ({ page, request }) => {
  test.setTimeout(240_000);
  mkdirSync(out, { recursive: true });
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f: { business: string; locations: string[] } = await response.json();
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${f.business};location=${f.locations[0]}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  // вымышленный салон (ADR-010): три услуги, пять мастеров с графиком на всю неделю, записи на 12.10.2026
  const headers = { 'x-wetop-scope': `business=${f.business};location=${f.locations[0]}` };
  const post = async (path: string, data: unknown, method: 'post' | 'put' = 'post') => {
    const r = await request[method](`${api}${path}`, { headers, data });
    expect(r.ok(), `${path}: ${await r.text()}`).toBe(true);
    return r.json().catch(() => null);
  };
  const services = [];
  for (const [name, minutes, price] of [
    ['Стрижка', 60, '1200000'],
    ['Маникюр', 90, '900000'],
    ['Окрашивание', 120, '2500000'],
  ] as const) {
    const s = await post('/beauty/services', { name, durationMinutes: minutes, priceMinor: price, currency: 'KZT' });
    await post(`/beauty/services/${s.id}/location`, { enabled: true }, 'put');
    services.push(s);
  }
  const masters = [];
  for (const name of ['Мастер Алина', 'Мастер Данияр', 'Мастер Мария', 'Мастер Ольга', 'Мастер Ерлан']) {
    const e = await post('/beauty/employees', { name });
    await post(`/beauty/employees/${e.id}/services`, { serviceIds: services.map((x) => x.id) }, 'put');
    await post(
      `/beauty/employees/${e.id}/working-hours`,
      { expectedRevision: (await (await request.get(`${api}/beauty/schedule?employee=${e.id}`, { headers })).json()).weekRevision, intervals: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, timeFrom: '09:00', timeTo: '20:00' })) },
      'put',
    );
    masters.push(e);
  }
  const plan: Array<[number, number, string, string]> = [
    [0, 0, '10:00', 'Гостья Айгуль'],
    [0, 2, '13:00', 'Гостья Мадина'],
    [1, 0, '11:00', 'Гость Тимур'],
    [1, 0, '15:00', 'Гость Арман'],
    [2, 1, '09:30', 'Гостья Асель'],
    [2, 1, '14:00', 'Гостья Камила'],
    [3, 2, '10:30', 'Гостья Нургуль'],
    [3, 1, '16:00', 'Гостья Дана'],
    [4, 0, '12:00', 'Гость Ерболат'],
    [4, 0, '17:00', 'Гость Санжар'],
  ];
  for (const [m, sv, time, firstName] of plan)
    await post('/beauty/appointments', {
      employeeId: masters[m].id,
      serviceId: services[sv].id,
      startsAt: `2026-10-12T${time}:00+05:00`,
      firstName,
    });
  await page.goto('/calendar?date=2026-10-12');
  await expect(page.locator('main h1')).toBeVisible();
  for (const [width, height] of [
    [1312, 820],
    [1440, 900],
    [1024, 768],
    [390, 844],
    [320, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/beauty-${width}-${theme}.png` });
      if (theme === 'light')
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});
