import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Страница компонентов /design-system (план design-system-2026-09-14, шаг 4; DESIGN.md §8).
 * Снимки — эталон `toHaveScreenshot` в design/reference/kit; axe без нарушений в обеих темах;
 * у каждого интерактивного компонента все 8 состояний; при масштабе 200 % нет горизонтальной прокрутки;
 * пять новых компонентов работают клавиатурой.
 */
const fixture = 'http://127.0.0.1:4311';
const STATES = ['normal', 'hover', 'active', 'focus', 'disabled', 'loading', 'error', 'selected'];

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

async function open(page: Page, theme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Дизайн-система');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.mouse.move(0, 0);
}

for (const theme of ['light', 'dark'] as const) {
  test(`эталонный снимок страницы компонентов (${theme})`, async ({ page }) => {
    await open(page, theme);
    await expect(page).toHaveScreenshot(`design-system-${theme}.png`, {
      fullPage: true,
      caret: 'hide',
      animations: 'disabled',
      mask: [page.locator('.skeleton')],
      // шум между прогонами одного и того же кода — единицы пикселей субпиксельного сглаживания (14.09: 9 px)
      maxDiffPixels: 40,
    });
  });

  test(`axe без нарушений (${theme})`, async ({ page }) => {
    await open(page, theme);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('у каждого интерактивного компонента все восемь состояний', async ({ page }) => {
  await open(page, 'light');
  const sections = page.locator('[data-component][data-interactive="true"]');
  const count = await sections.count();
  expect(count).toBeGreaterThanOrEqual(12);
  for (let i = 0; i < count; i++) {
    const section = sections.nth(i);
    const id = await section.getAttribute('data-component');
    for (const state of STATES)
      await expect(section.locator(`[data-state="${state}"]`).first(), `${id}: нет состояния ${state}`).toBeAttached();
  }
  // 31 компонент из DESIGN.md §8
  expect(await page.locator('[data-component]').count()).toBeGreaterThanOrEqual(31);
});

test('масштаб 200 %: нет горизонтальной прокрутки страницы', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 500 });
  await open(page, 'light');
  const widths = await page.evaluate(() => {
    const g = globalThis as unknown as { document: { documentElement: { scrollWidth: number; clientWidth: number } } };
    return [g.document.documentElement.scrollWidth, g.document.documentElement.clientWidth];
  });
  expect(widths[0]).toBeLessThanOrEqual(widths[1]! + 1);
});

test('меню действий, окно подтверждения, уведомление и подсказка работают клавиатурой', async ({ page }) => {
  await open(page, 'light');
  // живые образцы — клиентские компоненты: ждём, пока страница догрузится и React повесит обработчики
  await page.waitForLoadState('networkidle');
  // меню действий: открыть, стрелкой вниз, Enter → выбрано; Escape возвращает фокус на кнопку
  const menuButton = page.getByRole('button', { name: 'Действия', exact: true });
  await menuButton.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Действия' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Заселить/ })).toBeDisabled();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('action-menu-last')).toHaveText('выбрано: Продлить на ночь');
  await expect(menu).toBeHidden();
  await menuButton.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(menuButton).toBeFocused();

  // окно подтверждения: сумма видна до нажатия, Escape = отмена, подтверждение проходит через «Отменяю…»
  const confirmSection = page.locator('#confirm-dialog');
  await confirmSection.getByRole('button', { name: 'Отменить со штрафом', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Отменить бронь 20260913-SHOWTN?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('8 000 ₸');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await confirmSection.getByRole('button', { name: 'Отменить со штрафом', exact: true }).click();
  await dialog.getByRole('button', { name: 'Отменить со штрафом' }).click();
  await expect(page.getByTestId('confirm-last')).toHaveText('отмена подтверждена');

  // уведомление: появляется со статусом и закрывается кнопкой
  await page.getByRole('button', { name: 'Показать «Проживание продлено»' }).click();
  const toast = page.getByTestId('toast-stack').getByRole('status');
  await expect(toast).toContainText('Проживание продлено');
  await toast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await expect(toast).toHaveCount(0);

  // подсказка: открывается фокусом, связана aria-describedby, Escape закрывает
  const trigger = page.locator('#tooltip .ds-sample').getByRole('button', { name: 'Карточка гостя' });
  await trigger.focus();
  const tip = page.locator('#tooltip .ds-sample').getByRole('tooltip', { name: /Открыть карточку гостя/ });
  await expect(tip).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-describedby', (await tip.getAttribute('id')) ?? '');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});
