import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная как ряд понятных блоков (plans/site-home-clear-blocks-2026-10-01.md). Владелец 01.10.2026: «информация
 * непонятная, блоки тоже непонятно какие там есть». Правило страницы: каждый блок виден целиком без вкладок и
 * переключателей, у каждого свой надзаголовок и заголовок, который называет блок словами; порядок блоков фиксирован;
 * меню шапки и карта разделов на первом экране ведут на эти блоки.
 */
const BLOCKS = [
  { id: 'audience', title: /Отели, хостелы и апартаменты/ },
  { id: 'features', title: /Что умеет WETOP/ },
  { id: 'sales', title: /Откуда приходят брони/ },
  { id: 'ai-sellers', title: /ИИ-продавец/ },
  { id: 'team', title: /Команда и доступ/ },
  { id: 'start', title: /четыре шага/i },
  { id: 'faq', title: /Вопросы и ответы/ },
];

/** Блоки прежних версий главной: абстрактные лозунги, вкладки и дубли возможностей. Их на странице больше нет. */
const GONE = ['about', 'workflow', 'product-details', 'toolkit', 'control'];

test('блоки идут в заданном порядке, у каждого надзаголовок и заголовок словами', async ({ page }) => {
  await page.goto('/');
  const ids = await page
    .locator('main section[id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('id')));
  expect(ids.filter((id) => BLOCKS.some((b) => b.id === id))).toEqual(BLOCKS.map((b) => b.id));
  for (const block of BLOCKS) {
    const section = page.locator(`#${block.id}`);
    await expect(section.locator('.eyebrow').first(), `надзаголовок #${block.id}`).toBeVisible();
    await expect(section.getByRole('heading', { level: 2 }), `заголовок #${block.id}`).toContainText(
      block.title,
    );
  }
  for (const id of GONE) {
    await expect(page.locator(`#${id}`), `старый блок #${id}`).toHaveCount(0);
  }
});

test('содержимое блоков видно сразу: без вкладок, восемь возможностей, четыре входа броней, три карточки команды', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('main [role="tablist"]')).toHaveCount(0);
  const features = page.locator('#features .card');
  await expect(features).toHaveCount(8);
  for (const card of await features.all()) await expect(card).toBeVisible();
  await expect(page.locator('#features')).toContainText(/Шахматка/);
  await expect(page.locator('#features')).toContainText(/Каналы продаж/);
  await expect(page.locator('#features')).toContainText(/Счета и оплаты/);
  await expect(page.locator('#sales .card')).toHaveCount(5); // четыре входа и карточка с калькулятором
  await expect(page.locator('#sales a[href="/calculator/"]')).toBeVisible();
  await expect(page.locator('#team .card')).toHaveCount(3);
  await expect(page.locator('#ai-sellers')).toContainText(/отдельное расширение/i);
  await expect(page.locator('#faq details')).toHaveCount(7);
  await expect(page.locator('#faq details summary').first()).toBeVisible();
});

/**
 * 02.10.2026, поручение владельца «сделай максимально понятной и удобной». Страницу нельзя было просмотреть:
 * в каждой карточке лежал абзац в три-пять строк, двадцать одинаковых прямоугольников подряд, а две кнопки
 * первого экрана не помещались в колонку и вставали в столбик разной ширины. Эти три проверки держат правку.
 */
test('первый экран: две кнопки стоят в одну строку, факты уехали в полосу под ним', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const tops = await page
    .locator('.hero .hero__actions a')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(tops.length, 'кнопок на первом экране две').toBe(2);
  expect(tops[0], 'кнопки первого экрана встали в столбик').toBe(tops[1]);
  // три факта под чертой ушли с первого экрана: он и без них в семь уровней
  await expect(page.locator('.hero .hero__points')).toHaveCount(0);

  // полоса фактов сразу под первым экраном: четыре коротких ответа «что это даёт»
  const facts = page.locator('.facts__item');
  await expect(facts).toHaveCount(4);
  for (const fact of await facts.all()) {
    await expect(fact.getByRole('heading', { level: 2 })).toBeVisible();
    expect((await fact.innerText()).length, 'факт должен читаться одним взглядом').toBeLessThan(120);
  }
  const order = await page
    .locator('main section')
    .evaluateAll((els) => els.map((el) => el.className));
  expect(order.findIndex((c) => c.includes('facts')), 'полоса фактов идёт сразу за первым экраном').toBe(1);
});

test('карточки блоков читаются одной фразой, а не абзацем', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const long: string[] = [];
  for (const block of ['#features', '#sales', '#team', '#audience']) {
    for (const text of await page.locator(`${block} .card__text`).allInnerTexts()) {
      if (text.length > 108) long.push(`${block}: ${text.length} знаков: ${text.slice(0, 40)}`);
    }
  }
  expect(long, 'текст карточки длиннее одной фразы').toEqual([]);
  // «Что умеет WETOP»: восемь строк-пунктов в две колонки вместо восьми карточек-колонок
  await expect(page.locator('#features .card-grid--2')).toBeVisible();
  await expect(page.locator('#features .card--compact')).toHaveCount(8);
  const titles = await page.locator('#features .card__title').allInnerTexts();
  expect(titles, 'заголовок карточки в две строки').not.toContain('Аналитика и финансы за период');
});

test('ссылка в карточке «Продаж» — пилюля по тексту, а не плашка во всю карточку в две строки', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const link = page.locator('#sales .card > .link-arrow');
  await expect(link).toHaveCount(1);
  const card = page.locator('#sales .card', { has: page.locator('> .link-arrow') });
  const linkBox = (await link.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(Math.round(linkBox.height), 'ссылка переносится на вторую строку').toBeLessThan(48);
  expect(
    Math.round(linkBox.width),
    'ссылка растянута во всю ширину карточки, а не по тексту',
  ).toBeLessThan(Math.round(cardBox.width) - 48);
});

test('первый экран: карта разделов ведёт на блоки страницы', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const map = page.locator('.hero .product-map');
  await expect(map).toBeVisible();
  const tiles = map.getByRole('link');
  await expect(tiles).toHaveCount(6);
  for (const word of ['Операции', 'Продажи', 'Команда', 'Финансы', 'Аналитика', 'ИИ-продавцы']) {
    await expect(map).toContainText(word);
  }
  const hrefs = await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  for (const href of hrefs) expect(['#features', '#sales', '#team', '#ai-sellers']).toContain(href);
  await expect(map.locator('.vertical-status')).toHaveCount(0);
  await expect(page.locator('.hero')).toContainText(/Схема разделов/);
  await tiles.filter({ hasText: 'Продажи' }).click();
  await expect(page.locator('#sales')).toBeInViewport();
});

/**
 * 03.10.2026, решение владельца: внутренней дорожной карты на странице нет. «Направления», «Первое направление:
 * Hospitality», «Следующее направление» и «подключить его пока нельзя» говорили посетителю, что продукт недоделан,
 * а салону, что ему сюда нельзя. Салоны теперь зовут словами, но без обещания функций, которых в системе нет.
 */
test('на главной нет дорожной карты направлений', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  for (const word of [
    'Первое направление',
    'Следующее направление',
    'Hospitality',
    'Beauty',
    'пока нельзя',
  ]) {
    expect(text, `слово дорожной карты на главной: ${word}`).not.toContain(word);
  }
});

test('салоны и студии названы среди тех, кого подключаем, со ссылкой написать', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const invite = page.locator('#audience .invite');
  await expect(invite).toBeVisible();
  await expect(invite).toContainText(/Салоны и студии/);
  await expect(invite).toContainText(/подключаем/i);
  // приглашение ведёт на почту из site.config.ts, а не на регистрацию: салонных функций в системе ещё нет
  await expect(invite.locator('a[href^="mailto:"]')).toHaveCount(1);
  await expect(invite.locator('[data-auth="register"]')).toHaveCount(0);
  // записи, мастера и расписание услуг не обещаются (DESIGN.md §19.9)
  const text = await page.locator('main').innerText();
  for (const word of ['журнал записи', 'мастеров', 'онлайн-запись']) {
    expect(text, `обещание салонной функции: ${word}`).not.toContain(word);
  }
});

/**
 * У стеклянной второй кнопки кромка белая: на стекле это блик, а на сплошной панели главной (ADR-132)
 * она исчезает, и кнопка читается как обычный текст. Поймано на приглашении салонам 03.10.2026.
 */
test('на сплошной главной кромка второй кнопки видна, а не белая по белому', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const borders = await page
    .locator('main .btn--secondary')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderColor));
  expect(borders.length, 'вторых кнопок на главной нет').toBeGreaterThan(0);
  for (const color of borders) {
    expect(color, 'белая кромка на белой панели').not.toMatch(/^rgba?\(255,\s*255,\s*255/);
  }
});

test('меню шапки ведёт на блоки, а не на абстрактные разделы', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });
  const hrefs = await nav.getByRole('link').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toEqual(['/#audience', '/#features', '/#sales', '/#start']);
});

test('в текстах главной нет длинного тире и разделителя « · »', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  expect(text, 'длинное тире в тексте главной (AGENTS.md §19)').not.toContain('—');
  expect(text).not.toContain(' · ');
});

for (const width of [320, 390, 768, 1440]) {
  test(`главная помещается в ${width} px и открывает регистрацию с первого экрана`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(
      Number(
        await page.evaluate(
          'document.documentElement.scrollWidth - document.documentElement.clientWidth',
        ),
      ),
    ).toBeLessThanOrEqual(1);
    // кнопка «Смотреть возможности»: плитки карты разделов ведут на тот же блок, но это другие ссылки
    await page.locator('.hero .hero__actions a[href="#features"]').click();
    await expect(page.locator('#features')).toBeInViewport();
    await page.locator('.hero [data-auth="register"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('блоки доступны в обеих темах', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.length}`),
      colorScheme,
    ).toEqual([]);
  }
});

test('FAQ раскрывается без JavaScript-вкладок, переключатель темы запоминает выбор', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByText('Можно продавать номера и отдельные койки?', { exact: true }).click();
  await expect(page.locator('#faq details[open]')).toContainText('отдельные единицы');
});
