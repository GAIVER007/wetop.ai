import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Лендинг «Для гостиниц» (/for/hotels/, 10.10.2026): каркас одобренного салонного в базовой палитре,
 * герой с общим дашборд-мокапом «Сегодня», полоса фактов продукта, восемь возможностей, блок роста,
 * вопросы и призыв. Текст только из продукта (§19.9): ни чисел клиентов, ни кейсов, ни тарифов.
 */
const PATH = '/for/hotels/';

test('герой: заголовок, регистрация с направлением и мокап с подписью примера', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Управляйте гостиницей в одном сервисе',
  );
  const hero = page.locator('.hotel-hero');
  await expect(hero).toContainText('Для гостиниц');
  await expect(hero.getByRole('link', { name: /Попробовать бесплатно/ })).toHaveAttribute(
    'href',
    'https://wetop.ai/?vertical=HOSPITALITY#register',
  );
  await expect(hero.getByRole('link', { name: /Посмотреть возможности/ })).toHaveAttribute(
    'href',
    '#hotel-features',
  );
  // Общий мокап «Сегодня»: вымышленные данные, подпись примера, интерактива внутри нет (§19.9)
  await expect(hero.locator('.dash')).toBeVisible();
  await expect(hero).toContainText('Пример интерфейса. Данные вымышленные.');
  await expect(hero.locator('.dash a, .dash button, .dash [role="button"]')).toHaveCount(0);
});

test('полоса фактов и возможности: восемь карточек, без выдуманных чисел', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator('.hotel-facts__item')).toHaveCount(4);
  const features = page.locator('#hotel-features .card');
  await expect(features).toHaveCount(8);
  await expect(features.first()).toContainText('Шахматка');
  const body = await page.locator('body').innerText();
  // Чисел клиентов и рейтингов не бывает (§19.9); «пилота» и « · » тоже. Проценты в мокапе
  // «Сегодня» легитимны (вымышленный пример с подписью), поэтому их сторож не ловит.
  expect(body).not.toMatch(/гостиниц? (уже )?с нами|2\s?000 объектов|4[.,]9|рост выручки/i);
  expect(body).not.toMatch(/14\s?дней|пилот/i);
  expect(body).not.toContain(' · ');
  // Цены подписки и кейсов нет: решения нет (Q-141, Q-143), отзывов никто не давал.
  // Слово «тарифы» легально: это раздел продукта (календарь цен), сторож ловит только подписку.
  expect(body).not.toMatch(/₸\s*\/\s*мес|в месяц за|истории успеха|отзыв/i);
});

test('снимок календаря: настоящий экран с подписью примера и альтернативным текстом', async ({
  page,
}) => {
  await page.goto(PATH);
  const shot = page.locator('.hotel-shot');
  await expect(shot).toContainText('Номера и койки на одной сетке');
  const img = shot.locator('img');
  await expect(img).toHaveAttribute('src', '/screens/calendar-week-light.png');
  await expect(img).toHaveAttribute('alt', /Календарь размещений WETOP/);
  await expect(shot).toContainText('Интерфейс WETOP. Данные вымышленные.');
  const res = await page.request.get('/screens/calendar-week-light.png');
  expect(res.status()).toBe(200);
  const dark = await page.request.get('/screens/calendar-week-dark.png');
  expect(dark.status()).toBe(200);
});

test('рост, вопросы и призыв: пункты без процентов, details работают, регистрация в cta', async ({
  page,
}) => {
  await page.goto(PATH);
  const growth = page.locator('.hotel-growth');
  await expect(growth).toContainText('Больше прямых броней. Меньше рутины.');
  await expect(growth.locator('.hotel-growth__points li')).toHaveCount(4);
  expect(await growth.innerText()).not.toMatch(/%/);
  const faq = page.locator('.faq details');
  await expect(faq).toHaveCount(5);
  const first = faq.first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(page.locator('.cta [data-auth="register"]')).toHaveAttribute(
    'href',
    'https://wetop.ai/?vertical=HOSPITALITY#register',
  );
});

for (const [theme, width] of [
  ['light', 1440],
  ['dark', 1440],
  ['light', 390],
  ['dark', 390],
] as const) {
  test(`доступность и вёрстка: ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(PATH);
    expect(
      Number(
        await page.evaluate(
          'document.documentElement.scrollWidth - document.documentElement.clientWidth',
        ),
      ),
    ).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
