import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * BOOK-SEC1 (аудит 29.09.2026, ADR-129): виджет бронирования на чужом сайте показывает проверку Cloudflare Turnstile перед
 * бронью. Здесь — поведение виджета в браузере: кнопка ждёт токена, токен уходит в `POST /w/book`, после попытки проверка
 * сбрасывается (токен одноразовый), без публичного ключа форма как раньше. Сайт, API и Cloudflare подменены; настоящие
 * ключи и настоящий Cloudflare не нужны.
 */
const script = readFileSync(
  process.env['WIDGET_TEST_SCRIPT'] || 'apps/api/src/web-booking/widget.js',
  'utf8',
);
const SITE = 'pms_abcdef123456';
const QUOTE = {
  site: 'Гостиница',
  arrivalDate: '2026-10-05',
  departureDate: '2026-10-07',
  nights: 2,
  adults: 1,
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  ratePlan: 'Базовый',
  categories: [
    {
      code: 'single',
      name: 'Одиночная',
      capacity: 1,
      fits: true,
      available: 2,
      closed: false,
      totalMinor: '2200000',
      perNight: [],
    },
  ],
};
const DONE = {
  confirmationNumber: '20261005-ABC123',
  status: 'CONFIRMED',
  arrivalDate: '2026-10-05',
  departureDate: '2026-10-07',
  nights: 2,
  categoryName: 'Одиночная',
  adults: 1,
  totalMinor: '2200000',
  currency: 'KZT',
  checkInTime: '14:00',
};

/** Поддельный Turnstile: запоминает параметры показа, счёт сбросов; токен «решает» тест, как решал бы гость */
const FAKE_TURNSTILE = `
  window.__ts = { renders: 0, resets: 0, opts: null };
  window.turnstile = {
    render: function (box, opts) { window.__ts.renders += 1; window.__ts.opts = opts; return 'w' + window.__ts.renders; },
    reset: function () { window.__ts.resets += 1; },
  };
`;

interface Setup {
  siteKey: string | null;
  bookAnswers?: Array<{ status: number; body: unknown }>;
  turnstileScript?: 'ok' | 'blocked';
}

async function setup(page: Page, options: Setup) {
  const booked: Array<Record<string, unknown>> = [];
  let turnstileLoads = 0;
  const answers = [...(options.bookAnswers ?? [{ status: 201, body: DONE }])];
  await page.route('https://hotel.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<html><body><div id="pms-booking"></div><script src="https://api.test/w/widget.js" data-site="${SITE}"></script></body></html>`,
    }),
  );
  await page.route('https://api.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/w/widget.js')
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: script });
    if (url.pathname === '/w/config')
      return route.fulfill({ json: { turnstileSiteKey: options.siteKey } });
    if (url.pathname === '/w/availability') return route.fulfill({ json: QUOTE });
    if (url.pathname === '/w/book') {
      booked.push(route.request().postDataJSON() as Record<string, unknown>);
      const answer = answers.shift() ?? { status: 201, body: DONE };
      return route.fulfill({ status: answer.status, json: answer.body });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route('https://challenges.cloudflare.com/**', (route) => {
    turnstileLoads += 1;
    if (options.turnstileScript === 'blocked') return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE });
  });
  await page.goto('https://hotel.test/');
  return { booked, loads: () => turnstileLoads };
}

/** Поиск цен → выбор категории → форма гостя */
async function openGuestForm(page: Page) {
  await page.locator('[data-pmsw="quote"]').click();
  await page.locator('[data-pmsw="choose"]').click();
  await expect(page.locator('[data-pmsw="form"]')).toBeVisible();
}
async function fillGuest(page: Page) {
  await page.locator('[data-pmsw="firstName"]').fill('Айгерим');
  await page.locator('[data-pmsw="lastName"]').fill('Тестова');
  await page.locator('[data-pmsw="phone"]').fill('+7 701 123 45 67');
}
/** Гость прошёл проверку: Cloudflare вызывает callback с токеном */
const solve = (page: Page, token: string) =>
  page.evaluate(
    (t) =>
      (
        window as unknown as { __ts: { opts: { callback: (x: string) => void } } }
      ).__ts.opts.callback(t),
    token,
  );
const tsState = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __ts?: { renders: number; resets: number } }).__ts,
  );

test('с ключом: поиск цен без проверки, кнопка брони ждёт токена, токен уходит в /w/book', async ({
  page,
}) => {
  const s = await setup(page, { siteKey: 'site-key-not-real' });
  // поиск цен идёт без проверки: Cloudflare ещё не загружался
  await page.locator('[data-pmsw="quote"]').click();
  await expect(page.locator('[data-pmsw="choose"]')).toBeVisible();
  expect(s.loads()).toBe(0);

  await page.locator('[data-pmsw="choose"]').click();
  await fillGuest(page);
  const submit = page.locator('[data-pmsw="submit"]');
  await expect(submit).toBeDisabled();
  await expect.poll(() => tsState(page).then((t) => t?.renders)).toBe(1);
  const opts = await page.evaluate(
    () => (window as unknown as { __ts: { opts: Record<string, unknown> } }).__ts.opts,
  );
  expect(opts).toMatchObject({ sitekey: 'site-key-not-real', action: 'booking', language: 'ru' });

  await solve(page, 'tok-1');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('[data-pmsw="done"]')).toBeVisible();
  expect(s.booked).toHaveLength(1);
  expect(s.booked[0]).toMatchObject({ k: SITE, category: 'single', turnstileToken: 'tok-1' });
});

test('токен одноразовый: после отказа проверка сбрасывается, кнопка ждёт нового токена', async ({
  page,
}) => {
  const s = await setup(page, {
    siteKey: 'site-key-not-real',
    bookAnswers: [
      { status: 403, body: { message: 'Проверка устарела: пройдите её ещё раз' } },
      { status: 201, body: DONE },
    ],
  });
  await openGuestForm(page);
  await fillGuest(page);
  await expect.poll(() => tsState(page).then((t) => t?.renders)).toBe(1);
  await solve(page, 'tok-old');
  const submit = page.locator('[data-pmsw="submit"]');
  await submit.click();

  await expect(page.locator('[data-pmsw="msg"]')).toContainText('Проверка устарела');
  await expect(submit).toBeDisabled();
  expect((await tsState(page))?.resets).toBe(1);

  await solve(page, 'tok-new');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('[data-pmsw="done"]')).toBeVisible();
  expect(s.booked.map((b) => b['turnstileToken'])).toEqual(['tok-old', 'tok-new']);
});

test('токен истёк, пока гость заполнял форму, — кнопка снова ждёт проверки', async ({ page }) => {
  await setup(page, { siteKey: 'site-key-not-real' });
  await openGuestForm(page);
  await expect.poll(() => tsState(page).then((t) => t?.renders)).toBe(1);
  await solve(page, 'tok-1');
  await expect(page.locator('[data-pmsw="submit"]')).toBeEnabled();
  await page.evaluate(() =>
    (window as unknown as { __ts: { opts: { 'expired-callback': () => void } } }).__ts.opts[
      'expired-callback'
    ](),
  );
  await expect(page.locator('[data-pmsw="submit"]')).toBeDisabled();
});

test('без публичного ключа форма как раньше: кнопка доступна, Cloudflare не грузится, токена в запросе нет', async ({
  page,
}) => {
  const s = await setup(page, { siteKey: null });
  await openGuestForm(page);
  await fillGuest(page);
  const submit = page.locator('[data-pmsw="submit"]');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('[data-pmsw="done"]')).toBeVisible();
  expect(s.loads()).toBe(0);
  expect(s.booked).toHaveLength(1);
  expect(s.booked[0]).not.toHaveProperty('turnstileToken');
});

test('скрипт Cloudflare не загрузился (блокировщик, сеть): гость видит понятный текст, брони не отправить', async ({
  page,
}) => {
  const s = await setup(page, { siteKey: 'site-key-not-real', turnstileScript: 'blocked' });
  await openGuestForm(page);
  await expect(page.locator('[data-pmsw="msg"]')).toContainText('Не удалось загрузить проверку');
  await expect(page.locator('[data-pmsw="submit"]')).toBeDisabled();
  expect(s.booked).toHaveLength(0);
});
