import { expect, test } from '@playwright/test';

/**
 * Страницы по типам объектов (план `plans/direct-sales-pack-2026-09-29.md`, срез D2): на каждой свой заголовок,
 * карточки возможностей, призыв к регистрации и ссылка на главную; с главной на них ведут карточки «Направлений».
 * Текст только из продукта: цифр клиентов и цен нет (DESIGN.md §19.9).
 */
const HOTEL = {
  vertical: 'HOSPITALITY',
  secondary: '/calculator/',
  shot: '/screens/calendar-week',
  direction: '/for/hotels/',
};
const BEAUTY = {
  vertical: 'BEAUTY',
  secondary: '/for/salons/',
  shot: '/screens/salon-day',
  direction: '/for/salons/',
};
const FOOD = {
  vertical: 'FOOD_SERVICE',
  secondary: '/for/restaurants/',
  shot: '/screens/restaurant-floor',
  direction: '/for/restaurants/',
};
const SEGMENTS = [
  {
    path: '/for/hostels/',
    title: /хостел/i,
    mustHave: /койк/i,
    photo: '/photos/hostel.jpg',
    ...HOTEL,
  },
  {
    path: '/for/mini-hotels/',
    title: /мини-отел/i,
    mustHave: /категори/i,
    photo: '/photos/minihotel.jpg',
    ...HOTEL,
  },
  {
    path: '/for/apart-hotels/',
    title: /апарт/i,
    mustHave: /апартамент/i,
    photo: '/photos/aparthotel.jpg',
    ...HOTEL,
  },
  {
    path: '/for/beauty-salons/',
    title: /салон красоты/i,
    mustHave: /косметолог/i,
    photo: '/photos/salon.jpg',
    ...BEAUTY,
  },
  {
    path: '/for/barbershops/',
    title: /барбершоп/i,
    mustHave: /барбер/i,
    photo: '/photos/barbershop.jpg',
    ...BEAUTY,
  },
  { path: '/for/spa/', title: /спа/i, mustHave: /процедур/i, photo: '/photos/spa.jpg', ...BEAUTY },
  {
    path: '/for/nail-studios/',
    title: /ногтев/i,
    mustHave: /маникюр/i,
    photo: '/photos/nails.jpg',
    ...BEAUTY,
  },
  { path: '/for/cafes/', title: /кафе/i, mustHave: /техкарт/i, photo: '/photos/cafe.jpg', ...FOOD },
  { path: '/for/bars/', title: /бар/i, mustHave: /коктейл/i, photo: '/photos/bar.jpg', ...FOOD },
];

for (const segment of SEGMENTS) {
  test(`${segment.path} — герой с интерфейсом, возможности, вопросы и призыв своего направления`, async ({
    page,
  }) => {
    await page.goto(segment.path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(segment.title);
    expect(await page.locator('main').innerText()).toMatch(segment.mustHave);
    const hero = page.locator('.hotel-hero');
    await expect(hero.locator('[data-auth="register"]')).toHaveAttribute(
      'href',
      `https://wetop.ai/?vertical=${segment.vertical}#register`,
    );
    // Предпросмотр своего направления: файл отдаётся, данные обозначены как вымышленные
    const photo = hero.locator('img');
    await expect(photo).toHaveAttribute('alt', /вымышленные/);
    const preview =
      segment.vertical === 'HOSPITALITY'
        ? 'hospitality'
        : segment.vertical === 'BEAUTY'
          ? 'beauty'
          : 'restaurant';
    await expect(photo).toHaveAttribute('src', `/design-only/${preview}.svg`);
    await expect(hero.getByText('Источники бронирований', { exact: true })).toHaveCount(0);

    expect((await page.request.get((await photo.getAttribute('src')) ?? '')).status()).toBe(200);
    expect(
      await page.locator('#segment-features .card').count(),
      'карточек возможностей',
    ).toBeGreaterThanOrEqual(5);
    // Настоящий экран продукта своей вертикали: календарь размещений, день салона, план зала
    await expect(page.locator('.hotel-shot img')).toHaveAttribute(
      'src',
      `${segment.shot}-light.png`,
    );
    for (const theme of ['light', 'dark'])
      expect((await page.request.get(`${segment.shot}-${theme}.png`)).status()).toBe(200);
    // Разметка FAQPage для поисковиков
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
      '',
    );
    expect(ld, 'FAQPage в структурированных данных').toContain('"FAQPage"');
    // «Смотрите также»: соседние типы бизнеса и страница направления карточками, без ссылки на себя
    const siblings = SEGMENTS.filter((s) => s.direction === segment.direction && s !== segment);
    for (const sibling of siblings)
      await expect(page.locator(`main .card a[href="${sibling.path}"]`)).toHaveCount(1);
    await expect(page.locator(`main .card a[href="${segment.path}"]`)).toHaveCount(0);
    await expect(page.locator(`main .card a[href="${segment.direction}"]`)).toHaveCount(1);
    await expect(page.locator('.faq details')).toHaveCount(6);
    await expect(page.locator('.cta [data-auth="register"]')).toBeVisible();
    await expect(page.locator(`.cta a[href="${segment.secondary}"]`)).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text, 'название стороннего сервиса на странице').not.toMatch(/exely|travelline/i);
    // Решение владельца 11.10.2026: на сайте не перечисляем, чего в продукте нет
    expect(text, 'строка «чего нет»').not.toMatch(/Пока нет|пока не входят|пока не учитываются/i);
    await expect(page.locator('#segment-day-title')).toHaveText('Как проходит день с WETOP');
    await expect(page.locator('.steps .step')).toHaveCount(3);
    // Фотополоса «о формате»: своё фото подтипа (не общее фото направления) и текст рядом
    const about = page.locator('.landing > .hotel-growth');
    await expect(about.locator('img')).toHaveAttribute('src', segment.photo);
    expect(
      await about.locator('.hotel-growth__text').count(),
      'текст о формате',
    ).toBeGreaterThanOrEqual(2);
    expect((await page.request.get(segment.photo)).status()).toBe(200);
    expect(text, 'цифры клиентов и цены').not.toMatch(
      /\d+\s?(клиент|отел[яей]\b)|\d+\s?₸\s*(в месяц|\/ мес)/i,
    );
    expect(text, '«7 дней» один раз на экран').toMatch(/^(?![\s\S]*7 дней[\s\S]*7 дней)/);
  });
}

test('карточки направлений на главной ведут на страницы по типам объектов', async ({ page }) => {
  await page.goto('/');
  for (const segment of SEGMENTS.filter((s) => s.vertical === 'HOSPITALITY')) {
    await expect(page.locator(`#audience a[href="${segment.path}"]`)).toHaveCount(0);
  }
  // Подвал ведёт на все страницы типов бизнеса и на сами направления (внутренние ссылки)
  const footer = page.locator('.site-footer__directions');
  for (const segment of SEGMENTS)
    await expect(footer.locator(`a[href="${segment.path}"]`)).toHaveCount(1);
  for (const direction of ['/for/hotels/', '/for/salons/', '/for/restaurants/'])
    await expect(footer.locator(`a[href="${direction}"]`)).toHaveCount(1);
});

test('страницы направлений ведут карточками на свои типы бизнеса', async ({ page }) => {
  for (const [direction, types] of [
    ['/for/hotels/', ['/for/hostels/', '/for/mini-hotels/', '/for/apart-hotels/']],
    [
      '/for/salons/',
      ['/for/beauty-salons/', '/for/barbershops/', '/for/spa/', '/for/nail-studios/'],
    ],
    ['/for/restaurants/', ['/for/cafes/', '/for/bars/']],
  ] as const) {
    await page.goto(direction);
    for (const path of types)
      await expect(page.locator(`main .card a[href="${path}"]`)).toHaveCount(1);
  }
});
