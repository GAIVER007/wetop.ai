import { expect, test } from '@playwright/test';
import { journalHeadLook } from '../tools/journal-head-look';

/**
 * Шапка журнала салона как у календаря гостиницы (владелец 24.10.2026: «сделай всё так же, как в гостиницах»).
 * Условия те же, что у эталона `tests/ui/journal-parity-hotel.spec.ts`; день и неделя, обычный и низкий экран.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;

test('салон: шапка журнала как у гостиницы', async ({ page, request }) => {
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
  for (const [width, height] of [[1440, 1000], [1280, 800]] as const) {
    for (const path of ['/calendar?date=2026-10-19', '/calendar?date=2026-10-19&view=week']) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await page.locator('.journal-head__filters').waitFor();
      const look = await journalHeadLook(page);
      const where = `${path} ${width}x${height}`;
      expect(look.padding, where).toBe(height >= 900 ? '16px 24px' : '8px 24px');
      for (const h of look.heights) expect(h, where).toBe(`${h.split('=')[0]}=${look.controlH}`);
      for (const ft of look.fonts) expect(ft, where).toBe(`${ft.split('=')[0]}=${look.textSm}`);
      expect(look.selectsLeftOfSearch, where).toBe(true);
      // ТЗ 25.10.2026, п. 11: на компьютере «Фильтров» нет, все отборы уже в строке
      expect(look.filtersShown, where).toBe(false);
      expect(look.createIcon, where).toBe(true);
      expect(look.lupa, where).toBe(false);
      expect(look.subtitleShown, where).toBe(height >= 900);
      expect(look.titleFont, where).toBe(height >= 900 ? look.text4xl : look.text3xl);
    }
  }
});
