import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная после LAND2 (09.10.2026, ТЗ владельца «PUBLIC LANDING REDESIGN»): семь смысловых секций,
 * каждая видна целиком без вкладок, у каждой надзаголовок и заголовок словами, порядок фиксирован.
 * Прежние три секции о продажах (Market, Sales, AiSellers) слиты в одну «Продажи и ИИ»; слова «пилот»
 * на странице нет (решение владельца 09.10.2026), статусы модулей словами по фактической готовности.
 */
const BLOCKS = [
  { id: 'audience', title: /Разный бизнес. Свои инструменты/ },
  { id: 'features', title: /Всё для ежедневной работы/ },
  { id: 'sales', title: /Больше возможностей для роста/ },
  { id: 'team', title: /Работайте вместе/ },
  { id: 'start', title: /Начните работать с WETOP/ },
  { id: 'faq', title: /Частые вопросы/ },
];

/** Секции прежних версий главной: их на странице больше нет (слиты или удалены). */
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
  // Старые якоря #market и #ai-sellers живут на модулях «Продаж и ИИ», старые ссылки не ломаются.
  await expect(page.locator('#sales #ai-sellers')).toHaveCount(1);
  await expect(page.locator('#sales #market')).toHaveCount(1);
});

test('содержимое блоков видно сразу: шесть возможностей, три модуля роста, три пункта команды', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('main [role="tablist"]')).toHaveCount(0);
  const features = page.locator('#features .card');
  await expect(features).toHaveCount(6);
  for (const card of await features.all()) await expect(card).toBeVisible();
  await expect(page.locator('#features')).toContainText(/Календарь и бронирования/);
  await expect(page.locator('#features')).toContainText(/Финансы/);
  await expect(page.locator('#features')).toContainText(/Аналитика/);
  await expect(page.locator('#sales .growth__modules > .card')).toHaveCount(3);
  await expect(page.locator('#sales a[href="/calculator/"]')).toBeVisible();
  await expect(page.locator('#team .team__item')).toHaveCount(3);
  await expect(page.locator('#team .team__roster li')).toHaveCount(3);
  await expect(page.locator('#faq details')).toHaveCount(5);
  await expect(page.locator('#faq details summary').first()).toBeVisible();
});

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
  for (const block of ['#features', '#team', '#audience']) {
    for (const text of await page.locator(`${block} .card__text`).allInnerTexts()) {
      if (text.length > 108) long.push(`${block}: ${text.length} знаков: ${text.slice(0, 40)}`);
    }
  }
  expect(long, 'текст карточки длиннее одной фразы').toEqual([]);
  // «Возможности»: сетка 3×2 на компьютере, компактные карточки
  await expect(page.locator('#features .card-grid--3')).toBeVisible();
  await expect(page.locator('#features .card--compact')).toHaveCount(6);
});

test('модули «Продаж и ИИ»: статус словами, без слова «пилот» и обещаний готовности', async ({
  page,
}) => {
  await page.goto('/');
  const modules = page.locator('#sales .growth__modules > .card');
  await expect(modules).toHaveCount(3);
  const statuses = await page.locator('#sales .growth__status').allInnerTexts();
  expect(statuses).toEqual(['Доступно', 'Отдельное подключение', 'Доступно']);
  await expect(page.locator('#sales')).toContainText(/готовим/);
  await expect(page.locator('#sales')).not.toContainText(/пилот|в разработке скоро/i);
  // Полоса источников: четыре входа броней, имена площадок буквами, а не логотипами
  await expect(page.locator('#sales .growth__sources-grid > li')).toHaveCount(4);
  await expect(page.locator('#sales .growth__sources')).toContainText('Booking.com');
  const axe = await new AxeBuilder({ page }).include('#sales').analyze();
  expect(axe.violations).toEqual([]);
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

/** Пример списка сотрудников в «Команде» подписан примером и не имитирует интерфейс кнопками. */
test('пример команды: вымышленные имена, подпись примером, без интерактива', async ({ page }) => {
  await page.goto('/');
  const preview = page.locator('.team__preview');
  await expect(preview).toContainText('Демо-сотрудник 01');
  await expect(preview).toContainText(/Пример/);
  await expect(preview.locator('a, button, [role="button"]')).toHaveCount(0);
});

/**
 * 03.10.2026, решение владельца: внутренней дорожной карты на странице нет; 09.10.2026 владелец
 * подтвердил: слова «пилот» не используем нигде. Салоны и рестораны зовут словами, без обещания
 * функций, которых в системе нет.
 */
test('на главной нет дорожной карты направлений и слова «пилот»', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  for (const word of ['Первое направление', 'Следующее направление', 'пока нельзя']) {
    expect(text, `слово дорожной карты на главной: ${word}`).not.toContain(word);
  }
  expect(text).not.toMatch(/пилот/i);
});

test('карточки направлений ведут на configured email и существующий AuthDialog', async ({
  page,
}) => {
  await page.goto('/');
  const cards = page.locator('.verticals__card');
  await expect(cards).toHaveCount(3);
  for (const card of [cards.nth(1), cards.nth(2)]) {
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
  expect(hrefs).toEqual(['/#product', '/#audience', '/#features', '/#sales', '/#start']);
});

test('подвал: правовые страницы и финальный призыв без чисел клиентов', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('.site-footer');
  await expect(footer.getByRole('link', { name: 'Политика конфиденциальности' })).toHaveAttribute(
    'href',
    '/privacy/',
  );
  await expect(footer.getByRole('link', { name: 'Пользовательское соглашение' })).toHaveAttribute(
    'href',
    '/terms/',
  );
  const final = page.locator('#get-started');
  await expect(final.getByRole('heading', { level: 2 })).toContainText(
    'Начните управлять бизнесом проще',
  );
  await expect(final.locator('[data-auth="register"]')).toHaveCount(1);
  await expect(final.getByRole('link', { name: 'Связаться с нами' })).toHaveAttribute(
    'href',
    /^mailto:/,
  );
  await expect(final).not.toContainText(/тысяч|клиент/i);
});

test('в текстах главной нет длинного тире и разделителя « · »', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  expect(text, 'длинное тире в тексте главной (CLAUDE.md §5)').not.toContain('—');
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
    await page.locator('.public-intro__actions a[href="#features"]').click();
    await expect(page.locator('#features')).toBeInViewport();
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
  await page.getByText('Для какого бизнеса подходит WETOP?', { exact: true }).click();
  await expect(page.locator('#faq details[open]')).toContainText('хостелы');
});

/** Правовые страницы: открываются, доступны и подписаны редакцией. */
for (const path of ['/privacy/', '/terms/'] as const) {
  test(`${path}: заголовок, редакция, доступность`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.legal__meta')).toContainText(/Редакция от/);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
