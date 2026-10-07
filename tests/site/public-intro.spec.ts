import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const theme of ['dark', 'light'] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`public intro: ${theme}, ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.addInitScript((value) => localStorage.setItem('wetop-theme', value), theme);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Управляйте бизнесом из одного окна',
      );
      const header = page.locator('header');
      await expect(
        header.getByRole('link', { name: 'Регистрация', exact: true }).first(),
      ).toBeVisible();
      const hero = page.locator('.public-intro');
      await expect(hero).toContainText('Beauty');
      await expect(hero).toContainText('Food Service');
      await expect(hero).toContainText('Пилот');
      await expect(hero.locator('.today-preview')).toBeVisible();
      await expect(hero).toContainText('Пример интерфейса. Данные вымышленные.');
      const cards = page.locator('.verticals__card');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText('Доступно');
      for (const card of [cards.nth(1), cards.nth(2)]) {
        await expect(card).toContainText('Пилот');
        await expect(card.getByRole('link', { name: 'Условия пилота' })).toHaveAttribute(
          'href',
          /^mailto:/,
        );
        await expect(card.getByRole('link', { name: 'У меня есть приглашение' })).toHaveAttribute(
          'href',
          /vertical=(BEAUTY|FOOD_SERVICE).*#register/,
        );
      }
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        preview: document.querySelector('.today-preview')!.getBoundingClientRect().top,
      }));
      expect(layout.scroll).toBeLessThanOrEqual(layout.width);
      expect(layout.preview).toBeLessThan(width === 1440 ? 600 : 844);
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

test('pilot invitation links preselect the correct vertical in existing AuthDialog', async ({
  page,
}) => {
  await page.route('https://app.wetop.ai/api/site-auth/options', (route) =>
    route.fulfill({ json: { registrationEnabled: true } }),
  );
  await page.route('https://app.wetop.ai/api/site-auth/session', (route) =>
    route.fulfill({ status: 401, json: { message: 'synthetic anonymous visitor' } }),
  );
  await page.goto('/');
  for (const [index, name] of [
    [1, 'Салон красоты / студия'],
    [2, 'Кафе / ресторан'],
  ] as const) {
    await page
      .locator('.verticals__card')
      .nth(index)
      .getByRole('link', { name: 'У меня есть приглашение' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: new RegExp(name) })).toBeChecked();
    await expect(dialog).toContainText('Пилот');
    await page.keyboard.press('Escape');
  }
});
