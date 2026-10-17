import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Лендинг «Для ресторанов» (/for/restaurants/, 10.10.2026): каркас гостиничного, в герое цветное фото
 * зала вместо мокапа; возможности только из влитого контура §28. Текст по §19.9: ни чисел клиентов,
 * ни кейсов, ни тарифов; «7 дней» один раз на экран.
 */
const PATH = '/for/restaurants/';

test('герой: заголовок, регистрация с направлением и мокап с подписью примера', async ({
  page,
}) => {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Зал, заказы и кухня ресторана в одном окне',
  );
  const hero = page.locator('.hotel-hero');
  await expect(hero).toContainText('Для ресторанов');
  await expect(hero.getByRole('link', { name: /Начать работу/ })).toHaveAttribute(
    'href',
    'https://wetop.ai/?vertical=FOOD_SERVICE#register',
  );
  await expect(hero.getByRole('link', { name: /Посмотреть возможности/ })).toHaveAttribute(
    'href',
    '#restaurant-features',
  );
  // В герое цветное фото зала (своё, KIE): с альтернативным текстом и без интерактива
  await expect(hero.locator('figure img')).toHaveAttribute('src', '/design-only/restaurant.svg');
  await expect(hero.locator('figure img')).toHaveAttribute('alt', /вымышленные/);
});

test('полоса фактов и возможности: девять карточек, без выдуманных чисел', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator('.hotel-facts__item')).toHaveCount(4);
  const features = page.locator('#restaurant-features .card');
  await expect(features).toHaveCount(9);
  await expect(features.first()).toContainText('План зала');
  // модули для владельца: пункты внутри каждой карточки; бара у ресторана ещё нет, он помечен «Скоро»
  for (const name of [
    'Касса и оплата',
    'Меню и калькуляция',
    'График смен',
    'Зарплата официантов',
    'Личные кабинеты',
  ])
    await expect(features.filter({ hasText: name }).locator('li')).not.toHaveCount(0);
  // склад кухни работает на стойке с 12.10.2026: пометок «Скоро» в модулях больше нет
  await expect(features.filter({ hasText: 'Склад кухни и бара' }).locator('li')).toHaveCount(4);
  await expect(features.locator('.tag')).toHaveCount(0);
  const body = await page.locator('body').innerText();
  // Чисел клиентов и рейтингов не бывает (§19.9); «пилота» и « · » тоже. Проценты в мокапе
  // «Сегодня» легитимны (вымышленный пример с подписью), поэтому их сторож не ловит.
  expect(body).not.toMatch(/ресторан(ов|а)? (уже )?с нами|2\s?000 объектов|4[.,]9|рост выручки/i);
  expect(body).not.toMatch(/14\s?дней|пилот/i);
  expect(body).not.toContain(' · ');
  // Цены подписки и кейсов нет: решения нет (Q-141, Q-143), отзывов никто не давал.
  // Слово «тарифы» легально: это раздел продукта (календарь цен), сторож ловит только подписку.
  expect(body).not.toMatch(/₸\s*\/\s*мес|в месяц за|истории успеха|отзыв/i);
});

test('рост, вопросы и призыв: пункты без процентов, details работают, регистрация в cta', async ({
  page,
}) => {
  await page.goto(PATH);
  const growth = page.locator('.hotel-growth');
  await expect(growth).toContainText('Полный зал и быстрая кухня на каждой смене');
  await expect(growth.locator('.hotel-growth__points li')).toHaveCount(4);
  expect(await growth.innerText()).not.toMatch(/%/);
  const faq = page.locator('.faq details');
  await expect(faq).toHaveCount(6);
  const first = faq.first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(page.locator('.cta [data-auth="register"]')).toHaveAttribute(
    'href',
    'https://wetop.ai/?vertical=FOOD_SERVICE#register',
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
