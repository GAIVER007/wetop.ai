import { createServer, type Server } from 'node:http';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Срез 8, гейт (план §11): вымышленный сайт http://test-site.localhost:3999 отдаёт HTTP-сервер теста, код
 * счётчика на нём настоящий (GET /a/pms.js с API), события летят в живой приёмник, отчёт читается со
 * страницы PMS.
 *   A, десктоп, прямой заход: / → /rooms                              сессия 1, 2 просмотра
 *   A, «31 минута спустя», ?utm_source=instagram&utm_medium=social   сессия 2, 1 просмотр
 *   B, мобильный, реферер google: / + search(2026-10-01)              сессия 3, 1 просмотр, 1 событие
 *   бот и чужой Origin — 204 без записи
 * Сайт создаётся и удаляется тестом вместе со статистикой.
 *
 * Почему настоящий сервер, а не page.route: страницу «из ниоткуда» Chromium считает внешней и по правилу
 * Local Network Access не даёт ей грузить скрипт с 127.0.0.1 (в бою API на публичном адресе, проверки нет).
 * Имя *.localhost браузер сам ведёт на loopback; origin у сайта другой, чем у API, поэтому заголовок
 * Origin и проверка домена работают как на настоящем сайте.
 */
// изолированный прогон задаёт APP_API_URL (тестовый API в pms_test, ADR-042)
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const HOST = 'test-site.localhost:3999';
const SITE_HOST = 'test-site.localhost';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

test.describe.configure({ mode: 'serial' });
test.use({ userAgent: DESKTOP_UA }); // UA Playwright содержит HeadlessChrome — приёмник счёл бы его ботом

let siteId = '';
let key = '';
let server: Server;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());

const html = (title: string) =>
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>` +
  `<script async src="${API}/a/pms.js" data-site="${key}"></script></head>` +
  `<body><h1>${title}</h1><a id="rooms" href="/rooms">Номера</a>` +
  `<button id="search" type="button" onclick="pms('event','search',{arrival:'2026-10-01',departure:'2026-10-03',adults:2,email:'x@y.z'})">Искать</button>` +
  `</body></html>`;

test.beforeAll(async ({ request }) => {
  const r = await request.post(`${API}/analytics/sites`, {
    data: { name: 'E2E-АВТОТЕСТ сайт', hosts: [SITE_HOST] },
  });
  expect(r.status()).toBe(201);
  const card = await r.json();
  siteId = card.site.id;
  key = card.site.publicKey;
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', `http://${HOST}`).pathname;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html(path === '/rooms' ? 'Номера' : 'Главная'));
  });
  await new Promise<void>((resolve) => server.listen(3999, '127.0.0.1', resolve));
});
test.afterAll(async ({ request }) => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (siteId) await request.delete(`${API}/analytics/sites/${siteId}`);
});

const hitSent = (page: Page, type: string) =>
  page.waitForResponse(
    (r) =>
      r.url() === `${API}/a/hit` &&
      r.status() === 204 &&
      (r.request().postData() ?? '').includes(`"t":"${type}"`),
  );

test('три сессии двух посетителей доходят до приёмника и сходятся в отчёте', async ({
  page,
  browser,
  request,
}) => {
  // A: прямой заход, две страницы
  await Promise.all([hitSent(page, 'pageview'), page.goto(`http://${HOST}/`)]);
  await Promise.all([hitSent(page, 'pageview'), page.click('#rooms')]);
  await expect(page.getByRole('heading', { name: 'Номера' })).toBeVisible();

  // A через 31 минуту: та же вкладка, счётчик обязан завести новую сессию
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('_pms_s') ?? '{}');
    s.at = Date.now() - 31 * 60 * 1000;
    sessionStorage.setItem('_pms_s', JSON.stringify(s));
  });
  await Promise.all([
    hitSent(page, 'pageview'),
    page.goto(`http://${HOST}/?utm_source=instagram&utm_medium=social`),
  ]);

  // B: телефон из Google + поиск дат
  const mobile = await browser.newContext({
    userAgent: MOBILE_UA,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const b = await mobile.newPage();
  await Promise.all([
    hitSent(b, 'pageview'),
    b.goto(`http://${HOST}/`, { referer: 'https://www.google.com/' }),
  ]);
  await Promise.all([hitSent(b, 'event'), b.click('#search')]);
  await mobile.close();

  // мусор: бот и чужой домен — 204, не считаются
  const junk = (headers: Record<string, string>) =>
    request.post(`${API}/a/hit`, {
      headers: { 'Content-Type': 'text/plain', Origin: `http://${HOST}`, ...headers },
      data: JSON.stringify({
        k: key,
        v: 'junk-visitor-1',
        s: 'junk-session-1',
        t: 'pageview',
        u: `http://${HOST}/`,
      }),
    });
  expect((await junk({ 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).status()).toBe(
    204,
  );
  expect((await junk({ 'User-Agent': DESKTOP_UA, Origin: 'http://evil.local' })).status()).toBe(
    204,
  );

  // приёмник пишет пачкой раз в секунду — ждём отчёт по API. Ждём и событие поиска (строку
  // спроса): оно уходит своей пачкой, и сводка сходилась раньше, чем оно ложилось в базу — экран
  // открывался без строки спроса (CI 20.09, `an-demand-row` 0 из 1)
  await expect
    .poll(
      async () => {
        const r = await request.get(
          `${API}/analytics/sites/${siteId}/report?from=${today}&to=${today}`,
        );
        const report = await r.json();
        // Pageviews and the later search event can be committed in different batches.
        // Open the server-rendered report only after both have reached the database.
        return { ...report.summary, demand: report.demand };
      },
      { timeout: 20_000 },
    )
    .toMatchObject({
      sessions: 3,
      visitors: 2,
      pageviews: 4,
      mobileSessions: 1,
      demand: [{ arrival: '2026-10-01', searches: 1 }],
    });

  // экран PMS
  await page.goto(`/website/analytics?site=${siteId}&from=${today}&to=${today}`);
  await expect(page.getByRole('main').getByTestId('an-site-name')).toHaveText('E2E-АВТОТЕСТ сайт');
  await expect(page.getByRole('main').getByTestId('an-sessions')).toHaveText('3');
  await expect(page.getByRole('main').getByTestId('an-visitors')).toHaveText('2');
  await expect(page.getByRole('main').getByTestId('an-pageviews')).toHaveText('4');
  await expect(page.getByRole('main').getByTestId('an-pages-per-session')).toHaveText('1,33');
  await expect(page.getByRole('main').getByTestId('an-mobile-share')).toHaveText('33 %');

  const sources = page.getByRole('main').getByTestId('an-source-row');
  await expect(sources).toHaveCount(3);
  const seen = await sources.evaluateAll((rows) =>
    rows.map(
      (r) =>
        `${r.getAttribute('data-kind')}/${r.getAttribute('data-source')}=${r.getAttribute('data-sessions')}`,
    ),
  );
  expect(seen.sort()).toEqual(['DIRECT/=1', 'SEARCH/google=1', 'SOCIAL/instagram=1']);

  await expect(page.getByRole('main').getByTestId('an-page-row')).toHaveCount(2);
  await expect(page.getByRole('main').getByTestId('an-demand-row')).toHaveCount(1);
  await expect(page.getByRole('main').getByTestId('an-demand-row').first()).toHaveAttribute(
    'data-arrival',
    '2026-10-01',
  );

  // подсказка на столбце
  const chart = page.getByRole('main').getByTestId('an-chart-sessions');
  const box = await chart.locator('svg').boundingBox();
  if (box) await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.6);
  await page.screenshot({ path: 'reports/screenshots/web-analytics-report.png', fullPage: true });
});

test('настройки сайта: код с ключом, «Проверить счётчик» видит события', async ({ page }) => {
  await page.goto('/website/settings');
  const card = page.getByRole('main').locator(`[data-testid="site-card"][data-key="${key}"]`);
  await expect(card).toBeVisible();
  // WEB2: код счётчика — в окне установки
  await card.getByTestId('site-install').click();
  await expect(card.getByTestId('site-card-snippet')).toContainText(`data-site="${key}"`);
  await expect(card.getByTestId('site-card-snippet')).toContainText('/a/pms.js');
  await page.keyboard.press('Escape');
  await expect(card.getByTestId('site-card-today')).toHaveText('3');
  await card.getByTestId('site-check').click();
  await expect(card.getByTestId('site-check-result')).toContainText('Счётчик жив');
  await page.screenshot({ path: 'reports/screenshots/web-analytics-setup.png', fullPage: true });
});

test('демо-страница на адресе API: просмотры и клики доходят и видны в отчёте', async ({
  page,
  request,
}) => {
  await Promise.all([hitSent(page, 'pageview'), page.goto(`${API}/a/demo?k=${key}`)]);
  await expect(page.getByRole('heading', { name: 'Проверка счётчика PMS' })).toBeVisible();
  await Promise.all([
    hitSent(page, 'event'),
    page.getByRole('button', { name: /phone_click/ }).click(),
  ]);
  await Promise.all([
    hitSent(page, 'pageview'),
    page.getByRole('link', { name: /Вторая страница/ }).click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Вторая страница' })).toBeVisible();

  await expect
    .poll(
      async () => {
        const r = await request.get(
          `${API}/analytics/sites/${siteId}/report?from=${today}&to=${today}`,
        );
        const body = await r.json();
        return {
          sessions: body.summary.sessions,
          pageviews: body.summary.pageviews,
          events: body.events,
        };
      },
      { timeout: 20_000 },
    )
    .toMatchObject({
      sessions: 4,
      pageviews: 6,
      events: [
        { name: 'phone_click', count: 1, sessions: 1 },
        { name: 'search', count: 1, sessions: 1 },
      ],
    });

  await page.goto(`/website/analytics?site=${siteId}&from=${today}&to=${today}`);
  await expect(page.getByRole('main').getByTestId('an-sessions')).toHaveText('4');
  const phone = page
    .getByRole('main')
    .locator('[data-testid="an-event-row"][data-name="phone_click"]');
  await expect(phone).toHaveAttribute('data-count', '1');
  await expect(
    page.getByRole('main').getByTestId('an-devices').locator('tr[data-key="MOBILE"]'),
  ).toContainText('1');
  await expect(
    page.getByRole('main').getByTestId('an-browsers').locator('tr[data-key="Chrome"]'),
  ).toContainText('4');
  await expect(page.getByRole('main').getByTestId('setup-local-warning')).toHaveCount(0); // это страница отчёта
});
