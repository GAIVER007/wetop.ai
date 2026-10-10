import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Лендинг «Для салонов красоты» (/for/salons/, план plans/salon-landing-2026-10-10.md, ТЗ владельца
 * 10.10.2026): герой с мокапом записей, полоса фактов продукта, восемь возможностей, блок роста,
 * вопросы и призыв. Текст только из продукта (§19.9): ни чисел клиентов, ни рейтингов, ни тарифов.
 */
const PATH = '/for/salons/';

test('герой: заголовок, регистрация с направлением и мокап с подписью примера', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Управляйте салоном красоты в одном сервисе',
  );
  const hero = page.locator('.salon-hero');
  await expect(hero).toContainText('Для салонов красоты');
  await expect(hero.getByRole('link', { name: /Попробовать бесплатно/ })).toHaveAttribute(
    'href',
    'https://wetop.ai/?vertical=BEAUTY#register',
  );
  await expect(hero.getByRole('link', { name: /Посмотреть возможности/ })).toHaveAttribute(
    'href',
    '#salon-features',
  );
  // Мокап записей: вымышленные данные, подпись примера, интерактива внутри нет (§19.9)
  await expect(hero).toContainText('Пример интерфейса. Данные вымышленные.');
  await expect(hero.locator('.salon-hero__mock a, .salon-hero__mock button')).toHaveCount(0);
});

test('полоса фактов и возможности: восемь карточек, без выдуманных чисел', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator('.salon-facts__item')).toHaveCount(4);
  const features = page.locator('#salon-features .card');
  await expect(features).toHaveCount(8);
  await expect(features.first()).toContainText('Календарь записей');
  const body = await page.locator('body').innerText();
  // Чисел клиентов, рейтингов и процентов результата не бывает (§19.9); «пилота» и « · » тоже
  expect(body).not.toMatch(/салон(ов|а)? (уже )?с нами|2\s?000|4[.,]9|рост выручки|\+\d+\s?%|−\d+\s?%|-\d+\s?%/i);
  expect(body).not.toMatch(/14\s?дней|пилот/i);
  expect(body).not.toContain(' · ');
  // Тарифов и кейсов с именами нет: решения нет (Q-141, Q-143), отзывов никто не давал
  expect(body).not.toMatch(/тариф|₸\s*\/\s*мес|в месяц|истории успеха/i);
});

test('рост, вопросы и призыв: пункты без процентов, details работают, регистрация в cta', async ({
  page,
}) => {
  await page.goto(PATH);
  const growth = page.locator('.salon-growth');
  await expect(growth).toContainText('Больше довольных клиентов. Больше прибыли.');
  await expect(growth.locator('li')).toHaveCount(4);
  expect(await growth.innerText()).not.toMatch(/%/);
  const faq = page.locator('.faq details');
  await expect(faq).toHaveCount(5);
  const first = faq.first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(page.locator('.cta [data-auth="register"]')).toHaveAttribute(
    'href',
    'https://wetop.ai/?vertical=BEAUTY#register',
  );
  await expect(page.locator('.cta a[href="/"]')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и вёрстка: ${theme}, компьютер и телефон`, async ({ page }) => {
    // Тема системной настройкой, а не localStorage: смена темы после первой отрисовки анимирует
    // фон кнопок и ссылок, и axe замеряет контраст посреди перехода (ловлено 10.10.2026)
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto(PATH);
      const overflow = Number(
        await page.evaluate(
          'document.documentElement.scrollWidth - document.documentElement.clientWidth',
        ),
      );
      expect(overflow, `горизонтальная прокрутка на ${width}`).toBeLessThanOrEqual(1);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    }
  });
}
