import { test, expect } from '@playwright/test';

/**
 * Цвет статуса записи один на компьютере и телефоне (владелец 24.10.2026, «примени чего не хватает»): тон из
 * реестра статусов (lib/status/beauty.ts): «Записан» warning, «Подтверждена» info. До правки сетка дня
 * варианта B красила «Записан» в синий, как «Подтверждена», а телефон в жёлтый.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const day = '2026-10-19';

test('«Записан» жёлтый и «Подтверждена» синяя одинаково на 1440 и 390', async ({ page, request }) => {
  test.setTimeout(150_000);
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
  const service = await call('/beauty/services', { name: 'Стрижка', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' });
  await call(`/beauty/services/${service.id}/location`, { enabled: true }, 'put');
  const master = await call('/beauty/employees', { name: 'Тест Мастер' });
  await call(`/beauty/employees/${master.id}/services`, { serviceIds: [service.id] }, 'put');
  const rev = (await call(`/beauty/schedule?employee=${master.id}`, {}, 'get')).weekRevision;
  await call(`/beauty/employees/${master.id}/working-hours`, { expectedRevision: rev, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }, 'put');
  const book = async (time: string, name: string) => {
    const dayView = await call('/beauty/appointments', { employeeId: master.id, serviceId: service.id, startsAt: `${day}T${time}:00+05:00`, firstName: name });
    return (dayView.appointments as Array<{ id: string; customer: { name: string } }>).find((a) => a.customer.name === name)!;
  };
  await book('10:00', 'Тест Записан');
  const confirmed = await book('12:00', 'Тест Подтверждена');
  await call(`/beauty/appointments/${confirmed.id}/status`, { status: 'CONFIRMED' });

  const colours = async () =>
    page.evaluate(() => {
      const probe = (v: string) => {
        const el = document.createElement('i');
        el.style.color = `var(${v})`;
        document.body.append(el);
        const c = getComputedStyle(el).color;
        el.remove();
        return c;
      };
      const tile = (cls: string) => {
        const el = [...document.querySelectorAll<HTMLElement>(`.beauty-tile--${cls}`)].find((n) => n.offsetParent !== null)
          ?? document.querySelector<HTMLElement>(`.beauty-tile--${cls}`);
        return el ? getComputedStyle(el).borderLeftColor : null;
      };
      return { booked: tile('booked'), confirmed: tile('confirmed'), warning: probe('--warning'), info: probe('--info') };
    });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(`/calendar?date=${day}`);
    // телефон показывает одного мастера; записи в DOM ждём, видимость не нужна (цвет из стилей)
    await expect(page.locator('.beauty-tile--booked').first()).toBeAttached();
    await expect(page.locator('.beauty-tile--confirmed').first()).toBeAttached();
    const c = await colours();
    expect(c.booked, `ширина ${width}`).toBe(c.warning);
    expect(c.confirmed, `ширина ${width}`).toBe(c.info);
  }
});
