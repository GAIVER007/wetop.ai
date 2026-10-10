import { expect, test } from '@playwright/test';

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
  // разделы: возможности (9), мини-экраны (8), отчёты, ИИ, шаги и вопросы
  expect(await page.locator('#restaurant-features .card').count()).toBeGreaterThanOrEqual(9);
  await expect(page.getByRole('heading', { name: /как wetop решает/i })).toBeVisible();
  expect(await page.locator('.dash__arrivals--card').count()).toBeGreaterThanOrEqual(8);
  await expect(page.getByRole('heading', { name: /что покажут отчёты/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /технологии на вашей стороне/i })).toBeVisible();
  expect(await page.locator('.steps .step').count()).toBe(4);
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

test('с главной на /restaurants/ ведёт карточка ресторанного направления', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#audience a[href="/restaurants/"]')).toHaveCount(1);
});
