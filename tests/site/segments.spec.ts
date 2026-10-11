import { expect, test } from '@playwright/test';

/**
 * Страницы по типам объектов (план `plans/direct-sales-pack-2026-09-29.md`, срез D2): на каждой свой заголовок,
 * карточки возможностей, призыв к регистрации и ссылка на главную; с главной на них ведут карточки «Направлений».
 * Текст только из продукта: цифр клиентов и цен нет (DESIGN.md §19.9).
 */
const HOTEL = { vertical: 'HOSPITALITY', secondary: '/calculator/', calendar: true };
const BEAUTY = { vertical: 'BEAUTY', secondary: '/for/salons/', calendar: false };
const FOOD = { vertical: 'FOOD_SERVICE', secondary: '/for/restaurants/', calendar: false };
const SEGMENTS = [
  { path: '/for/hostels/', title: /хостел/i, mustHave: /койк/i, ...HOTEL },
  { path: '/for/mini-hotels/', title: /мини-отел/i, mustHave: /категори/i, ...HOTEL },
  { path: '/for/apart-hotels/', title: /апарт/i, mustHave: /апартамент/i, ...HOTEL },
  { path: '/for/barbershops/', title: /барбершоп/i, mustHave: /барбер/i, ...BEAUTY },
  { path: '/for/spa/', title: /спа/i, mustHave: /процедур/i, ...BEAUTY },
  { path: '/for/nail-studios/', title: /ногтев/i, mustHave: /маникюр/i, ...BEAUTY },
  { path: '/for/cafes/', title: /кафе/i, mustHave: /техкарт/i, ...FOOD },
  { path: '/for/bars/', title: /бар/i, mustHave: /коктейл/i, ...FOOD },
];

for (const segment of SEGMENTS) {
  test(`${segment.path} — герой с фото, возможности, вопросы и призыв своего направления`, async ({ page }) => {
    await page.goto(segment.path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(segment.title);
    expect(await page.locator('main').innerText()).toMatch(segment.mustHave);
    const hero = page.locator('.hotel-hero');
    await expect(hero.locator('[data-auth="register"]')).toHaveAttribute(
      'href',
      `https://wetop.ai/?vertical=${segment.vertical}#register`,
    );
    // Своё цветное фото (KIE), не сток: файл отдаётся, у картинки описание
    const photo = hero.locator('img');
    await expect(photo).toHaveAttribute('alt', /.+/);
    expect((await page.request.get((await photo.getAttribute('src')) ?? '')).status()).toBe(200);
    expect(
      await page.locator('#segment-features .card').count(),
      'карточек возможностей',
    ).toBeGreaterThanOrEqual(5);
    // Экран календаря размещений есть только у гостиниц: у салона и ресторана другой продукт
    if (segment.calendar)
      await expect(page.locator('.hotel-shot img')).toHaveAttribute('src', '/screens/calendar-week-light.png');
    else await expect(page.locator('.hotel-shot')).toHaveCount(0);
    await expect(page.locator('.faq details')).toHaveCount(4);
    await expect(page.locator('.cta [data-auth="register"]')).toBeVisible();
    await expect(page.locator(`.cta a[href="${segment.secondary}"]`)).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text, 'название стороннего сервиса на странице').not.toMatch(/exely|travelline/i);
    expect(text, 'цифры клиентов и цены').not.toMatch(/\d+\s?(клиент|отел[яей]\b)|\d+\s?₸\s*(в месяц|\/ мес)/i);
    expect(text, '«7 дней» один раз на экран').toMatch(/^(?![\s\S]*7 дней[\s\S]*7 дней)/);
  });
}

test('карточки направлений на главной ведут на страницы по типам объектов', async ({ page }) => {
  await page.goto('/');
  for (const segment of SEGMENTS.filter((s) => s.vertical === 'HOSPITALITY')) {
    await expect(page.locator(`#audience a[href="${segment.path}"]`)).toHaveCount(1);
  }
  // Подвал ведёт на все страницы типов бизнеса и на сами направления (внутренние ссылки)
  const footer = page.locator('.site-footer__directions');
  for (const segment of SEGMENTS) await expect(footer.locator(`a[href="${segment.path}"]`)).toHaveCount(1);
  for (const direction of ['/for/hotels/', '/for/salons/', '/for/restaurants/'])
    await expect(footer.locator(`a[href="${direction}"]`)).toHaveCount(1);
});

test('страницы направлений ведут карточками на свои типы бизнеса', async ({ page }) => {
  for (const [direction, types] of [
    ['/for/hotels/', ['/for/hostels/', '/for/mini-hotels/', '/for/apart-hotels/']],
    ['/for/salons/', ['/for/barbershops/', '/for/spa/', '/for/nail-studios/']],
    ['/for/restaurants/', ['/for/cafes/', '/for/bars/']],
  ] as const) {
    await page.goto(direction);
    for (const path of types) await expect(page.locator(`main .card a[href="${path}"]`)).toHaveCount(1);
  }
});
