import { expect, test } from '@playwright/test';

/**
 * Страницы по типам объектов (план `plans/direct-sales-pack-2026-09-29.md`, срез D2): на каждой свой заголовок,
 * карточки возможностей, призыв к регистрации и ссылка на главную; с главной на них ведут карточки «Направлений».
 * Текст только из продукта: цифр клиентов и цен нет (DESIGN.md §19.9).
 */
const SEGMENTS = [
  { path: '/for/hostels/', title: /хостел/i, mustHave: /койк/i },
  { path: '/for/mini-hotels/', title: /мини-отел/i, mustHave: /категори/i },
  { path: '/for/apart-hotels/', title: /апарт/i, mustHave: /апартамент/i },
];

for (const segment of SEGMENTS) {
  test(`${segment.path} — заголовок, возможности и призыв`, async ({ page }) => {
    await page.goto(segment.path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(segment.title);
    expect(await page.locator('main').innerText()).toMatch(segment.mustHave);
    expect(await page.locator('main .card').count(), 'карточек возможностей').toBeGreaterThanOrEqual(5);
    await expect(page.locator('main a[data-auth="register"]')).toBeVisible();
    await expect(page.locator('main a[href="/"]')).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text, 'название стороннего сервиса на странице').not.toMatch(/exely|travelline/i);
    expect(text, 'цифры клиентов и цены').not.toMatch(/\d+\s?(клиент|отел[яей]\b)|\d+\s?₸\s*(в месяц|\/ мес)/i);
  });
}

test('карточки направлений на главной ведут на страницы по типам объектов', async ({ page }) => {
  await page.goto('/');
  for (const segment of SEGMENTS) {
    await expect(page.locator(`#audience a[href="${segment.path}"]`)).toHaveCount(1);
  }
});
