import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * MKT4: опубликованный сайт из SiteSpec v0 в браузере. Ширины 390 и 1440, светлая схема (тёмной в v0 нет:
 * `colorScheme` только `LIGHT`), axe WCAG 2.1 AA, без прокрутки вбок, цели нажатия от 44 px. Снимки:
 * `reports/mkt4-sites-runtime-2026-10-06/`.
 */
const SHOTS = 'reports/mkt4-sites-runtime-2026-10-06';
const PORT = 4330;
const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, 'страница уезжает вбок').toBeLessThanOrEqual(0);
}

async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function targets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a, summary, button')]
      .filter((el) => !el.classList.contains('skip'))
      .map((el) => ({ text: el.textContent?.trim().slice(0, 40), h: el.getBoundingClientRect().height }))
      .filter((t) => t.h > 0 && t.h < 44),
  );
  expect(small, 'цели нажатия ниже 44 px').toEqual([]);
}

for (const vp of WIDTHS) {
  test.describe(`${vp.name} ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('главная: секции, H1, axe, без прокрутки вбок, цели 44 px, снимок', async ({ page }) => {
      const res = await page.goto('/');
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText('Тихие номера у вокзала');
      await expect(page.locator('#pms-booking')).toHaveCount(1);
      await expect(page.locator('#sec-gallery')).toHaveCount(0);
      // Q-276: цена «от» приходит живой из /w/from-prices и ставится скриптом WETOP
      await expect(page.locator('#sec-rooms [data-from-price="standard-double"]')).toHaveText(/^от 25\s000\s₸ \/ ночь$/);
      await expect(page.locator('#sec-pricing')).toBeVisible();
      await expect(page.locator('#sec-pricing [data-price-row]')).toHaveCount(2);
      await expect(page.getByText('Заезд с 14:00, выезд до 12:00')).toBeVisible();
      await noHorizontalScroll(page);
      await targets(page);
      await axe(page);
      await page.screenshot({ path: `${SHOTS}/home-${vp.width}.png`, fullPage: true });
    });

    test('FAQ раскрывается без скриптов, ссылки меню ведут к секциям', async ({ page }) => {
      await page.goto('/');
      const first = page.locator('#sec-faq details').first();
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open', '');
      if (vp.width >= 1000) {
        await page.locator('.site-header .nav a', { hasText: 'Контакты' }).click();
        await expect(page).toHaveURL(/#sec-contacts$/);
      }
    });

    test('вторая страница и 404 сайта', async ({ page }) => {
      expect((await page.goto('/privacy'))?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await noHorizontalScroll(page);
      await axe(page);
      await page.screenshot({ path: `${SHOTS}/privacy-${vp.width}.png`, fullPage: true });
      expect((await page.goto('/no-such-page'))?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText('Страница не найдена');
      await axe(page);
    });

    test('бронь выключена у сайта: формы нет, есть звонок', async ({ page }) => {
      await page.goto(`http://nobooking.localhost:${PORT}/`);
      await expect(page.locator('#pms-booking')).toHaveCount(0);
      await expect(page.getByText('Онлайн-бронирование сейчас недоступно.')).toBeVisible();
      await axe(page);
      await page.screenshot({ path: `${SHOTS}/nobooking-${vp.width}.png`, fullPage: false });
    });
  });
}

test.describe('цена «от» (Q-276)', () => {
  test('в исходном HTML числа нет: место под цену скрыто до ответа API', async ({ request }) => {
    // MKT7: IP-хост Worker отвергает 404 без вопроса к API, поэтому запрос идёт с хостом сайта стенда
    const html = await (await request.get(`http://127.0.0.1:${PORT}/`, { headers: { host: `stepnoy.localhost:${PORT}` } })).text();
    expect(html).toContain('data-from-price="standard-double" hidden');
    expect(html).not.toMatch(/25\s?000/);
  });

  test('ошибка цены: число не показывается, секция цен скрыта, карточки номеров на месте', async ({ page }) => {
    await page.goto(`http://pricefail.localhost:${PORT}/`);
    await expect(page.locator('#sec-rooms h3').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-from-price]:not([hidden])')).toHaveCount(0);
    await expect(page.locator('#sec-pricing')).toBeHidden();
    await expect(page.getByText(/₸/)).toHaveCount(0);
  });
});

test('неизвестный хост: нейтральная 404 без имени сайта', async ({ page }) => {
  const res = await page.goto(`http://127.0.0.2:${PORT}/`).catch(() => null);
  if (res) {
    expect(res.status()).toBe(404);
    await expect(page.getByText('Степной')).toHaveCount(0);
  }
});
