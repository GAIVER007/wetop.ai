import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Языки виджета бронирования (ADR-141): русский по умолчанию, язык по умолчанию задаёт сайт атрибутом data-lang, гость
 * переключает язык кнопками; введённые даты и гости при переключении не теряются; язык уходит в `POST /w/book`, чтобы
 * письмо с подтверждением пришло на языке гостя. Сайт и API подменены, как в booking-widget-turnstile.spec.ts.
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
  promo: null,
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

async function setup(page: Page, dataLang?: string) {
  const booked: Array<Record<string, unknown>> = [];
  const langAttr = dataLang ? ` data-lang="${dataLang}"` : '';
  await page.route('https://hotel.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<html><body><div id="pms-booking"></div><script src="https://api.test/w/widget.js" data-site="${SITE}"${langAttr}></script></body></html>`,
    }),
  );
  await page.route('https://api.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/w/widget.js')
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: script });
    if (url.pathname === '/w/config') return route.fulfill({ json: { turnstileSiteKey: null } });
    if (url.pathname === '/w/availability') return route.fulfill({ json: QUOTE });
    if (url.pathname === '/w/book') {
      booked.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 201, json: DONE });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('https://hotel.test/');
  return { booked };
}

const root = (page: Page) => page.locator('[data-pmsw="root"]');

test('по умолчанию русский; выбранный язык отмечен', async ({ page }) => {
  await setup(page);
  await expect(root(page).locator('h3')).toHaveText('Забронировать');
  await expect(root(page)).toHaveAttribute('lang', 'ru');
  await expect(page.locator('[data-pmsw="lang-ru"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-pmsw="quote"]')).toHaveText('Показать цены');
});

test('data-lang="en": английский с первого показа', async ({ page }) => {
  await setup(page, 'en');
  await expect(root(page).locator('h3')).toHaveText('Book a stay');
  await expect(page.locator('[data-pmsw="quote"]')).toHaveText('Show prices');
  await page.locator('[data-pmsw="quote"]').click();
  await expect(page.locator('[data-pmsw="cat"] .s')).toHaveText('available: 2');
});

test('гость переключает язык: даты и гости остаются, бронь уходит с языком, ответ на языке гостя', async ({
  page,
}) => {
  const { booked } = await setup(page);
  await page.locator('[data-pmsw="arrival"]').fill('2026-10-05');
  await page.locator('[data-pmsw="departure"]').fill('2026-10-07');
  await page.locator('[data-pmsw="adults"]').selectOption('1');
  await page.locator('[data-pmsw="lang-zh"]').click();
  await expect(root(page)).toHaveAttribute('lang', 'zh');
  await expect(root(page).locator('h3')).toHaveText('预订');
  await expect(page.locator('[data-pmsw="arrival"]')).toHaveValue('2026-10-05');
  await expect(page.locator('[data-pmsw="departure"]')).toHaveValue('2026-10-07');
  await page.locator('[data-pmsw="quote"]').click();
  await page.locator('[data-pmsw="choose"]').click();
  await page.locator('[data-pmsw="firstName"]').fill('Айгерим');
  await page.locator('[data-pmsw="lastName"]').fill('Тестова');
  await page.locator('[data-pmsw="phone"]').fill('+7 701 123 45 67');
  await page.locator('[data-pmsw="email"]').fill('guest@example.com');
  await page.locator('[data-pmsw="submit"]').click();
  await expect(page.locator('[data-pmsw="done"]')).toContainText('预订成功');
  await expect(page.locator('[data-pmsw="msg"]')).toHaveText('请保存预订号，入住时需要出示。');
  expect(booked).toHaveLength(1);
  expect(booked[0]).toMatchObject({ lang: 'zh', guest: { email: 'guest@example.com' } });
});

test('казахский: подписи формы и подсказка о письме подтверждения', async ({ page }) => {
  await setup(page, 'kz');
  await expect(root(page)).toHaveAttribute('lang', 'kk');
  await page.locator('[data-pmsw="quote"]').click();
  await page.locator('[data-pmsw="choose"]').click();
  await expect(page.locator('[data-pmsw="submit"]')).toHaveText('Брондауды растау');
  await expect(page.locator('[data-pmsw="form"]')).toContainText('Брондау растауын жібереміз');
});
