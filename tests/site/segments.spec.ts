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
    path: '/for/guest-houses/',
    title: /гостев/i,
    mustHave: /гостевого дома/i,
    photo: '/photos/guest-houses.jpg',
    ...HOTEL,
  },
  {
    path: '/for/resorts/',
    title: /баз(а|ы) отдыха/i,
    mustHave: /домик/i,
    photo: '/photos/resorts.jpg',
    ...HOTEL,
  },
  {
    path: '/for/daily-rentals/',
    title: /посуточно/i,
    mustHave: /квартир/i,
    photo: '/photos/daily-rentals.jpg',
    ...HOTEL,
  },
  {
    path: '/for/glamping/',
    title: /глэмпинг/i,
    mustHave: /купол|шатр/i,
    photo: '/photos/glamping.jpg',
    ...HOTEL,
  },
  {
    path: '/for/sanatoriums/',
    title: /санатори/i,
    mustHave: /заезд/i,
    photo: '/photos/sanatoriums.jpg',
    ...HOTEL,
  },
  {
    path: '/for/capsule-hotels/',
    title: /капсульн/i,
    mustHave: /капсул/i,
    photo: '/photos/capsule-hotels.jpg',
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
  {
    path: '/for/hair-salons/',
    title: /парикмахерск/i,
    mustHave: /окрашивани/i,
    photo: '/photos/hair-salons.jpg',
    ...BEAUTY,
  },
  {
    path: '/for/massage/',
    title: /массаж/i,
    mustHave: /кушетк/i,
    photo: '/photos/massage.jpg',
    ...BEAUTY,
  },
  {
    path: '/for/cosmetology/',
    title: /косметологи/i,
    mustHave: /пилинг/i,
    photo: '/photos/cosmetology.jpg',
    ...BEAUTY,
  },
  {
    path: '/for/brows-lashes/',
    title: /брови/i,
    mustHave: /ресниц/i,
    photo: '/photos/brows-lashes.jpg',
    ...BEAUTY,
  },
  {
    path: '/for/epilation/',
    title: /эпиляци/i,
    mustHave: /лазерн/i,
    photo: '/photos/epilation.jpg',
    ...BEAUTY,
  },
  {
    path: '/for/tattoo/',
    title: /тату/i,
    mustHave: /пирсинг/i,
    photo: '/photos/tattoo.jpg',
    ...BEAUTY,
  },
  { path: '/for/cafes/', title: /кафе/i, mustHave: /техкарт/i, photo: '/photos/cafe.jpg', ...FOOD },
  { path: '/for/bars/', title: /бар/i, mustHave: /коктейл/i, photo: '/photos/bar.jpg', ...FOOD },
  {
    path: '/for/coffee-shops/',
    title: /кофейн/i,
    mustHave: /бариста/i,
    photo: '/photos/coffee-shops.jpg',
    ...FOOD,
  },
  {
    path: '/for/hookah-lounges/',
    title: /кальянн/i,
    mustHave: /лаунж/i,
    photo: '/photos/hookah-lounges.jpg',
    ...FOOD,
  },
  {
    path: '/for/karaoke/',
    title: /караоке/i,
    mustHave: /комнат/i,
    photo: '/photos/karaoke.jpg',
    ...FOOD,
  },
  {
    path: '/for/pizzerias/',
    title: /пиццери/i,
    mustHave: /печ/i,
    photo: '/photos/pizzerias.jpg',
    ...FOOD,
  },
  {
    path: '/for/canteens/',
    title: /столов/i,
    mustHave: /раздач/i,
    photo: '/photos/canteens.jpg',
    ...FOOD,
  },
  {
    path: '/for/banquet-halls/',
    title: /банкетн/i,
    mustHave: /мероприяти/i,
    photo: '/photos/banquet-halls.jpg',
    ...FOOD,
  },
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
    // Четыре салонных типа: тот же рисунок со своими подписями услуг (маршрут previews), остальные общий
    const own: Record<string, string> = {
      '/for/barbershops/': '/previews/barbershops.svg',
      '/for/spa/': '/previews/spa.svg',
      '/for/nail-studios/': '/previews/nail-studios.svg',
      '/for/massage/': '/previews/massage.svg',
    };
    const preview =
      own[segment.path] ??
      `/design-only/${
        segment.vertical === 'HOSPITALITY'
          ? 'hospitality'
          : segment.vertical === 'BEAUTY'
            ? 'beauty'
            : 'restaurant'
      }.svg`;
    await expect(photo).toHaveAttribute('src', preview);
    await expect(hero.getByText('Источники бронирований', { exact: true })).toHaveCount(0);

    expect((await page.request.get((await photo.getAttribute('src')) ?? '')).status()).toBe(200);
    // Сетка возможностей 3 в ряд: карточек не меньше шести, чтобы ряды были полными
    expect(
      await page.locator('#segment-features .card').count(),
      'карточек возможностей',
    ).toBeGreaterThanOrEqual(6);
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
    // «Смотрите также»: карточка направления и три соседних типа по кругу, без ссылки на себя
    const dirKey = segment.direction.split('/')[2];
    const also = page.locator(`section[aria-labelledby="${dirKey}-types-title"]`);
    await expect(also.locator('.card a')).toHaveCount(4);
    await expect(also.locator(`a[href="${segment.path}"]`)).toHaveCount(0);
    await expect(also.locator(`a[href="${segment.direction}"]`)).toHaveCount(1);
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
    // Срок и условия пробного доступа сайт не печатает, пока их не решит владелец (ADR-147)
    expect(text, 'условия trial').not.toMatch(
      /\d+\s?дн(ей|я)\s+бесплатно|карта не нужна|без карты/i,
    );
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
  for (const direction of ['/for/hotels/', '/for/salons/', '/for/restaurants/'] as const) {
    const types = SEGMENTS.filter((s) => s.direction === direction).map((s) => s.path);
    await page.goto(direction);
    for (const path of types)
      await expect(page.locator(`main .card a[href="${path}"]`)).toHaveCount(1);
  }
});

test('страница типа не копирует набор карточек соседней страницы целиком', async ({ page }) => {
  // 16.10.2026: салон, барбершоп, спа и ногтевая студия (и кафе с баром) показывали одни и те же шесть карточек.
  // Общая карточка про филиалы или команду допустима; дефект это набор, совпадающий с другой страницей почти весь.
  const sets = new Map<string, string[]>();
  for (const segment of SEGMENTS) {
    await page.goto(segment.path);
    sets.set(segment.path, await page.locator('#segment-features .card__text').allTextContents());
  }
  const problems: string[] = [];
  const paths = [...sets.keys()];
  paths.forEach((a, i) =>
    paths.slice(i + 1).forEach((b) => {
      const own = sets.get(a)!;
      const shared = own.filter((card) => sets.get(b)!.includes(card)).length;
      if (shared > own.length / 2)
        problems.push(`${a} и ${b}: общих карточек ${shared} из ${own.length}`);
    }),
  );
  expect(problems).toEqual([]);
});

test('салонные страницы не обещают процедурные кабинеты и курсы, которых нет в модели записи', async ({
  page,
}) => {
  // Запись в продукте: клиент, мастер, услуга, время (DATA_MODEL, Appointment): учёта кабинетов, курсов и
  // абонементов нет. Ловим именно эти обещания; «личный кабинет» или фото кабинета дефектом не считаются.
  const paths = [
    ...SEGMENTS.filter((s) => s.vertical === 'BEAUTY').map((s) => s.path),
    '/blog/kak-vesti-zapisi-v-spa/',
    '/blog/kak-vesti-zapisi-massazhnogo-salona/',
    '/blog/kak-vesti-zapisi-v-kosmetologii/',
    '/blog/kak-vesti-zapisi-studii-epilyacii/',
  ];
  const promises =
    /календар\S* кабинет|загрузк\S* кабинет|кабинет\S* (занят|не пересека)|держит кабинет|кабинеты и филиалы|графики и кабинеты|курс\S* (процедур|визитов)|курс из (десяти|\d+)|сеансы и курсы|абонемент/i;
  for (const path of paths) {
    await page.goto(path);
    const text = (await page.locator('main').innerText()) + (await page.title());
    expect(text, path).not.toMatch(promises);
  }
});

test('рисунки первого экрана с подписями типа: подписи помещаются в свои блоки', async ({
  page,
}) => {
  for (const slug of ['spa', 'barbershops', 'nail-studios', 'massage']) {
    await page.goto(`/previews/${slug}.svg`);
    // Каждый текст сверяется с самым маленьким прямоугольником, в котором начинается
    const overflow = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('rect')].map((r) => r.getBBox());
      return [...document.querySelectorAll('text')].flatMap((t) => {
        const box = t.getBBox();
        const home = rects
          .filter(
            (r) =>
              box.x >= r.x && box.x <= r.x + r.width && box.y >= r.y && box.y <= r.y + r.height,
          )
          .sort((a, b) => a.width * a.height - b.width * b.height)[0];
        return home && box.x + box.width > home.x + home.width ? [t.textContent] : [];
      });
    });
    expect(overflow, slug).toEqual([]);
  }
});
