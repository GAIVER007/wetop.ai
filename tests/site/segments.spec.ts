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
  test(`${segment.path} — герой с фото, возможности, календарь, вопросы и призыв`, async ({ page }) => {
    await page.goto(segment.path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(segment.title);
    expect(await page.locator('main').innerText()).toMatch(segment.mustHave);
    const hero = page.locator('.hotel-hero');
    await expect(hero.locator('[data-auth="register"]')).toHaveAttribute(
      'href',
      'https://wetop.ai/?vertical=HOSPITALITY#register',
    );
    // Своё цветное фото (KIE), не сток: файл отдаётся, у картинки описание
    const photo = hero.locator('img');
    await expect(photo).toHaveAttribute('alt', /.+/);
    expect((await page.request.get((await photo.getAttribute('src')) ?? '')).status()).toBe(200);
    expect(
      await page.locator('#segment-features .card').count(),
      'карточек возможностей',
    ).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.hotel-shot img')).toHaveAttribute('src', '/screens/calendar-week-light.png');
    await expect(page.locator('.faq details')).toHaveCount(4);
    await expect(page.locator('.cta [data-auth="register"]')).toBeVisible();
    await expect(page.locator('.cta a[href="/calculator/"]')).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text, 'название стороннего сервиса на странице').not.toMatch(/exely|travelline/i);
    expect(text, 'цифры клиентов и цены').not.toMatch(/\d+\s?(клиент|отел[яей]\b)|\d+\s?₸\s*(в месяц|\/ мес)/i);
    expect(text, '«7 дней» один раз на экран').toMatch(/^(?![\s\S]*7 дней[\s\S]*7 дней)/);
  });
}

test('карточки направлений на главной ведут на страницы по типам объектов', async ({ page }) => {
  await page.goto('/');
  for (const segment of SEGMENTS) {
    await expect(page.locator(`#audience a[href="${segment.path}"]`)).toHaveCount(1);
  }
});
