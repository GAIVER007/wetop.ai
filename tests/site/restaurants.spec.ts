import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * «Для ресторанов» (/restaurants/, макет владельца 10.10.2026): hero с ресторанным дашбордом-мокапом,
 * разделы продукта, мини-экраны, шаги, вопросы и призыв. Текст только из продукта (§19.9):
 * цифр клиентов, цен и обещаний результата нет; вымышленные числа мокапов подписаны.
 */
test('/restaurants/ — hero, мокап с планом зала, разделы и призыв', async ({ page }) => {
  await page.goto('/restaurants/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/рестораном/i);
  // дашборд-мокап: ресторанное меню, план зала с четырьмя статусами, текущие заказы, подпись примера
  const dash = page.locator('.dash--restaurant');
  await expect(dash).toBeVisible();
  await expect(dash).toContainText('План зала');
  await expect(dash).toContainText('Текущие заказы');
  for (const kind of ['free', 'busy', 'reserved', 'cleaning'])
    expect(await dash.locator(`.dash__table[data-kind="${kind}"]`).count()).toBeGreaterThan(0);
  await expect(page.locator('.public-intro__figure figcaption')).toContainText(/вымышленные/i);
  // сцена макета: ноутбук с дашбордом, телефон, рукописные пометки, чипы и полоса показателей
  await expect(page.locator('.restl__laptop .dash--restaurant')).toBeVisible();
  expect(await page.locator('.restl__phone').count()).toBe(1);
  expect(await page.locator('.restl__chips li').count()).toBe(3);
  expect(await page.locator('.restl__band li').count()).toBe(4);
  // разделы: процессы (9), мини-экраны (8), «больше, чем просто программа» (6), отчёты (4), ИИ (4), шаги и вопросы
  expect(await page.locator('.restl__processes .card').count()).toBe(9);
  await expect(page.getByRole('heading', { name: /реальные задачи ресторана/i })).toBeVisible();
  expect(await page.locator('.restl__shot').count()).toBe(8);
  expect(await page.locator('.restl__more li').count()).toBe(6);
  expect(await page.locator('.restl__results .card').count()).toBe(4);
  await expect(page.getByRole('heading', { name: /технологии на вашей стороне/i })).toBeVisible();
  expect(await page.locator('.restl__steps li').count()).toBe(4);
  expect(await page.locator('.faq__list details').count()).toBeGreaterThanOrEqual(4);
  // регистрация с предвыбранным направлением и дорога домой
  const register = page.locator('a[data-auth="register"][href*="FOOD_SERVICE"]');
  expect(await register.count()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('main a[href="/"]').last()).toBeVisible();
  // §19.9 и ADR-147: ни чисел клиентов, ни цен, ни обещаний trial
  const text = await page.locator('body').innerText();
  expect(text, 'цифры клиентов и цены').not.toMatch(
    /\d+\s?\+?\s?(ресторан[овая]*|клиент)|₸\s*(в месяц|\/ мес)/i,
  );
  expect(text, 'обещания trial').not.toMatch(/14 дней|без привязки карты|карта не нужна/i);
  expect(text, 'слово «пилот»').not.toMatch(/пилот/i);
});

for (const theme of ['light', 'dark'] as const)
  test(`/restaurants/ доступна в теме ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('wetop-theme', value), theme);
    await page.goto('/restaurants/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      );
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

test('с главной на /restaurants/ ведёт карточка ресторанного направления', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#audience a[href="/restaurants/"]')).toHaveCount(1);
});
