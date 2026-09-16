import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Страница компонентов /design-system (план дизайн-системы, шаг 4; DESIGN.md §8).
 *  — открывается при разработке, показывает обе темы;
 *  — у каждого интерактивного компонента все восемь состояний;
 *  — axe без нарушений в обеих темах;
 *  — при масштабе 200 % (720 CSS px) нет горизонтальной прокрутки;
 *  — снимки секций — эталон в design/reference/kit (первый прогон на новой машине:
 *    --update-snapshots; имя снимка включает платформу, шрифты у macOS и Linux разные);
 *  — новые компоненты работают с клавиатуры: меню, окно, уведомление, подсказка.
 */
const STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'selected'];

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('обе темы на одной странице, у интерактивных компонентов восемь состояний', async ({
  page,
}) => {
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Дизайн-система');
  for (const theme of ['light', 'dark']) {
    const block = page.getByTestId(`kit-${theme}`);
    await expect(block).toBeVisible();
    const sections = block.locator('section[data-component][data-interactive]');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < count; i++) {
      const section = sections.nth(i);
      const name = await section.getAttribute('data-component');
      const states = await section
        .locator('[data-state]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
      expect(
        states.filter((s) => STATES.includes(s ?? '')),
        `${theme}: ${name}`,
      ).toEqual(expect.arrayContaining(STATES));
    }
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe и эталонные снимки секций: ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/design-system');
    const block = page.getByTestId(`kit-${theme}`);
    const result = await new AxeBuilder({ page })
      .include(`[data-testid="kit-${theme}"]`)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    const sections = block.locator('section[data-component]');
    const count = await sections.count();
    for (let i = 0; i < count; i++) {
      const section = sections.nth(i);
      const name = await section.getAttribute('data-component');
      await section.scrollIntoViewIfNeeded();
      await expect(section).toHaveScreenshot(`${name}-${theme}-${process.platform}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
      });
    }
  });
}

test('масштаб 200 %: нет горизонтальной прокрутки', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 720, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => {
    // tsconfig тестов без DOM; функция выполняется в браузере
    const root = (
      globalThis as unknown as {
        document: { documentElement: { scrollWidth: number; clientWidth: number } };
      }
    ).document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

test('меню действий: стрелки, Enter, Escape возвращает фокус на кнопку', async ({ page }) => {
  await page.goto('/design-system');
  const section = page.getByTestId('kit-light').locator('[data-component="action-menu"]');
  const button = section.getByRole('button', { name: 'Действия с бронью' });
  await button.focus();
  await page.keyboard.press('ArrowDown');
  const menu = section.getByRole('menu', { name: 'Действия с бронью' });
  await expect(menu).toBeVisible();
  await expect(section.getByRole('menuitem', { name: 'Переселить…' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(section.getByRole('menuitem', { name: 'Продлить на ночь' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp'); // по кругу: с первого на последний, мимо отключённого
  await expect(section.getByRole('menuitem', { name: 'Отменить бронь…' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  await button.click();
  await section.getByRole('menuitem', { name: 'Продлить на ночь' }).click();
  await expect(section.getByTestId('menu-result')).toHaveText('выбрано: Продлить');
});

test('окно подтверждения: фокус внутри, Escape — отказ, действие названо', async ({ page }) => {
  await page.goto('/design-system');
  const section = page.getByTestId('kit-light').locator('[data-component="confirm-dialog"]');
  await section.getByRole('button', { name: 'Отменить бронь…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Отменить бронь 20260913-TESTAA?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Оставить как есть' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await section.getByRole('button', { name: 'Отменить бронь…' }).click();
  await dialog.getByRole('button', { name: 'Отменить бронь', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Выполняю…' })).toBeDisabled();
  await expect(section.getByRole('status')).toHaveText('Бронь отменена, штраф 8 000 ₸ начислен');
});

test('уведомление появляется в живой области и закрывается', async ({ page }) => {
  await page.goto('/design-system');
  const section = page.getByTestId('kit-light').locator('[data-component="toast"]');
  await section.getByRole('button', { name: 'Показать «заселён»' }).click();
  // живая область, не статичные примеры с тем же текстом
  const toast = section.locator('.toast-region:not(.toast-region--static) .toast').first();
  await expect(toast).toHaveText(/Гость заселён, R01/);
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await expect(toast).toBeHidden();
});

test('подсказка открывается фокусом и закрывается Escape', async ({ page }) => {
  await page.goto('/design-system');
  const section = page.getByTestId('kit-light').locator('[data-component="tooltip"]');
  const trigger = section.getByRole('button', { name: 'Оплачено каналом' }).first();
  await trigger.focus();
  const tip = section.getByRole('tooltip').filter({ hasText: 'Предоплата 24 000 ₸' }).first();
  await expect(tip).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-describedby', /.+/);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});
