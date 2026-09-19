import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('главная: новая бронь и резюме внимания доступны на первом экране', async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
    await page.goto('/today');
    const create = page.getByRole('main').getByRole('link', { name: 'Новая бронь', exact: true });
    await expect(create).toBeInViewport({ ratio: 1 });
    const attention = page.getByRole('link', { name: /Требуют внимания: / });
    await expect(attention).toBeInViewport({ ratio: 1 });
    await attention.click();
    await expect(
      page.getByRole('heading', { name: 'Требуют внимания', exact: true }),
    ).toBeInViewport();
  }
});

test('период на телефоне: подписанные поля и цели не меньше 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  for (const control of [
    page.getByLabel('Период: с'),
    page.getByLabel('Период: по'),
    page.getByTestId('period-form').getByRole('button', { name: 'Показать' }),
    page
      .getByRole('navigation', { name: 'Период показателей' })
      .getByRole('link', { name: 'Сегодня', exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test('месячные показатели и задачи конкретного дня подписаны отдельно', async ({ page }) => {
  await page.goto('/today?period=month&date=2026-09-17');
  await expect(page.getByTestId('period-caption')).toContainText('30 дней');
  await expect(page.getByTestId('attention-summary')).toContainText('17 сент.');
  for (const id of ['occupancy', 'revenue', 'paid', 'adr', 'revpar', 'arrivals']) {
    await expect(page.getByTestId(`kpi-${id}`)).toBeVisible();
  }
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`редизайн: доступность и снимки главной и компонентов, ${theme}, ${width}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const directory = 'reports/design-refresh-2026-09-19/after';
      mkdirSync(directory, { recursive: true });
      for (const route of ['today', 'design-system']) {
        await page.goto(`/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
        const overflow = await page.evaluate(() => {
          const browser = globalThis as unknown as {
            innerWidth: number;
            document: { documentElement: { scrollWidth: number } };
          };
          return browser.document.documentElement.scrollWidth - browser.innerWidth;
        });
        expect(overflow).toBeLessThanOrEqual(1);
        if (route === 'today') {
          await page.screenshot({ path: `${directory}/today-${theme}-${width}.png` });
        } else {
          for (const component of ['button', 'input']) {
            const section = page
              .getByTestId(`kit-${theme}`)
              .locator(`[data-component="${component}"]`);
            await section.screenshot({
              path: `${directory}/${component}-${theme}-${width}.png`,
              // Снимаем компонент целиком: фиксированный каркас не должен перекрывать длинный снимок.
              style:
                '.workspace-header, .bottom-navigation, .skip-link { visibility: hidden !important; }',
            });
          }
        }
      }
    });
  }
}
