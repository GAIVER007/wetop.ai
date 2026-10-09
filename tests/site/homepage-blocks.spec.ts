import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная как ряд понятных блоков (plans/site-home-clear-blocks-2026-10-01.md). Владелец 01.10.2026: «информация
 * непонятная, блоки тоже непонятно какие там есть». Правило страницы: каждый блок виден целиком без вкладок и
 * переключателей, у каждого свой надзаголовок и заголовок, который называет блок словами; порядок блоков фиксирован;
 * меню шапки и карта разделов на первом экране ведут на эти блоки.
 */
const BLOCKS = [
  { id: 'audience', title: /Разный бизнес. Свои инструменты/ },
  { id: 'features', title: /Что умеет WETOP/ },
  // фишка №1 (ADR-142): сразу за возможностями
  { id: 'market', title: /Загрузка конкурентов/ },
  { id: 'sales', title: /Откуда приходят брони/ },
  { id: 'ai-sellers', title: /ИИ-продавец/ },
  { id: 'team', title: /Команда и доступ/ },
  { id: 'start', title: /четыре шага/i },
  { id: 'faq', title: /Вопросы и ответы/ },
];

/** Блоки прежних версий главной: абстрактные лозунги, вкладки и дубли возможностей. Их на странице больше нет. */
const GONE = ['about', 'workflow', 'product-details', 'toolkit', 'control'];

test('главная объясняет платформу и оставляет регистрацию в мобильной шапке', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Управляйте бизнесом из одного окна',
  );
  await expect(page.getByRole('navigation', { name: 'Разделы главной' })).toHaveCount(0);
  await expect(page.locator('.site-header__register')).toBeVisible();
  await expect(page.locator('.mobile-menu__button')).toBeVisible();
});

test('блоки идут в заданном порядке, у каждого надзаголовок и заголовок словами', async ({
  page,
}) => {
  await page.goto('/');
  const ids = await page
    .locator('main section[id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('id')));
  expect(ids.filter((id) => BLOCKS.some((b) => b.id === id))).toEqual(BLOCKS.map((b) => b.id));
  for (const block of BLOCKS) {
    const section = page.locator(`#${block.id}`);
    await expect(
      section.locator('.eyebrow, .public-intro__eyebrow').first(),
      `надзаголовок #${block.id}`,
    ).toBeVisible();
    await expect(
      section.getByRole('heading', { level: 2 }),
      `заголовок #${block.id}`,
    ).toContainText(block.title);
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
  await expect(page.locator('#faq details')).toHaveCount(6);
  await expect(page.locator('#faq details summary').first()).toBeVisible();
});

/**
 * 02.10.2026, поручение владельца «сделай максимально понятной и удобной». Страницу нельзя было просмотреть:
 * в каждой карточке лежал абзац в три-пять строк, двадцать одинаковых прямоугольников подряд, а две кнопки
 * первого экрана не помещались в колонку и вставали в столбик разной ширины. Эти три проверки держат правку.
 */
test('первый экран: две кнопки в строку, направления сразу после Hero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const tops = await page
    .locator('.public-intro__actions a')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(tops).toHaveLength(2);
  expect(tops[0]).toBe(tops[1]);
  const ids = await page.locator('main section').evaluateAll((els) => els.map((el) => el.id));
  expect(ids.slice(0, 2)).toEqual(['product', 'audience']);
  await expect(page.locator('.facts')).toHaveCount(0);
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

test('первый экран: Today подписан примером и не имитирует кнопки', async ({ page }) => {
  await page.goto('/');
  const preview = page.locator('.today-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Сегодня');
  await expect(preview.locator('a, button, [role="button"]')).toHaveCount(0);
  await expect(page.locator('.public-intro__figure')).toContainText(
    'Пример интерфейса. Данные вымышленные.',
  );
});

/**
 * 03.10.2026, решение владельца: внутренней дорожной карты на странице нет. «Направления», «Первое направление:
 * Hospitality», «Следующее направление» и «подключить его пока нельзя» говорили посетителю, что продукт недоделан,
 * а салону, что ему сюда нельзя. Салоны теперь зовут словами, но без обещания функций, которых в системе нет.
 */
test('на главной нет дорожной карты направлений', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  for (const word of ['Первое направление', 'Следующее направление', 'пока нельзя']) {
    expect(text, `слово дорожной карты на главной: ${word}`).not.toContain(word);
  }
});

test('пилоты обозначены явно, ведут на configured email и существующий AuthDialog', async ({
  page,
}) => {
  await page.goto('/');
  const cards = page.locator('.verticals__card');
  await expect(cards).toHaveCount(3);
  for (const card of [cards.nth(1), cards.nth(2)]) {
    await expect(card).not.toContainText(/пилот/i);
    await expect(card.locator('a[href^="mailto:"]')).toHaveCount(1);
    await expect(card.locator('[data-auth="register"]')).toHaveCount(1);
    await expect(card.locator('.verticals__capabilities li')).toHaveCount(6);
  }
  await expect(cards.nth(1)).not.toContainText(/финанс|эквайринг/i);
  await expect(cards.nth(2)).not.toContainText(/POS|кухня|доставка|депозит/i);
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
  const hrefs = await nav
    .getByRole('link')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toEqual(['/#product', '/#audience', '/#features', '/#ai-sellers', '/#start']);
});

test('в текстах главной нет длинного тире и разделителя « · »', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  expect(text, 'длинное тире в тексте главной (AGENTS.md §19)').not.toContain('—');
  expect(text).not.toContain(' · ');
});

for (const width of [320, 390, 768, 1440]) {
  test(`главная помещается в ${width} px и открывает регистрацию с первого экрана`, async ({
    page,
  }) => {
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
    await page.locator('.public-intro__actions a[href="#audience"]').click();
    await expect(page.locator('#audience')).toBeInViewport();
    await page.locator('.public-intro [data-auth="register"]').click();
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

test('FAQ раскрывается без JavaScript-вкладок, переключатель темы запоминает выбор', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByText('Можно продавать номера и отдельные койки?', { exact: true }).click();
  await expect(page.locator('#faq details[open]')).toContainText('отдельные единицы');
});

test('«Загрузка конкурентов»: четыре пункта, пример помечен примером, кнопка ведёт в раздел стойки, сбор ИИ не обещан готовым', async ({
  page,
}) => {
  await page.goto('/');
  const block = page.locator('#market');
  await expect(block.locator('.seller-details__steps > li')).toHaveCount(4);
  await expect(block.getByRole('complementary')).toContainText('Пример');
  await expect(block.getByRole('link', { name: /Открыть раздел/ })).toHaveAttribute(
    'href',
    /\/market$/,
  );
  await expect(block).toContainText(/готовим/);
  const axe = await new AxeBuilder({ page }).include('#market').analyze();
  expect(axe.violations).toEqual([]);
});
