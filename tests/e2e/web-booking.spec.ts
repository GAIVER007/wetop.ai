import { expect, test } from '@playwright/test';

/**
 * Срез 9, гейт (план §7): демо-страница с виджетом на адресе API → цены по категориям на завтра →
 * бронь одноместной → номер брони → карточка в PMS с источником «сайт» → в аналитике «брони с сайта 1».
 * Бронь настоящая (занимает ячейку) — в конце отменяется через API, как со стойки; комментарий гостя
 * содержит метку E2E-АВТОТЕСТ, по ней уборка e2e найдёт бронь, если тест сорвётся.
 */
const API = 'http://127.0.0.1:3001';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test.describe.configure({ mode: 'serial' });
test.use({ userAgent: DESKTOP_UA });

let siteId = '';
let key = '';
let number = '';
const almaty = (offsetDays: number) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
};
const arrival = almaty(1);
const departure = almaty(2);

test.beforeAll(async ({ request }) => {
  const r = await request.post(`${API}/analytics/sites`, {
    data: { name: 'E2E-АВТОТЕСТ виджет', hosts: ['test-site.localhost'] },
  });
  expect(r.status()).toBe(201);
  const card = await r.json();
  siteId = card.site.id;
  key = card.site.publicKey;
  const on = await request.patch(`${API}/analytics/sites/${siteId}`, {
    data: { bookingEnabled: true },
  });
  expect(on.status()).toBe(200);
  expect((await on.json()).site.bookingRatePlan).toBeTruthy();
});
test.afterAll(async ({ request }) => {
  if (number) await request.post(`${API}/reservations/${number}/cancel`);
  if (siteId) await request.delete(`${API}/analytics/sites/${siteId}`);
});

test('виджет: цены на завтра, бронь одноместной, номер, карточка в PMS с источником «сайт»', async ({
  page,
}) => {
  await page.goto(`${API}/w/demo?k=${key}`);
  const root = page.locator('[data-pmsw="root"]');
  await expect(root).toBeVisible();
  await root.locator('[data-pmsw="arrival"]').fill(arrival);
  await root.locator('[data-pmsw="departure"]').fill(departure);
  await root.locator('[data-pmsw="adults"]').selectOption('1');
  await root.locator('[data-pmsw="quote"]').click();

  const cats = root.locator('[data-pmsw="cat"]');
  await expect(cats.first()).toBeVisible();
  const count = await cats.count();
  expect(count).toBeGreaterThan(0);
  // все категории объекта с ценой за одну ночь
  for (const row of await cats.all()) {
    await expect(row.locator('.p')).toContainText('₸');
  }
  // первая категория со свободным местом и кнопкой
  const bookable = root.locator('[data-pmsw="cat"]:has([data-pmsw="choose"])').first();
  await expect(bookable).toBeVisible();
  const categoryName = (await bookable.locator('.n').textContent())?.trim() ?? '';
  await bookable.locator('[data-pmsw="choose"]').click();

  await root.locator('[data-pmsw="firstName"]').fill('Тест');
  await root.locator('[data-pmsw="lastName"]').fill('Виджет');
  await root.locator('[data-pmsw="phone"]').fill('+7 701 000 00 00');
  await root.locator('[data-pmsw="email"]').fill('widget@example.com');
  await root.locator('[data-pmsw="comment"]').fill('E2E-АВТОТЕСТ: бронь из виджета');
  await root.locator('[data-pmsw="submit"]').click();

  const done = root.locator('[data-pmsw="done"]');
  await expect(done).toBeVisible();
  number = (await done.getAttribute('data-number')) ?? '';
  expect(number).toMatch(/^\d{8}-[A-Z0-9]{6}$/);
  await expect(done).toContainText(categoryName);
  await page.screenshot({ path: 'reports/screenshots/web-booking-widget.png', fullPage: true });

  // карточка брони в PMS
  await page.goto(`/reservations/${number}`);
  // номер брони есть и в заголовке, и во вкладке «История» (PR #2) — проверяем заголовок карточки
  await expect(page.getByRole('heading', { name: `Бронь ${number}` })).toBeVisible();
  await expect(page.getByText('сайт', { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId('reservation-notes')).toContainText(
    'E2E-АВТОТЕСТ: бронь из виджета',
  );
  await expect(page.getByTestId('reservation-notes')).toContainText('Бронь с сайта');
  await page.screenshot({ path: 'reports/screenshots/web-booking-card.png', fullPage: true });
});

test('аналитика: бронь связана с сессией счётчика — «брони с сайта» 1', async ({
  page,
  request,
}) => {
  const today = almaty(0);
  await expect
    .poll(
      async () => {
        const r = await request.get(
          `${API}/analytics/sites/${siteId}/report?from=${today}&to=${today}`,
        );
        return (await r.json()).summary.bookings;
      },
      { timeout: 20_000 },
    )
    .toBe(1);
  await page.goto(`/analytics?site=${siteId}&from=${today}&to=${today}`);
  await expect(page.getByTestId('an-bookings')).toHaveText('1');
  await expect(page.getByTestId('an-source-bookings').first()).toHaveText('1');
  // поиск дат из виджета попал в календарь спроса
  await expect(
    page.locator(`[data-testid="an-demand-row"][data-arrival="${arrival}"]`),
  ).toHaveCount(1);
});
