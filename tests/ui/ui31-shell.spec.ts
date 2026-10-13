import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

const shots = 'reports/ui3-1-2026-10-11';
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  mkdirSync(shots, { recursive: true });
});

test('UI3.1: одна кнопка, стабильная ширина и клавиатурное меню', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeEnabled();
  await page.screenshot({
    path: `${shots}/${process.env.UI31_BASELINE ? 'before' : 'after'}-desktop.png`,
  });
  const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await expect(trigger).toBeVisible();
  const before = await page.locator('main').boundingBox();
  await trigger.click();
  const panel = page.locator('.sidenav__panel');
  await expect(panel).toBeVisible();
  const after = await page.locator('main').boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.x).toBe(before?.x);
  const sales = panel.getByRole('button', { name: 'Продажи', exact: true });
  await sales.focus();
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: `${shots}/after-desktop-menu-subsections.png` });
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('link', { name: 'Обзор продаж', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(sales).toBeFocused();
  await page.mouse.move(1400, 880);
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('UI3.1: mobile освобождает низ и возвращает фокус', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeEnabled();
  await page.screenshot({
    path: `${shots}/${process.env.UI31_BASELINE ? 'before' : 'after'}-mobile.png`,
  });
  await expect(page.locator('.bottom-navigation')).toHaveCount(0);
  expect((await page.locator('.workspace-header').boundingBox())!.height).toBeCloseTo(56, 0);
  const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
  await expect(drawer).toBeVisible();
  await page.screenshot({ path: `${shots}/after-mobile-menu.png` });
  await expect(drawer.getByRole('link', { name: 'Календарь', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('UI3.1: переход закрывает меню, active route сохраняется', async ({ page }) => {
  await page.goto('/chessboard');
  const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await trigger.click();
  const panel = page.locator('.sidenav__panel');
  await panel.getByRole('button', { name: 'Настройки', exact: true }).hover();
  await panel.getByRole('link', { name: 'Объект', exact: true }).click();
  await expect(page).toHaveURL(/\/hotel-settings$/);
  await expect(panel).toBeHidden();
  await expect(page.locator('#main-content')).toBeFocused();
  await trigger.click();
  await expect(panel.locator('[aria-current="page"]')).toHaveText('Объект');
  await page.goBack();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(panel).toBeHidden();
});

test('UI3.1: граница desktop/mobile и узкий экран', async ({ page }) => {
  await page.goto('/chessboard');
  for (const width of [1536, 1366, 1024, 961, 960, 959, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true });
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toBeEnabled();
    const header = (await page.locator('.workspace-header').boundingBox())!;
    expect(header.height).toBe(56);
    expect(
      await page
        .locator('.workspace')
        .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--header-row-h'))),
    ).toBe(56);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await trigger.click();
    if (width > 960) await expect(page.locator('.sidenav__panel')).toBeVisible();
    else {
      const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
      await expect(drawer).toBeVisible();
      const close = drawer.getByRole('button', { name: 'Закрыть: Навигация' });
      await close.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(drawer.locator('.workspace-footer')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

test('UI3.1: размеры целей шапки и мобильной поверхности', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeEnabled();
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 640 });
    await expect(page.getByRole('button', { name: 'Найти гостя или бронь', exact: true })).toHaveCount(0);
    for (const name of ['Открыть меню', 'Переключить тему']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.width, name).toBeGreaterThanOrEqual(44);
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto('/finance');
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 640 });
    const search = page.getByRole('button', { name: 'Найти гостя или бронь', exact: true });
    await expect(search).toBeVisible();
    const box = (await search.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
  const box = (await drawer.boundingBox())!;
  expect(box.width).toBe(344);
  await expect(drawer).toHaveCSS('padding', '16px');
  await expect(drawer).toHaveCSS('border-radius', '10px');
  await expect(drawer.locator('.sidebar-section-toggle').first()).toHaveCSS('font-size', '14px');
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(352);
  expect(box.y + box.height).toBeLessThanOrEqual(632);
});

for (const width of [1440, 390]) {
  test(`UI3.1: история периода закрывает меню ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/chessboard');
    const previous = page.url();
    await page.getByRole('link', { name: 'Следующая неделя', exact: true }).click();
    await expect(page).not.toHaveURL(previous);
    const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true });
    const surface =
      width > 960
        ? page.locator('.sidenav__panel')
        : page.getByRole('dialog', { name: 'Навигация', exact: true });
    await trigger.click();
    await expect(surface).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(previous);
    await expect(surface).toBeHidden();
    await trigger.click();
    await page.goForward();
    await expect(page).not.toHaveURL(previous);
    await expect(surface).toBeHidden();
  });
}

test('UI3.1: мобильный переход фокусирует готовое содержимое', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
  await drawer.getByRole('link', { name: 'Гости и бронирования', exact: true }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(drawer).toBeHidden();
  await expect(page.locator('#main-content')).toBeFocused();
});
