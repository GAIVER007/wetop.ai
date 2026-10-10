import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const theme of ['dark', 'light'] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`public intro: ${theme}, ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.addInitScript((value) => localStorage.setItem('wetop-theme', value), theme);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Управляйте бронированиями, клиентами и командой из одного окна',
      );
      const header = page.locator('header');
      await expect(
        header.getByRole('link', { name: 'Регистрация', exact: true }).first(),
      ).toBeVisible();
      const hero = page.locator('.public-intro');
      await expect(hero).toContainText('Салоны красоты');
      await expect(hero).toContainText('Рестораны');
      await expect(hero).not.toContainText(/пилот/i);
      // Дашборд-мокап (LAND2 v2): вымышленные данные и подпись примера, интерактива внутри нет
      await expect(hero.locator('.dash')).toBeVisible();
      await expect(hero).toContainText('Пример интерфейса. Данные вымышленные.');
      await expect(hero.locator('.dash a, .dash button, .dash [role="button"]')).toHaveCount(0);
      const cards = page.locator('.verticals__card');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText('Гостиницы');
      for (const [index, pattern] of [
        [1, /vertical=BEAUTY.*#register/],
        [2, /vertical=FOOD_SERVICE.*#register/],
      ] as const) {
        const card = cards.nth(index);
        await expect(card).not.toContainText(/пилот/i);
        await expect(card.locator('[data-auth="register"]')).toHaveAttribute('href', pattern);
      }
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        preview: document.querySelector('.dash')!.getBoundingClientRect().top,
      }));
      expect(layout.scroll).toBeLessThanOrEqual(layout.width);
      expect(layout.preview).toBeLessThan(width === 1440 ? 900 : 1400);
      const violations = (
        await new AxeBuilder({ page })
          .include('header')
          .include('.public-intro')
          .include('.verticals')
          .analyze()
      ).violations;
      expect(violations).toEqual([]);
    });
  }
}

test('new header registration: keyboard activation and focus return on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://app.wetop.ai/api/site-auth/options', (route) =>
    route.fulfill({ json: { registrationEnabled: true } }),
  );
  await page.route('https://app.wetop.ai/api/site-auth/session', (route) =>
    route.fulfill({ status: 401, json: { message: 'synthetic anonymous visitor' } }),
  );
  await page.goto('/');
  const trigger = page.locator('.site-header__register');
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('vertical card buttons preselect the correct vertical in existing AuthDialog', async ({
  page,
}) => {
  await page.route('https://app.wetop.ai/api/site-auth/options', (route) =>
    route.fulfill({ json: { registrationEnabled: true } }),
  );
  await page.route('https://app.wetop.ai/api/site-auth/session', (route) =>
    route.fulfill({ status: 401, json: { message: 'synthetic anonymous visitor' } }),
  );
  await page.goto('/');
  for (const [index, action, name] of [
    [1, 'Для салонов', 'Салон красоты / студия'],
    [2, 'Для ресторанов', 'Кафе / ресторан'],
  ] as const) {
    await page
      .locator('.verticals__card')
      .nth(index)
      .getByRole('link', { name: action, exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: new RegExp(name) })).toBeChecked();
    await expect(dialog).toContainText('По приглашению');
    await page.keyboard.press('Escape');
  }
});

test('business positioning: three verticals, no maturity labels, five capabilities each', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const intro = page.locator('.public-intro');
  await expect(intro).not.toContainText(/пилот|Beauty|Food Service/i);
  for (const label of ['Гостиницы', 'Рестораны', 'Салоны красоты'])
    await expect(intro).toContainText(label);
  const cards = page.locator('.verticals__card');
  await expect(page.locator('.verticals')).not.toContainText(/пилот/i);
  for (const card of await cards.all()) {
    await expect(card.locator('.verticals__capabilities li')).toHaveCount(5);
    await expect(card.locator('.verticals__art')).toBeVisible();
  }
});
