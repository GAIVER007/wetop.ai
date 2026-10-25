import { expect, test } from './fixtures';
import { journalHeadLook } from '../tools/journal-head-look';

/**
 * Шапка журнала ресторана как у календаря гостиницы (владелец 24.10.2026: «в каждой вертикали всё по-разному
 * выглядит»). Условия те же, что у эталона `tests/ui/journal-parity-hotel.spec.ts`; план зала и расписание.
 */
const api = `http://127.0.0.1:${process.env.FOOD_UI_API_PORT ?? '55824'}`;

test('ресторан: шапка журнала как у гостиницы', async ({ page, request }) => {
  test.setTimeout(150_000);
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const pointer = `business=${f.business};location=${f.locations[0]}`;
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' }]);
  const headers = { 'x-wetop-scope': pointer };
  const area = await (await request.post(`${api}/food-service/areas`, { headers, data: { name: 'Основной зал', sortOrder: 0, active: true } })).json();
  await request.post(`${api}/food-service/tables`, { headers, data: { areaId: area.id, name: 'Стол 7', capacity: 4, sortOrder: 0, active: true } });
  for (const [width, height] of [[1440, 1000], [1280, 800]] as const) {
    for (const path of ['/floor-plan?date=2026-10-12&time=19:00', '/table-reservations?date=2026-10-12']) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await page.locator('.journal-head__filters').waitFor();
      const look = await journalHeadLook(page);
      const where = `${path} ${width}x${height}`;
      expect(look.padding, where).toBe(height >= 900 ? '16px 24px' : '8px 24px');
      for (const h of look.heights) expect(h, where).toBe(`${h.split('=')[0]}=${look.controlH}`);
      for (const ft of look.fonts) expect(ft, where).toBe(`${ft.split('=')[0]}=${look.textSm}`);
      expect(look.selectsLeftOfSearch, where).toBe(true);
      // у ресторана зона, смена и статус уже в строке, «Фильтры» только на телефоне; если кнопка видна, то со значком
      expect(look.filtersIcon || !look.filtersShown, where).toBe(true);
      expect(look.createIcon, where).toBe(true);
      expect(look.lupa, where).toBe(false);
      expect(look.subtitleShown, where).toBe(height >= 900);
      expect(look.titleFont, where).toBe(height >= 900 ? look.text4xl : look.text3xl);
    }
  }
});
